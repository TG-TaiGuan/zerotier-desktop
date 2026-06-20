'use strict';

/* ============================================================
   ZeroTier Desktop — renderer (ZeroTier Central-style UI)
   ============================================================ */

const STRINGS = {
  en: {
    'networks.title': 'Networks', 'networks.empty': 'Not joined to any network. Enter a Network ID above to join.', 'networks.loadError': 'Unable to load networks.',
    'detail.empty': 'Select a network to view its neighbors',
    'meta.id': 'NETWORK ID', 'meta.type': 'Type', 'meta.ips': 'Managed IPs',
    'stat.neighbors': 'Neighbors', 'stat.iface': 'Interface', 'stat.mtu': 'MTU',
    'neighbors.title': 'Neighbors (ARP)',
    'node.connecting': 'connecting', 'node.offline': 'offline', 'node.online': 'online', 'node.reconnecting': 'Reconnecting…', 'node.v': 'v', 'node.fallback': 'TCP fallback',
    'join.placeholder': 'Join a network — 16 hex chars', 'join.button': 'Join', 'join.invalid': 'Network ID must be 16 hex characters.', 'join.sent': 'Join request sent for ', 'join.failed': 'Join failed: ', 'join.exists': 'Already joined — showing it',
    'leave.short': 'Leave', 'leave.confirm': 'Leave network ', 'leave.done': 'Left ', 'leave.failed': 'Leave failed: ', 'leave.rejoin': 'Reconnect', 'leave.hint': 'You left this network — click Reconnect to reconnect.',
    'arp.addr': 'Internet Address', 'arp.phys': 'Physical Address', 'arp.type': 'Type', 'arp.loading': 'Loading neighbors…', 'arp.empty': 'No same-subnet neighbors found.', 'arp.error': 'Unable to read ARP table.', 'arp.note': "Same-subnet entries from this interface's OS ARP cache.",
    'refresh.now': 'Refresh now', 'theme.toggle': 'Toggle theme', 'lang.toggle': 'Switch language',
    'reconnect.button': 'Reconnect',
    'type.static': 'Static', 'type.dynamic': 'Dynamic', 'type.unknown': 'Unknown',
    'about.title': 'About', 'about.text': 'A tiny desktop client for the local zerotier-one service — view your networks and same-subnet neighbors, and join or leave networks.',
    'quit': 'Quit', 'quit.confirm': 'Close ZeroTier Desktop?',
    'close.title': 'Close window', 'close.sub': 'Minimize to the taskbar, or exit the app?', 'close.remember': 'Remember my choice', 'close.minimize': 'Minimize', 'close.exit': 'Exit',
    'settings.title': 'Settings', 'common.cancel': 'Cancel', 'common.done': 'Done', 'settings.closeBehavior': 'Default behavior when closing the window', 'settings.ask': 'Ask every time',
    'allow.managed': 'Allow Managed Addresses', 'allow.global': 'Allow Global IPs', 'allow.default': 'Allow Default Route', 'allow.dns': 'Allow DNS', 'allow.fail': 'Failed to update setting.',
  },
  zh: {
    'networks.title': '网络', 'networks.empty': '尚未加入任何网络。在上方输入网络 ID 加入。', 'networks.loadError': '无法加载网络。',
    'detail.empty': '选择一个网络查看其邻居',
    'meta.id': '网络 ID', 'meta.type': '类型', 'meta.ips': '托管 IP',
    'stat.neighbors': '邻居', 'stat.iface': '接口', 'stat.mtu': 'MTU',
    'neighbors.title': '邻居 (ARP)',
    'node.connecting': '连接中', 'node.offline': '离线', 'node.online': '在线', 'node.reconnecting': '正在重连…', 'node.v': 'v', 'node.fallback': 'TCP 回退',
    'join.placeholder': '加入网络 — 16 位十六进制', 'join.button': '加入', 'join.invalid': '网络 ID 必须是 16 位十六进制。', 'join.sent': '已发送加入请求：', 'join.failed': '加入失败：', 'join.exists': '已加入该网络',
    'leave.short': '离开', 'leave.confirm': '离开网络 ', 'leave.done': '已离开 ', 'leave.failed': '离开失败：', 'leave.rejoin': '重新连接', 'leave.hint': '你已离开此网络 —— 点击「重新连接」即可重连。',
    'arp.addr': 'Internet 地址', 'arp.phys': '物理地址', 'arp.type': '类型', 'arp.loading': '正在加载邻居…', 'arp.empty': '未找到同子网邻居。', 'arp.error': '无法读取 ARP 表。', 'arp.note': '来自该接口系统 ARP 缓存的同子网条目。',
    'refresh.now': '立即刷新', 'theme.toggle': '切换主题', 'lang.toggle': '切换语言',
    'reconnect.button': '重新连接',
    'type.static': '静态', 'type.dynamic': '动态', 'type.unknown': '未知',
    'about.title': '关于', 'about.text': '本地 zerotier-one 服务的轻量桌面客户端 —— 查看你的网络和同子网邻居，加入或离开网络。',
    'quit': '退出', 'quit.confirm': '关闭 ZeroTier Desktop？',
    'close.title': '关闭窗口', 'close.sub': '最小化到任务栏，还是退出程序？', 'close.remember': '记住我的选择', 'close.minimize': '最小化', 'close.exit': '退出',
    'settings.title': '设置', 'common.cancel': '取消', 'common.done': '完成', 'settings.closeBehavior': '关闭窗口时的默认行为', 'settings.ask': '每次询问',
    'allow.managed': '允许托管地址', 'allow.global': '允许全局 IP', 'allow.default': '允许默认路由', 'allow.dns': '允许 DNS', 'allow.fail': '更新设置失败。',
  },
};

function makeMockBridge() {
  const ok = (data) => Promise.resolve({ ok: true, data });
  const NETS = [
    { id: '8056c2e21c434f64', name: 'my-first-network', status: 'OK', type: 'PRIVATE', mac: '66:1f:ea:51:d4:70', mtu: 2800, assignedAddresses: ['10.147.20.5/24'], allowManaged: true, allowGlobal: false, allowDefault: false, allowDNS: true },
    { id: '8056c2e21cce9e4a', name: 'office', status: 'OK', type: 'PRIVATE', mac: '4a:ce:67:51:d4:70', mtu: 2800, assignedAddresses: ['172.25.50.160/24'], allowManaged: true, allowGlobal: true, allowDefault: false, allowDNS: true },
  ];
  const left = new Set();
  return {
    _mock: true,
    getStatus: () => ok({ address: 'a1b2c3d4e5', online: true, version: '1.16.1', tcpFallbackActive: false }),
    getNetworks: () => ok(NETS.filter((n) => !left.has(n.id))),
    joinNetwork: (id) => { left.delete(id); return ok({ status: 'OK' }); },
    leaveNetwork: (id) => { left.add(id); return ok({}); },
    setNetFlag: (id, key, value) => { const n = NETS.find((x) => x.id === id); if (n) n[key] = value; return ok({}); },
    getVersion: () => Promise.resolve('1.1.0'),
    getArp: (ip, cidr) => {
      const base = (cidr || '10.147.20.0/24').split('/')[0].split('.').slice(0, 3).join('.');
      const rows = [
        { ip: base + '.1', mac: '66-9f-f3-7d-5e-4a', type: 'dynamic' },
        { ip: base + '.12', mac: '66-96-f4-1f-e8-8b', type: 'dynamic' },
        { ip: base + '.88', mac: '66-ec-35-bf-16-cd', type: 'dynamic' },
        { ip: base + '.203', mac: '66-70-34-6e-c0-60', type: 'static' },
      ];
      return Promise.resolve({ ok: true, rows, interface: ip, index: '0xf' });
    },
    reportSelfTest: () => {},
  };
}

const _invoke = (window.__TAURI__ && window.__TAURI__.core) ? window.__TAURI__.core.invoke : null;
const ZT = _invoke ? {
  getStatus: () => _invoke('get_status'),
  getNetworks: () => _invoke('get_networks'),
  joinNetwork: (id) => _invoke('join_network', { id }),
  leaveNetwork: (id) => _invoke('leave_network', { id }),
  setNetFlag: (id, key, value) => _invoke('set_net_flag', { id, key, value }),
  getVersion: () => _invoke('get_app_version'),
  getArp: (ip, cidr) => _invoke('get_arp', { ip, cidr }),
} : makeMockBridge();
if (ZT._mock) window.zerotier = ZT;

// Best-effort log to the backend file (logs/latest.log). No-op in the browser mock
// preview. Tagged [ui] so it interleaves with the backend [zt]/[arp] lines.
function dlog(msg) { if (_invoke) { try { _invoke('log_frontend', { msg: String(msg) }); } catch (e) {} } }

const gsap = window.gsap || null;
const SELFTEST = new URLSearchParams(window.location.search).get('selftest') === '1';
const MO = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const store = (() => { try { return window.localStorage; } catch (e) { return { getItem: () => null, setItem: () => {} }; } })();

let lang = store.getItem('zt.lang') || 'en';
let theme = store.getItem('zt.theme') || 'light';
function t(key) { return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key; }
function loadLeft() { try { return JSON.parse(store.getItem('zt.leftNets') || '[]'); } catch (e) { return []; } }
function saveLeft() { store.setItem('zt.leftNets', JSON.stringify(state.left)); }

const el = {
  themeBtn: document.getElementById('themeBtn'),
  langBtn: document.getElementById('langBtn'),
  aboutBtn: document.getElementById('aboutBtn'),
  aboutModal: document.getElementById('aboutModal'),
  aboutClose: document.getElementById('aboutClose'),
  closeModal: document.getElementById('closeModal'),
  closeMinimize: document.getElementById('closeMinimize'),
  closeExit: document.getElementById('closeExit'),
  closeRemember: document.getElementById('closeRemember'),
  quitBtn: document.getElementById('quitBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  settingsClose: document.getElementById('settingsClose'),
  settingsOptions: document.getElementById('settingsOptions'),
  aboutVersion: document.getElementById('aboutVersion'),
  quitModal: document.getElementById('quitModal'),
  quitConfirm: document.getElementById('quitConfirm'),
  quitCancel: document.getElementById('quitCancel'),
  crumbNet: document.getElementById('crumbNet'),
  nodeStatus: document.getElementById('nodeStatus'),
  statusDot: document.getElementById('statusDot'),
  nodeAddress: document.getElementById('nodeAddress'),
  nodeSub: document.getElementById('nodeSub'),
  refreshNowBtn: document.getElementById('refreshNowBtn'),
  netTabs: document.getElementById('netTabs'),
  joinForm: document.getElementById('joinForm'),
  networkIdInput: document.getElementById('networkIdInput'),
  joinBtn: document.getElementById('joinBtn'),
  detail: document.getElementById('detail'),
  toast: document.getElementById('toast'),
};

const state = { networks: [], selectedId: null, online: false, arpToken: 0, left: loadLeft() };
let firstRefreshDone = false;
let pulseTween = null;

function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function runGsap(fn) { if (!gsap || MO) return; try { fn(); } catch (e) { console.error('gsap error:', e); } }
function shortId(id) { return String(id || '').slice(0, 10); }
function firstIp(net) { const a = (net.assignedAddresses || [])[0]; return a ? a.split('/')[0] : '—'; }

/* ---------- i18n / theme ---------- */
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-ph]').forEach((n) => { n.placeholder = t(n.getAttribute('data-i18n-ph')); });
  document.querySelectorAll('[data-i18n-title]').forEach((n) => { n.title = t(n.getAttribute('data-i18n-title')); });
  if (el.langBtn) el.langBtn.textContent = lang === 'en' ? '中' : 'EN';
}
function toggleLang() {
  lang = lang === 'en' ? 'zh' : 'en';
  store.setItem('zt.lang', lang);
  if (!gsap || MO) { applyLang(); return; }
  // fade the content, swap text at low opacity, fade back — masks the instant relabel
  gsap.to('.content', { opacity: 0.35, duration: 0.1, ease: 'power2.in', onComplete: () => {
    applyLang();
    gsap.fromTo('.content', { opacity: 0.35 }, { opacity: 1, duration: 0.18, ease: 'power2.out' });
  } });
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme);
  if (!el.themeBtn) return;
  const sun = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8"/></svg>';
  const moon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  el.themeBtn.innerHTML = theme === 'dark' ? sun : moon;
}

/* ---------- connection / pulse / toast ---------- */
function applyConnectionState() {}
function setPulse(st) {
  if (pulseTween) { pulseTween.kill(); pulseTween = null; }
  gsap && gsap.set(el.statusDot, { scale: 1, opacity: 1 });
  if (st !== 'online') return;
  runGsap(() => { pulseTween = gsap.to(el.statusDot, { scale: 1.5, opacity: 0.5, duration: 0.9, ease: 'sine.inOut', repeat: -1, yoyo: true, transformOrigin: 'center' }); });
}
const ICONS = {
  success: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  error: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>',
};
let toastTimer = null;
function toast(msg, kind) {
  el.toast.innerHTML = '<span class="toast-icon">' + (ICONS[kind] || '') + '</span><span>' + escapeHtml(msg) + '</span>';
  el.toast.className = 'toast' + (kind ? ' ' + kind : '');
  runGsap(() => gsap.to(el.toast, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' }));
  if (!gsap || MO) { el.toast.style.opacity = '1'; el.toast.style.visibility = 'visible'; el.toast.style.transform = 'translateX(-50%)'; }
  clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 3000);
}
function hideToast() {
  runGsap(() => gsap.to(el.toast, { autoAlpha: 0, y: 16, duration: 0.25, ease: 'power2.in' }));
  if (!gsap || MO) { el.toast.style.opacity = '0'; el.toast.style.visibility = 'hidden'; }
}

/* ---------- status ---------- */
function renderStatus(res) {
  const reachable = !!(res && res.ok);
  const data = reachable ? (res.data || {}) : {};
  const online = reachable && !!data.online;
  state.online = online;
  el.nodeStatus.dataset.state = online ? 'online' : 'offline';
  if (online) {
    el.nodeAddress.textContent = data.address || '—';
    const parts = [];
    if (data.version) parts.push(t('node.v') + data.version);
    if (data.tcpFallbackActive) parts.push(t('node.fallback'));
    parts.push(t('node.online'));
    el.nodeSub.textContent = parts.join(' · ');
  } else {
    el.nodeAddress.textContent = reachable ? (data.address || t('node.offline')) : t('node.offline');
    el.nodeSub.textContent = reachable ? t('node.offline') : t('node.reconnecting');
  }
  setPulse(online ? 'online' : 'offline');
  applyConnectionState();
}

/* ---------- pills / tabs ---------- */
function statusPill(status) {
  const st = String(status || '').toUpperCase();
  let cls = 'pill-muted', label = status || 'UNKNOWN';
  if (st === 'OK') { cls = 'pill-ok'; label = 'OK'; }
  else if (st === 'LEFT') { cls = 'pill-denied'; label = t('node.offline').toUpperCase(); }
  else if (st.indexOf('DENIED') >= 0) { cls = 'pill-denied'; label = 'ACCESS DENIED'; }
  else if (st === 'REQUESTING_CONFIGURATION' || st === 'TRYING_CONFIGURATION') { cls = 'pill-warn'; label = 'REQUESTING'; }
  else if (st === 'NOT_FOUND') { cls = 'pill-denied'; label = 'NOT FOUND'; }
  return '<span class="pill ' + cls + '">' + escapeHtml(label) + '</span>';
}
function buildTabs(nets) {
  if (nets.length === 0) { el.netTabs.innerHTML = ''; return; }
  el.netTabs.innerHTML = nets.map((n) => {
    const sel = n.id === state.selectedId ? ' active' : '';
    const st = n.left ? 'left' : String(n.status || '').toLowerCase();
    const xTitle = n.left ? t('leave.short') : t('leave.short');
    return '<button class="tab' + sel + '" type="button" data-id="' + escapeHtml(n.id) + '" data-state="' + escapeHtml(st) + '">' +
      '<span class="tdot"></span>' + escapeHtml(n.name || shortId(n.id)) +
      '<span class="leave-x" data-id="' + escapeHtml(n.id) + '" data-left="' + (n.left ? '1' : '') + '" title="' + escapeHtml(xTitle) + '" role="button" tabindex="-1">×</span>' +
    '</button>';
  }).join('');
}
function renderNetworks(res) {
  let nets = [];
  if (res && res.ok && Array.isArray(res.data)) nets = res.data.slice();
  state.networks = nets;
  const liveIds = nets.map((n) => n.id);
  // history (left) networks not currently joined
  const left = state.left.filter((l) => liveIds.indexOf(l.id) < 0).map((l) => ({ id: l.id, name: l.name, status: 'LEFT', left: true, assignedAddresses: [], mac: '—', mtu: null, type: '—' }));
  const all = nets.concat(left);

  if (all.length === 0) { state.selectedId = null; buildTabs(all); showDetailEmpty(t('networks.empty')); return true; }
  const ids = all.map((n) => n.id);
  let changed = false;
  if (!state.selectedId || ids.indexOf(state.selectedId) < 0) { state.selectedId = all[0].id; changed = true; }
  buildTabs(all);
  animateTabs();
  if (changed) selectNetwork(state.selectedId);
  return true;
}

/* ---------- selection / detail ---------- */
function selectNetwork(id) {
  const all = state.networks.concat(state.left.filter((l) => !state.networks.some((n) => n.id === l.id)).map((l) => ({ ...l, left: true, status: 'LEFT' })));
  const net = all.find((n) => n.id === id);
  if (!net) { showDetailEmpty(); return; }
  state.selectedId = id;
  el.netTabs.querySelectorAll('.tab').forEach((tb) => { tb.classList.toggle('active', tb.getAttribute('data-id') === id); });
  if (el.crumbNet) el.crumbNet.textContent = net.name || shortId(net.id);
  if (net.left) renderLeftDetail(net);
  else { renderDetail(net); loadArp(net, false); }
}
function showDetailEmpty(msg) {
  el.detail.innerHTML = '<div class="placeholder">' + escapeHtml(msg || t('detail.empty')) + '</div>';
  if (el.crumbNet) el.crumbNet.textContent = '—';
}

const SVG = {
  neighbors: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="12" cy="18" r="2.2"/><path d="M7.6 7.4l3.2 8.4M16.4 7.4l-3.2 8.4M8 6h8"/></svg>',
  iface: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  mtu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
};
// The four per-network "Allow" toggles from ZeroTier Central (top-level booleans
// on the /network/<id> object). Toggled via set_net_flag -> POST /network/<id>.
const ALLOWS = [
  { key: 'allowManaged', i18n: 'allow.managed', icon: '<svg class="al-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><line x1="7" y1="7" x2="7.01" y2="7"/><line x1="7" y1="17" x2="7.01" y2="17"/></svg>' },
  { key: 'allowGlobal', i18n: 'allow.global', icon: '<svg class="al-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></svg>' },
  { key: 'allowDefault', i18n: 'allow.default', icon: '<svg class="al-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2"/><path d="M8 18h7a4 4 0 0 0 0-8H9"/><path d="M15 7l3 3-3 3"/></svg>' },
  { key: 'allowDNS', i18n: 'allow.dns', icon: '<svg class="al-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="7" y1="14" x2="14" y2="14"/></svg>' },
];
function statCard(labelKey, valHtml, hint, svg, id) {
  return '<div class="stat"><div class="lbl">' + svg + ' <span data-i18n="' + labelKey + '">' + escapeHtml(t(labelKey)) + '</span></div><div class="val' + (id ? '" id="' + id : '') + '">' + valHtml + '</div><div class="hint">' + (hint || '') + '</div></div>';
}
function renderDetail(net) {
  const ips = (net.assignedAddresses && net.assignedAddresses.length) ? net.assignedAddresses.join(', ') : '—';
  const allowsHtml = '<div class="allows">' + ALLOWS.map((a) => {
    const on = !!(net[a.key]);
    return '<button class="allow-card' + (on ? ' on' : '') + '" type="button" data-allow="' + a.key + '" data-id="' + escapeHtml(net.id || '') + '">' +
      a.icon + '<span class="al-label" data-i18n="' + a.i18n + '">' + escapeHtml(t(a.i18n)) + '</span>' +
      '<svg class="al-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></button>';
  }).join('') + '</div>';
  el.detail.innerHTML =
    '<div class="net-head"><div>' +
      '<h1>' + escapeHtml(net.name || '(unnamed)') + ' ' + statusPill(net.status) + '</h1>' +
      '<div class="net-id"><span class="meta" data-i18n="meta.id">NETWORK ID</span><code>' + escapeHtml(net.id || '—') + '</code></div>' +
      '<div class="updated"><span data-i18n="meta.type">Type</span>: ' + escapeHtml(net.type || '—') + ' · <span data-i18n="meta.ips">Managed IPs</span>: <span class="mono">' + escapeHtml(ips) + '</span></div>' +
    '</div>' +
    '<button class="btn danger btn-sm leave-btn" type="button" data-id="' + escapeHtml(net.id) + '" data-i18n="leave.short">Leave</button></div>' +
    '<div class="stats">' +
      statCard('stat.neighbors', '…', escapeHtml(t('arp.note')), SVG.neighbors, 'statNeighbors') +
      statCard('stat.iface', escapeHtml(firstIp(net) + ' --- …'), escapeHtml(net.mac || '—'), SVG.iface, 'detailIfc') +
      statCard('stat.mtu', escapeHtml(String(net.mtu != null ? net.mtu : '—')), escapeHtml(t('meta.type')) + ': ' + escapeHtml(net.type || '—'), SVG.mtu) +
    '</div>' +
    allowsHtml +
    '<div class="members">' +
      '<div class="mhead"><h3>' + SVG.neighbors + ' <span data-i18n="neighbors.title">Neighbors (ARP)</span></h3><span class="count" id="arpCount">…</span></div>' +
      '<table><thead><tr><th data-i18n="arp.addr">Internet Address</th><th data-i18n="arp.phys">Physical Address</th><th data-i18n="arp.type">Type</th></tr></thead>' +
      '<tbody id="arpBody"><tr class="empty-row"><td colspan="3" data-i18n="arp.loading">Loading neighbors…</td></tr></tbody></table>' +
    '</div>' +
    '<div class="arp-note" data-i18n="arp.note">' + escapeHtml(t('arp.note')) + '</div>';
  animateDetail();
}
function renderLeftDetail(net) {
  el.detail.innerHTML =
    '<div class="net-head"><div>' +
      '<h1>' + escapeHtml(net.name || shortId(net.id)) + ' ' + statusPill('LEFT') + '</h1>' +
      '<div class="net-id"><span class="meta" data-i18n="meta.id">NETWORK ID</span><code>' + escapeHtml(net.id) + '</code></div>' +
      '<div class="updated">' + escapeHtml(t('leave.hint')) + '</div>' +
    '</div>' +
    '<button class="btn primary btn-sm rejoin-btn" type="button" data-id="' + escapeHtml(net.id) + '">' + escapeHtml(t('leave.rejoin')) + '</button></div>' +
    '<div class="placeholder">' + escapeHtml(t('leave.hint')) + '</div>';
  animateDetail();
}

/* ---------- ARP ---------- */
async function loadArp(net, silent) {
  const token = ++state.arpToken;
  const ip = firstIp(net);
  const cidr = (net.assignedAddresses || [])[0] || '';
  const arpBody = document.getElementById('arpBody');
  if (!arpBody) return;
  if (!silent) {
    arpBody.innerHTML = '<tr class="empty-row"><td colspan="3">' + escapeHtml(t('arp.loading')) + '</td></tr>';
    const c = document.getElementById('arpCount'); if (c) c.textContent = '…';
    const sn = document.getElementById('statNeighbors'); if (sn) sn.textContent = '…';
  }
  const res = await ZT.getArp(ip, cidr);
  if (token !== state.arpToken) return;
  renderArp(res, net, !silent);
}
function renderArp(res, net, animate) {
  const arpBody = document.getElementById('arpBody');
  const arpCount = document.getElementById('arpCount');
  const statNeighbors = document.getElementById('statNeighbors');
  const ifc = document.getElementById('detailIfc');
  if (!arpBody) return;
  if (ifc) { const ip = firstIp(net); const idx = (res && res.ok && res.index) ? (' --- ' + res.index) : ''; ifc.textContent = ip + idx; }
  if (!res || !res.ok) {
    if (arpCount) arpCount.textContent = '0';
    if (statNeighbors) statNeighbors.textContent = '0';
    arpBody.innerHTML = '<tr class="empty-row"><td colspan="3">' + escapeHtml((res && res.error) || t('arp.error')) + '</td></tr>';
    return;
  }
  const rows = Array.isArray(res.rows) ? res.rows : [];
  if (arpCount) arpCount.textContent = String(rows.length);
  if (statNeighbors) statNeighbors.textContent = String(rows.length);
  if (rows.length === 0) { arpBody.innerHTML = '<tr class="empty-row"><td colspan="3">' + escapeHtml(t('arp.empty')) + '</td></tr>'; return; }
  arpBody.innerHTML = rows.map((r) => {
    const online = r.type === 'dynamic';
    return '<tr>' +
      '<td><div class="node"><span class="dot ' + (online ? 'online' : 'offline') + '"></span><div class="mono">' + escapeHtml(r.ip) + '</div></div></td>' +
      '<td class="sub-mono">' + escapeHtml(r.mac) + '</td>' +
      '<td><span class="badge ' + escapeHtml(r.type) + '">' + escapeHtml(t('type.' + r.type)) + '</span></td>' +
    '</tr>';
  }).join('');
  if (animate) animateRows();
}

/* ---------- animations ---------- */
function animateEntrance() {
  runGsap(() => {
    const tl = gsap.timeline();
    tl.from('.side', { x: -20, opacity: 0, duration: 0.5, ease: 'power3.out' })
      .from('.topbar', { y: -12, opacity: 0, duration: 0.45, ease: 'power3.out' }, '-=0.3')
      .from('.content > *', { y: 14, opacity: 0, duration: 0.5, ease: 'power2.out', stagger: 0.08 }, '-=0.25');
  });
}
function animateTabs() { runGsap(() => gsap.from('.tab', { y: 8, opacity: 0, duration: 0.35, ease: 'power2.out', stagger: 0.05 })); }
function animateDetail() { runGsap(() => gsap.fromTo('#detail', { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' })); }
function animateRows() { runGsap(() => gsap.from('#arpBody tr', { opacity: 0, y: 6, duration: 0.3, ease: 'power2.out', stagger: 0.02 })); }

/* ---------- refresh ---------- */
async function refresh() {
  const results = await Promise.all([ZT.getStatus(), ZT.getNetworks()]);
  const [stRes, netRes] = results;
  renderStatus(stRes);
  renderNetworks(netRes);
  if (!firstRefreshDone) { firstRefreshDone = true; reportSelfTestIfNeeded(results); }
  return results;
}
function safeRefresh() { refresh().catch((e) => console.error('refresh failed:', e)); }
function refreshStatusOnly() {
  ZT.getStatus().then((res) => { const was = !!state.online; renderStatus(res); if (state.online !== was) dlog('node ' + (state.online ? 'ONLINE' : 'OFFLINE')); if (state.online && !was) recover(); }).catch((e) => console.error('status poll failed:', e));
}
// Full refresh + reload the selected network's ARP — used after reconnect/recovery
// so the UI reflects the restored state without a manual refresh.
function recover() {
  refresh().then(() => { const net = state.networks.find((n) => n.id === state.selectedId); if (net && !net.left) loadArp(net, true); }).catch(() => {});
}
function refreshData() { return ZT.getNetworks().then(renderNetworks).catch((e) => console.error('networks poll failed:', e)); }

/* ---------- self-test ---------- */
async function reportSelfTestIfNeeded(results) {
  if (!SELFTEST) return;
  const [stRes, netRes] = results;
  const errors = [];
  if (!stRes || !stRes.ok) errors.push('status: ' + ((stRes && stRes.error) || 'failed'));
  if (!netRes || !netRes.ok) errors.push('networks: ' + ((netRes && netRes.error) || 'failed'));
  try { ZT.reportSelfTest({ rendered: true, mock: !!ZT._mock, lang, theme, online: state.online, networks: (netRes && netRes.ok && Array.isArray(netRes.data)) ? netRes.data.length : 0, selected: state.selectedId, gsap: !!gsap, errors }); }
  catch (e) { console.error('reportSelfTest failed:', e); }
}

/* ---------- actions ---------- */
async function onJoin(evt) {
  if (evt) evt.preventDefault();
  const id = el.networkIdInput.value.trim();
  if (!/^[0-9a-fA-F]{16}$/.test(id)) { toast(t('join.invalid'), 'error'); return; }
  if (state.networks.some((n) => n.id === id)) {
    el.networkIdInput.value = '';
    dlog('join ' + id + ' - already joined, switching to it');
    toast(t('join.exists'), 'success');
    selectNetwork(id);
    return;
  }
  dlog('join ' + id + ' - sending POST...');
  el.joinBtn.disabled = true;
  const res = await ZT.joinNetwork(id);
  el.joinBtn.disabled = false;
  if (res && res.ok) {
    dlog('join ' + id + ' - POST ok, polling until it appears');
    el.networkIdInput.value = '';
    state.left = state.left.filter((l) => l.id !== id); saveLeft();
    toast(t('join.sent') + id, 'success');
    waitForNetwork(id, 6); // poll until it shows up, then open it
  } else { dlog('join ' + id + ' - FAILED: ' + ((res && res.error) || 'unknown')); toast(t('join.failed') + ((res && res.error) || 'unknown'), 'error'); }
}
// Poll the network list until `id` is not just present but READY — it has a
// managed IP or reports OK. Selecting too early (right after the join POST)
// renders an unnamed network with no IPs until you switch away and back.
function waitForNetwork(id, tries) {
  let n = tries;
  const ready = (net) => !!(net && ((net.assignedAddresses && net.assignedAddresses.length) || String(net.status || '').toUpperCase() === 'OK'));
  const tick = () => {
    ZT.getNetworks().then((res) => {
      renderNetworks(res);
      const net = res && res.ok && Array.isArray(res.data) && res.data.find((x) => x.id === id);
      if (net && ready(net)) { dlog('waitForNetwork ' + id + ' - ready, selecting'); selectNetwork(id); }
      else if (n-- <= 0) { dlog('waitForNetwork ' + id + ' - timed out, selecting anyway'); selectNetwork(id); }
      else setTimeout(tick, 900);
    }).catch((e) => { dlog('waitForNetwork ' + id + ' - poll error: ' + e); if (n-- > 0) setTimeout(tick, 900); else selectNetwork(id); });
  };
  tick();
}
function netName(id) { const n = state.networks.find((x) => x.id === id); return n ? n.name : (state.left.find((x) => x.id === id) || {}).name; }
async function onLeave(id) {
  if (!id) return;
  let confirmed = true;
  try { confirmed = window.confirm(t('leave.confirm') + id + '?'); } catch (e) { confirmed = true; }
  if (!confirmed) return;
  dlog('leave ' + id + ' - sending DELETE...');
  const res = await ZT.leaveNetwork(id);
  if (res && res.ok) {
    dlog('leave ' + id + ' - ok, cached to history');
    const name = netName(id);
    if (!state.left.some((l) => l.id === id)) { state.left.push({ id, name }); saveLeft(); }
    toast(t('leave.done') + id, 'success'); safeRefresh();
  } else { dlog('leave ' + id + ' - FAILED: ' + ((res && res.error) || 'unknown')); toast(t('leave.failed') + ((res && res.error) || 'unknown'), 'error'); }
}
async function onRejoin(id) {
  if (!id) return;
  dlog('rejoin ' + id + ' - sending POST...');
  const res = await ZT.joinNetwork(id);
  if (res && res.ok) { dlog('rejoin ' + id + ' - ok'); state.left = state.left.filter((l) => l.id !== id); saveLeft(); toast(t('join.sent') + id, 'success'); waitForNetwork(id, 6); }
  else { dlog('rejoin ' + id + ' - FAILED: ' + ((res && res.error) || 'unknown')); toast(t('join.failed') + ((res && res.error) || 'unknown'), 'error'); }
}
function forgetLeft(id) { state.left = state.left.filter((l) => l.id !== id); saveLeft(); if (state.selectedId === id) state.selectedId = null; safeRefresh(); }

// Toggle one of the four Allow flags. Optimistic flip + pop animation; reverts on failure.
function toggleAllow(id, key, btn) {
  const net = state.networks.find((n) => n.id === id);
  const cur = !!(net && net[key]);
  const next = !cur;
  dlog('allow ' + key + ' -> ' + next + ' (net ' + id + ')');
  btn.classList.toggle('on', next);
  runGsap(() => gsap.fromTo(btn, { scale: 0.94 }, { scale: 1, duration: 0.28, ease: 'back.out(2.2)' }));
  ZT.setNetFlag(id, key, next).then((res) => {
    if (res && res.ok) {
      if (net) net[key] = next;
      // ZeroTier commits the change on its side; re-fetch shortly after so the cards
      // reflect what the service actually holds (syncs without a manual refresh).
      setTimeout(syncAllowCards, 250);
    } else {
      btn.classList.toggle('on', cur);
      toast(t('allow.fail'), 'error');
    }
  });
}
// Re-fetch networks and refresh the allow cards' on/off state in place (no full re-render).
function syncAllowCards() {
  ZT.getNetworks().then((res) => {
    renderNetworks(res);
    const net = state.networks.find((n) => n.id === state.selectedId);
    if (!net) return;
    document.querySelectorAll('.allow-card').forEach((card) => { card.classList.toggle('on', !!net[card.getAttribute('data-allow')]); });
  }).catch(() => {});
}

/* ---------- about / quit / settings ---------- */
function openAbout() { el.aboutModal.classList.add('show'); }
function closeAbout() { el.aboutModal.classList.remove('show'); }
// Sync the About version from the backend (Cargo.toml version), mock fallback "1.1.0".
function syncAboutVersion() {
  if (!el.aboutVersion) return;
  ZT.getVersion().then((v) => { if (v) el.aboutVersion.textContent = 'v' + v + ' · unofficial'; }).catch(() => {});
}
// Sidebar Quit opens a styled confirm instead of the raw browser confirm().
function openQuit() { el.quitModal.classList.add('show'); }
function closeQuit() { el.quitModal.classList.remove('show'); }
function doQuit() {
  closeQuit();
  dlog('quit confirmed');
  if (_invoke) { _invoke('quit_app'); }
  else { try { window.close(); } catch (e) {} }
}
// Settings: the remembered close-window behavior (minimize / exit / ask).
function openSettings() {
  const pref = store.getItem('zt.closeAction') || 'ask';
  el.settingsOptions.querySelectorAll('input[name="closeAction"]').forEach((r) => { r.checked = (r.value === pref); });
  el.settingsModal.classList.add('show');
}
function closeSettings() { el.settingsModal.classList.remove('show'); }

/* ---------- wiring ---------- */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  applyLang();
  animateEntrance();

  el.joinForm.addEventListener('submit', onJoin);

  el.netTabs.addEventListener('click', (e) => {
    const x = e.target.closest('.leave-x');
    if (x) { e.stopPropagation(); if (x.getAttribute('data-left') === '1') forgetLeft(x.getAttribute('data-id')); else onLeave(x.getAttribute('data-id')); return; }
    const tab = e.target.closest('.tab');
    if (tab) selectNetwork(tab.getAttribute('data-id'));
  });
  el.detail.addEventListener('click', (e) => {
    const ac = e.target.closest('.allow-card'); if (ac) return toggleAllow(ac.getAttribute('data-id'), ac.getAttribute('data-allow'), ac);
    const lb = e.target.closest('.leave-btn'); if (lb) return onLeave(lb.getAttribute('data-id'));
    const rj = e.target.closest('.rejoin-btn'); if (rj) return onRejoin(rj.getAttribute('data-id'));
  });

  el.refreshNowBtn.addEventListener('click', () => {
    runGsap(() => gsap.fromTo(el.refreshNowBtn.querySelector('svg'), { rotation: 0 }, { rotation: 360, duration: 0.7, ease: 'power2.inOut', transformOrigin: 'center' }));
    // Re-render the selected network's detail (not just ARP) so a name/IPs that
    // arrived late — e.g. right after a join/reconnect — actually show without
    // having to switch networks away and back.
    refresh().then(() => selectNetwork(state.selectedId)).catch(() => {});
  });
  el.themeBtn.addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; store.setItem('zt.theme', theme); applyTheme(); });
  el.langBtn.addEventListener('click', toggleLang);

  el.aboutBtn.addEventListener('click', openAbout);
  el.aboutClose.addEventListener('click', closeAbout);
  el.aboutModal.addEventListener('click', (e) => { if (e.target === el.aboutModal) closeAbout(); });
  el.quitBtn.addEventListener('click', openQuit);
  el.settingsBtn.addEventListener('click', openSettings);
  el.settingsClose.addEventListener('click', closeSettings);
  el.settingsModal.addEventListener('click', (e) => { if (e.target === el.settingsModal) closeSettings(); });
  el.settingsOptions.addEventListener('change', (e) => {
    const v = e.target.value;
    if (v === 'ask') store.removeItem('zt.closeAction'); else store.setItem('zt.closeAction', v);
    dlog('close preference -> ' + v);
  });
  el.quitConfirm.addEventListener('click', doQuit);
  el.quitCancel.addEventListener('click', closeQuit);
  el.quitModal.addEventListener('click', (e) => { if (e.target === el.quitModal) closeQuit(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeAbout(); el.closeModal.classList.remove('show'); closeQuit(); closeSettings(); } });
  syncAboutVersion();

  // window close (titlebar X) → minimize-to-tray or exit, with a remembered choice
  const TAPI = window.__TAURI__ && window.__TAURI__.event;
  if (TAPI && TAPI.listen) {
    TAPI.listen('close-requested', () => {
      const pref = store.getItem('zt.closeAction');
      if (pref === 'minimize') return _invoke('minimize_to_tray');
      if (pref === 'exit') return _invoke('quit_app');
      el.closeRemember.checked = false;
      el.closeModal.classList.add('show');
    });
  }
  el.closeMinimize.addEventListener('click', () => {
    if (el.closeRemember.checked) store.setItem('zt.closeAction', 'minimize');
    dlog('close → minimize (remember=' + el.closeRemember.checked + ')');
    el.closeModal.classList.remove('show');
    if (_invoke) _invoke('minimize_to_tray');
  });
  el.closeExit.addEventListener('click', () => {
    if (el.closeRemember.checked) store.setItem('zt.closeAction', 'exit');
    dlog('close → exit (remember=' + el.closeRemember.checked + ')');
    el.closeModal.classList.remove('show');
    if (_invoke) _invoke('quit_app');
  });
  el.closeModal.addEventListener('click', (e) => { if (e.target === el.closeModal) el.closeModal.classList.remove('show'); });

  safeRefresh();
  dlog('ui ready lang=' + lang + ' theme=' + theme + ' mock=' + !!ZT._mock);
});
