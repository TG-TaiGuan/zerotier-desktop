#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// ZeroTier Desktop — Tauri backend (Rust). Mirrors src/zt-client.js + src/arp.js.
// Every command returns a serde_json::Value of shape { ok, data?, error? } so the
// frontend bridge (window.__TAURI__.core.invoke) needs no changes vs the Electron build.

use serde_json::{json, Value};
use std::fs;
use std::io::Write;
use std::process::Command;
use std::sync::OnceLock;
use std::time::Duration;
use tauri::Manager;
use tauri::Emitter;

const HOST: &str = "127.0.0.1";
const PORT: u16 = 9993;

/* ---------- file logging (logs/latest.log + timestamped archives) ---------- */
// One rolling log per launch: the current run writes logs/latest.log; on the next
// launch the previous one is rotated to logs/log-<UTC time>.log (oldest pruned past 10).
// The frontend UI flow is piped into the same file via the `log_frontend` command,
// so the whole join → wait → select sequence is visible in one place.
static LOG_PATH: OnceLock<std::path::PathBuf> = OnceLock::new();

fn epoch_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
// Civil date from days since 1970-01-01 (Howard Hinnant's algorithm). UTC — note
// the header in latest.log says so; we avoid pulling chrono to stay build-offline.
fn format_epoch(secs: u64) -> String {
    let days = (secs / 86400) as i64;
    let rem = secs % 86400;
    let h = rem / 3600;
    let m = (rem % 3600) / 60;
    let s = rem % 60;
    let z = days + 719468;
    let era = (if z >= 0 { z } else { z - 146096 }) / 146097;
    let doe = z - era * 146097;                                   // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365; // [0, 399]
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);            // [0, 365]
    let mp = (5 * doy + 2) / 153;                                 // [0, 11]
    let d = doy - (153 * mp + 2) / 5 + 1;                         // [1, 31]
    let mth = if mp < 10 { mp + 3 } else { mp - 9 };              // [1, 12]
    let yr = if mth <= 2 { y + 1 } else { y };
    format!("{:04}-{:02}-{:02} {:02}:{:02}:{:02}", yr, mth, d, h, m, s)
}
fn resolve_log_dir() -> std::path::PathBuf {
    // Prefer next to the exe (portable-friendly); fall back to %LOCALAPPDATA% when the
    // exe dir isn't writable (e.g. installer under Program Files).
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let d = parent.join("logs");
            if fs::create_dir_all(&d).is_ok() {
                let probe = d.join(".wprobe");
                if fs::write(&probe, b"x").is_ok() {
                    let _ = fs::remove_file(&probe);
                    return d;
                }
            }
        }
    }
    let base = std::env::var_os("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    let d = base.join("ZeroTier Desktop").join("logs");
    let _ = fs::create_dir_all(&d);
    d
}
fn init_logging() {
    let dir = resolve_log_dir();
    let latest = dir.join("latest.log");
    // Rotate the previous run's latest.log into a timestamped archive.
    if let Ok(meta) = fs::metadata(&latest) {
        if meta.len() > 0 {
            let stamp = meta.modified().ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| format_epoch(d.as_secs()).replace(':', "-"))
                .unwrap_or_else(|| "previous".to_string());
            let _ = fs::rename(&latest, dir.join(format!("log-{}.log", stamp)));
        }
    }
    // Prune archives: keep the 10 newest by filename (timestamps sort lexically).
    if let Ok(entries) = fs::read_dir(&dir) {
        let mut arcs: Vec<(String, std::path::PathBuf)> = entries.filter_map(|e| {
            let p = e.ok()?.path();
            let n = p.file_name()?.to_string_lossy().into_owned();
            (n.starts_with("log-") && n.ends_with(".log")).then(|| (n, p))
        }).collect();
        arcs.sort_by(|a, b| b.0.cmp(&a.0));
        for (_, p) in arcs.into_iter().skip(10) { let _ = fs::remove_file(p); }
    }
    let _ = LOG_PATH.set(latest);
    log(&format!("=== ZeroTier Desktop v{} - session start (timestamps are UTC) ===", env!("CARGO_PKG_VERSION")));
}
fn log(msg: &str) {
    let line = format!("[{}] {}\n", format_epoch(epoch_secs()), msg);
    if let Some(p) = LOG_PATH.get() {
        if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(p) {
            let _ = f.write_all(line.as_bytes());
        }
    }
    // Mirror to the console in debug builds (release hides the console).
    #[cfg(debug_assertions)]
    eprint!("{}", line);
}

/* ---------- auth token ---------- */
fn candidate_token_paths() -> Vec<std::path::PathBuf> {
    let mut v: Vec<std::path::PathBuf> = Vec::new();
    if cfg!(windows) {
        v.push(std::path::PathBuf::from(r"C:\ProgramData\ZeroTier\One\authtoken.secret"));
    } else if cfg!(target_os = "macos") {
        v.push(std::path::PathBuf::from("/Library/Application Support/ZeroTier/One/authtoken.secret"));
    } else {
        v.push(std::path::PathBuf::from("/var/lib/zerotier-one/authtoken.secret"));
    }
    if let Some(h) = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")) {
        v.push(std::path::PathBuf::from(h).join(".zeroTierOneAuthToken"));
    }
    v
}
fn load_token() -> Result<String, String> {
    for p in candidate_token_paths() {
        if let Ok(s) = fs::read_to_string(&p) {
            let t = s.trim().to_string();
            if !t.is_empty() { return Ok(t); }
        }
    }
    Err("authtoken.secret not found. Is zerotier-one installed?".to_string())
}

/* ---------- ZeroTier HTTP API (plain HTTP on 127.0.0.1:9993) ---------- */
fn zt_request(path: &str, method: &str, body: Option<&str>) -> Value {
    let token = match load_token() {
        Ok(t) => t,
        Err(e) => return json!({ "ok": false, "error": e }),
    };
    let url = format!("http://{}:{}{}", HOST, PORT, path);
    log(&format!("[zt] {} {} {}", method, url, body.map(|_| "(body)").unwrap_or("")));
    // A fresh agent per request avoids stale pooled/keep-alive connections to the
    // local service (which could time out on a join POST).
    let do_req = || {
        let agent = ureq::AgentBuilder::new().timeout(Duration::from_secs(10)).build();
        let req = match method {
            "POST" => agent.post(&url),
            "DELETE" => agent.delete(&url),
            _ => agent.get(&url),
        };
        match body {
            Some(b) => req.set("X-ZT1-Auth", &token).set("Content-Type", "application/json").send_string(b),
            None => req.set("X-ZT1-Auth", &token).call(),
        }
    };
    let mut res = do_req();
    // Retry once on a transport/connect error (transient local hiccup).
    if matches!(res.as_ref(), Err(ureq::Error::Transport(_))) {
        log("[zt] transport error, retrying once…");
        std::thread::sleep(Duration::from_millis(500));
        res = do_req();
    }
    match res {
        Ok(r) => {
            let status = r.status();
            let text = r.into_string().unwrap_or_default();
            log(&format!("[zt] {} -> HTTP {} ({} bytes)", method, status, text.len()));
            let parsed: Value = if text.trim().is_empty() {
                json!({})
            } else {
                serde_json::from_str(&text).unwrap_or_else(|_| json!({}))
            };
            json!({ "ok": true, "data": parsed })
        }
        Err(ureq::Error::Status(code, r)) => {
            let text = r.into_string().unwrap_or_default();
            log(&format!("[zt] {} -> HTTP {}", method, code));
            json!({ "ok": false, "error": format!("Service responded HTTP {}", code), "status": code, "raw": text.chars().take(200).collect::<String>() })
        }
        Err(e) => {
            log(&format!("[zt] {} -> ERROR {}", method, e));
            json!({ "ok": false, "error": format!("Cannot reach zerotier-one: {}", e) })
        }
    }
}

fn valid_nwid(id: &str) -> bool {
    let t = id.trim();
    t.len() == 16 && t.chars().all(|c| c.is_ascii_hexdigit())
}

/* ---------- ARP (OS cache) + same-subnet filter ---------- */
fn ip_to_int(ip: &str) -> Option<u32> {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() != 4 { return None; }
    let mut n: u32 = 0;
    for p in parts {
        let o: u32 = p.parse().ok()?;
        if o > 255 { return None; }
        n = n.wrapping_mul(256).wrapping_add(o);
    }
    Some(n)
}

fn cidr_endpoints(cidr: &str) -> Option<(u32, u32)> {
    let (base, bits) = cidr.split_once('/')?;
    let bits: u32 = bits.parse().ok()?;
    if bits > 32 { return None; }
    let base_i = ip_to_int(base)?;
    let mask: u32 = if bits == 0 { 0 } else { (0xFFFFFFFFu64 << (32 - bits)) as u32 };
    let net = base_i & mask;
    let bcast = net | (!mask & 0xFFFFFFFF);
    Some((net, bcast))
}

fn parse_arp(text: &str, cidr: &str) -> Value {
    let (net, bcast) = cidr_endpoints(cidr).unwrap_or((0, 0xFFFFFFFF));
    let mut iface: Option<String> = None;
    let mut index: Option<String> = None;
    let mut rows: Vec<Value> = Vec::new();
    let mut total = 0u32;

    for line in text.lines() {
        let lt = line.trim_start();
        if lt.starts_with("接口") || lt.starts_with("Interface") {
            // "接口: 1.2.3.4 --- 0xf"
            if let Some(colon) = lt.find(':') {
                let after = lt[colon + 1..].trim();
                if let Some(dash) = after.find("---") {
                    iface = Some(after[..dash].trim().to_string());
                    index = Some(after[dash + 3..].trim().to_string());
                }
            }
            continue;
        }
        let mut it = lt.split_whitespace();
        let ip = it.next().unwrap_or("");
        let mac = it.next().unwrap_or("");
        let typ = it.next().unwrap_or("");
        if ip_to_int(ip).is_some() && mac.len() == 17 && mac.contains('-') {
            total += 1;
            let Some(i) = ip_to_int(ip) else { continue };
            if i < net || i > bcast { continue; }      // not in subnet
            if i == bcast || i == net { continue; }     // skip broadcast / network addr
            let typ_norm = if typ.contains("静") || typ.eq_ignore_ascii_case("static") {
                "static"
            } else if typ.contains("动") || typ.eq_ignore_ascii_case("dynamic") {
                "dynamic"
            } else {
                "unknown"
            };
            rows.push(json!({ "ip": ip, "mac": mac, "type": typ_norm }));
        }
    }
    json!({ "ok": true, "interface": iface, "index": index, "rows": rows, "total": total })
}

fn do_arp(ip: &str, cidr: &str) -> Value {
    log(&format!("[arp] arp -a -N {} ({})", ip, cidr));
    if ip_to_int(ip).is_none() {
        return json!({ "ok": false, "error": "Invalid interface IP" });
    }
    let out = Command::new("arp").args(["-a", "-N", ip]).output();
    let out = match out {
        Ok(o) => o,
        Err(e) => { log(&format!("[arp] command failed: {}", e)); return json!({ "ok": false, "error": format!("ARP command failed: {}", e) }); }
    };
    let (text, _, _) = encoding_rs::GBK.decode(&out.stdout);
    let parsed = parse_arp(&text, cidr);
    log(&format!("[arp] stdout {} bytes, stderr {} bytes -> {} rows", out.stdout.len(), out.stderr.len(), parsed["rows"].as_array().map(|a| a.len()).unwrap_or(0)));
    parsed
}

/* ---------- Tauri commands ---------- */
#[tauri::command]
fn get_status() -> Value { zt_request("/status", "GET", None) }

#[tauri::command]
fn get_networks() -> Value { zt_request("/network", "GET", None) }

#[tauri::command]
fn join_network(id: String) -> Value {
    if !valid_nwid(&id) {
        return json!({ "ok": false, "error": "Network ID must be 16 hex characters." });
    }
    zt_request(&format!("/network/{}", id.trim()), "POST", None)
}

#[tauri::command]
fn leave_network(id: String) -> Value {
    if !valid_nwid(&id) {
        return json!({ "ok": false, "error": "Network ID must be 16 hex characters." });
    }
    zt_request(&format!("/network/{}", id.trim()), "DELETE", None)
}

// Toggle one of the network's four "Allow" flags (managed/global/default-route/DNS).
// Only the known keys are accepted, so the frontend can't POST arbitrary config.
#[tauri::command]
fn set_net_flag(id: String, key: String, value: bool) -> Value {
    if !valid_nwid(&id) {
        return json!({ "ok": false, "error": "Network ID must be 16 hex characters." });
    }
    let key = match key.as_str() {
        "allowManaged" | "allowGlobal" | "allowDefault" | "allowDNS" => key,
        _ => return json!({ "ok": false, "error": "Unknown flag." }),
    };
    let body = format!("{{\"{}\":{}}}", key, value);
    zt_request(&format!("/network/{}", id.trim()), "POST", Some(&body))
}

#[tauri::command]
fn get_arp(ip: String, cidr: String) -> Value { do_arp(&ip, &cidr) }

#[tauri::command]
fn minimize_to_tray(app: tauri::AppHandle) {
    // Hide every window (label-agnostic, so restore always works).
    for w in app.webview_windows().values() { let _ = w.hide(); }
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    log("quit_app — exiting");
    app.exit(0);
}

// The frontend pipes its UI flow (join / wait / leave / reconnect / close choice)
// through here so it lands in the same logs/latest.log as the backend [zt]/[arp] lines.
#[tauri::command]
fn log_frontend(msg: String) { log(&format!("[ui] {}", msg)); }

// App version for the About dialog (kept in sync with Cargo.toml / tauri.conf.json).
#[tauri::command]
fn get_app_version() -> String { env!("CARGO_PKG_VERSION").to_string() }

fn main() {
    init_logging();
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // A second launch just summons the existing window to the front.
            log("second launch — focusing existing window");
            for w in app.webview_windows().values() { let _ = w.show(); let _ = w.set_focus(); }
        }))
        .invoke_handler(tauri::generate_handler![
            get_status, get_networks, join_network, leave_network, set_net_flag, get_arp,
            minimize_to_tray, quit_app, log_frontend, get_app_version
        ])
        // Intercept the window's X (close) button — the frontend asks how to handle it
        // (minimize-to-tray vs exit, with a remembered choice).
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                log("window close requested — deferring to UI");
                api.prevent_close();
                let _ = window.app_handle().emit("close-requested", ());
            }
        })
        .setup(|app| {
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;
            let icon = app.default_window_icon().expect("window icon").clone();
            TrayIconBuilder::with_id("main-tray")
                .icon(icon)
                .tooltip("ZeroTier Desktop")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => { log("tray: show"); for w in app.webview_windows().values() { let _ = w.show(); let _ = w.set_focus(); } }
                    "quit" => { log("tray: quit"); app.exit(0); }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        log("tray: left-click restore");
                        for w in app.webview_windows().values() { let _ = w.show(); let _ = w.set_focus(); }
                    }
                })
                .build(app)?;
            // Ensure the window is visible and focused on startup (never starts hidden).
            for w in app.webview_windows().values() { let _ = w.show(); let _ = w.set_focus(); }
            log("setup complete - window shown");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/* ---------- live backend tests (cargo test, debug build w/ console) ---------- */
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nwid_validation() {
        assert!(valid_nwid("8056c2e21c434f64"));
        assert!(!valid_nwid("short"));
        assert!(!valid_nwid("zzzzzzzzzzzzzzzz"));
    }

    #[test]
    fn live_status() {
        let s = zt_request("/status", "GET");
        assert!(s["ok"].as_bool().unwrap_or(false), "status not ok: {}", s);
        let addr = s["data"]["address"].as_str().unwrap_or("");
        assert_eq!(addr.len(), 10, "address should be 10 hex: {}", addr);
        println!("status ok: {} online={}", addr, s["data"]["online"]);
    }

    #[test]
    fn live_networks() {
        let n = zt_request("/network", "GET");
        assert!(n["ok"].as_bool().unwrap_or(false), "networks not ok: {}", n);
        assert!(n["data"].is_array(), "networks should be array");
        println!("networks ok: count={}", n["data"].as_array().unwrap().len());
    }

    #[test]
    fn live_arp_filters_broadcast() {
        // first network's interface — read live
        let nets = zt_request("/network", "GET");
        if !nets["ok"].as_bool().unwrap_or(false) { return; } // skip if no service
        let first = nets["data"].as_array().and_then(|a| a.first()).cloned();
        let Some(net) = first else { return };
        let cidr = net["assignedAddresses"][0].as_str().unwrap_or("192.168.195.31/24");
        let ip = cidr.split('/').next().unwrap_or("192.168.195.31");
        let r = do_arp(ip, cidr);
        assert!(r["ok"].as_bool().unwrap_or(false), "arp not ok: {}", r);
        let rows = r["rows"].as_array().unwrap();
        for row in rows {
            let ip = row["ip"].as_str().unwrap_or("");
            assert!(!ip.ends_with(".255"), "broadcast leaked: {}", ip);
            assert!(!ip.ends_with(".0") || ip.parse::<std::net::Ipv4Addr>().is_err(), "network addr leaked: {}", ip);
        }
        println!("arp ok: iface={} rows={}", r["interface"], rows.len());
    }
}
