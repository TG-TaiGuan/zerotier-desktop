'use strict';

/**
 * OS ARP-table reader for a given ZeroTier interface.
 *
 * The local ZeroTier JSON API only exposes VL1 peers (no per-network L3
 * neighbors). To show the same-subnet members of a network we read the OS ARP
 * cache for that interface — the same data `arp -a -N <ip>` prints.
 *
 * `getArpTable(ip, cidr)` always resolves to { ok, ... } and never throws.
 */

const { exec } = require('child_process');

function ipToInt(ip) {
  const p = String(ip).split('.');
  if (p.length !== 4) return null;
  let n = 0;
  for (const o of p) { const v = +o; if (isNaN(v) || v < 0 || v > 255) return null; n = n * 256 + v; }
  return n >>> 0;
}

function ipInCidr(ip, cidr) {
  if (!cidr) return true;
  const [base, bitsStr] = String(cidr).split('/');
  const bits = +bitsStr;
  const ipI = ipToInt(ip);
  const baseI = ipToInt(base);
  if (ipI == null || baseI == null) return true; // can't tell → keep
  if (isNaN(bits)) return true;
  const mask = bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0;
  return (ipI & mask) === (baseI & mask);
}

function cidrEndpoints(cidr) {
  // Returns { network, broadcast } dotted strings, or nulls if uncomputable.
  if (!cidr) return { network: null, broadcast: null };
  const [base, bitsStr] = String(cidr).split('/');
  const bits = +bitsStr;
  const baseI = ipToInt(base);
  if (baseI == null || isNaN(bits)) return { network: null, broadcast: null };
  const mask = bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0;
  const net = (baseI & mask) >>> 0;
  const bcast = (net | (~mask >>> 0)) >>> 0;
  return { network: intToIp(net), broadcast: intToIp(bcast) };
}

function intToIp(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

function parseArp(text, cidr) {
  const lines = text.split(/\r?\n/);
  let iface = null;
  let index = null;
  const rows = [];
  const { network, broadcast } = cidrEndpoints(cidr);
  for (const ln of lines) {
    const mIface = ln.match(/(?:接口|Interface):\s*([\d.]+)\s*---\s*(0x[0-9a-fA-F]+|\d+)/i);
    if (mIface) { iface = mIface[1]; index = mIface[2]; continue; }
    // Row:  IP   MAC(hh-hh-...)   [type]
    const m = ln.match(/^\s*(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-fA-F]{2}(?:-[0-9a-fA-F]{2}){5})\s*(\S+)?/);
    if (m) {
      const raw = m[3] || '';
      let type = 'unknown';
      if (/静|static/i.test(raw)) type = 'static';
      else if (/动|dynamic/i.test(raw)) type = 'dynamic';
      rows.push({ ip: m[1], mac: m[2], type });
    }
  }
  const same = cidr ? rows.filter((r) => {
    if (!ipInCidr(r.ip, cidr)) return false;
    // Exclude the subnet broadcast (.255) and network (.0) — not real peers.
    if (broadcast && r.ip === broadcast) return false;
    if (network && r.ip === network) return false;
    return true;
  }) : rows;
  return { ok: true, interface: iface, index, rows: same, total: rows.length };
}

function getArpTable(interfaceIp, cidr) {
  return new Promise((resolve) => {
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(interfaceIp || '')) {
      return resolve({ ok: false, error: 'Invalid interface IP' });
    }
    // Windows: scope by interface IP. Others: list all, rely on CIDR filter.
    const cmd = process.platform === 'win32'
      ? `arp -a -N ${interfaceIp}`
      : `arp -an`;
    exec(cmd, { encoding: 'buffer', timeout: 8000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve({ ok: false, error: 'ARP command failed: ' + err.message });
      // GBK is an ASCII superset → decodes English cleanly AND Chinese (静态/动态).
      let text;
      try { text = new TextDecoder('gbk').decode(stdout); }
      catch (e) { text = stdout.toString('latin1'); }
      try { resolve(parseArp(text, cidr)); }
      catch (e) { resolve({ ok: false, error: 'Failed to parse ARP output' }); }
    });
  });
}

module.exports = { getArpTable, parseArp, ipInCidr };
