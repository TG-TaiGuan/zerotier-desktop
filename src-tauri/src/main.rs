#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// ZeroTier Desktop — Tauri backend (Rust). Mirrors src/zt-client.js + src/arp.js.
// Every command returns a serde_json::Value of shape { ok, data?, error? } so the
// frontend bridge (window.__TAURI__.core.invoke) needs no changes vs the Electron build.

use serde_json::{json, Value};
use std::fs;
use std::process::Command;
use std::time::Duration;
use tauri::Manager;
use tauri::Emitter;

const HOST: &str = "127.0.0.1";
const PORT: u16 = 9993;

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
fn zt_request(path: &str, method: &str) -> Value {
    let token = match load_token() {
        Ok(t) => t,
        Err(e) => return json!({ "ok": false, "error": e }),
    };
    let url = format!("http://{}:{}{}", HOST, PORT, path);
    let agent = ureq::AgentBuilder::new().timeout(Duration::from_secs(6)).build();
    let req = match method {
        "POST" => agent.post(&url),
        "DELETE" => agent.delete(&url),
        _ => agent.get(&url),
    };
    match req.set("X-ZT1-Auth", &token).call() {
        Ok(r) => {
            let body = r.into_string().unwrap_or_default();
            let parsed: Value = if body.trim().is_empty() {
                json!({})
            } else {
                serde_json::from_str(&body).unwrap_or_else(|_| json!({}))
            };
            json!({ "ok": true, "data": parsed })
        }
        Err(ureq::Error::Status(code, r)) => {
            let body = r.into_string().unwrap_or_default();
            json!({ "ok": false, "error": format!("Service responded HTTP {}", code), "status": code, "raw": body.chars().take(200).collect::<String>() })
        }
        Err(e) => json!({ "ok": false, "error": format!("Cannot reach zerotier-one: {}", e) }),
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
    if ip_to_int(ip).is_none() {
        return json!({ "ok": false, "error": "Invalid interface IP" });
    }
    let out = Command::new("arp").args(["-a", "-N", ip]).output();
    let out = match out {
        Ok(o) => o,
        Err(e) => return json!({ "ok": false, "error": format!("ARP command failed: {}", e) }),
    };
    let (text, _, _) = encoding_rs::GBK.decode(&out.stdout);
    parse_arp(&text, cidr)
}

/* ---------- Tauri commands ---------- */
#[tauri::command]
fn get_status() -> Value { zt_request("/status", "GET") }

#[tauri::command]
fn get_networks() -> Value { zt_request("/network", "GET") }

#[tauri::command]
fn join_network(id: String) -> Value {
    if !valid_nwid(&id) {
        return json!({ "ok": false, "error": "Network ID must be 16 hex characters." });
    }
    zt_request(&format!("/network/{}", id.trim()), "POST")
}

#[tauri::command]
fn leave_network(id: String) -> Value {
    if !valid_nwid(&id) {
        return json!({ "ok": false, "error": "Network ID must be 16 hex characters." });
    }
    zt_request(&format!("/network/{}", id.trim()), "DELETE")
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
    app.exit(0);
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // A second launch just summons the existing window to the front.
            for w in app.webview_windows().values() { let _ = w.show(); let _ = w.set_focus(); }
        }))
        .invoke_handler(tauri::generate_handler![
            get_status, get_networks, join_network, leave_network, get_arp,
            minimize_to_tray, quit_app
        ])
        // Intercept the window's X (close) button — the frontend asks how to handle it
        // (minimize-to-tray vs exit, with a remembered choice).
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
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
                    "show" => { for w in app.webview_windows().values() { let _ = w.show(); let _ = w.set_focus(); } }
                    "quit" => { app.exit(0); }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        for w in app.webview_windows().values() { let _ = w.show(); let _ = w.set_focus(); }
                    }
                })
                .build(app)?;
            // Ensure the window is visible and focused on startup (never starts hidden).
            for w in app.webview_windows().values() { let _ = w.show(); let _ = w.set_focus(); }
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
