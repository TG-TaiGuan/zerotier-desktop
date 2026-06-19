'use strict';

/* ============================================================
   ZeroTier Desktop — renderer (master-detail, themed, i18n)
   ============================================================ */

/* ---------- i18n ---------- */
const STRINGS = {
  en: {
    'app.subtitle': 'Local Node',
    'node.connecting': 'connecting',
    'node.waiting': 'waiting for service',
    'node.offline': 'offline',
    'node.online': 'online',
    'node.unavailable': 'service unavailable',
    'node.reconnecting': 'Reconnecting…',
    'node.v': 'v',
    'node.fallback': 'TCP fallback',
    'reconnect.button': 'Reconnect',
    'join.placeholder': 'Join a network — 16 hex chars',
    'join.button': 'Join',
    'join.invalid': 'Network ID must be 16 hex characters.',
    'join.sent': 'Join request sent for ',
    'join.failed': 'Join failed: ',
    'leave.confirm': 'Leave network ',
    'leave.short': 'Leave',
    'leave.done': 'Left ',
    'leave.failed': 'Leave failed: ',
    'networks.title': 'Networks',
    'networks.empty': 'Not joined to any network. Enter a Network ID above to join.',
    'networks.loadError': 'Unable to load networks.',
    'networks.loading': 'Loading networks',
    'detail.empty': 'Select a network to view its neighbors',
    'meta.interface': 'Interface',
    'meta.type': 'Type',
    'meta.mac': 'MAC',
    'meta.mtu': 'MTU',
    'meta.ips': 'Managed IPs',
    'neighbors.title': 'Neighbors (ARP)',
    'arp.addr': 'Internet Address',
    'arp.phys': 'Physical Address',
    'arp.type': 'Type',
    'arp.loading': 'Loading neighbors…',
    'arp.empty': 'No same-subnet neighbors found.',
    'arp.error': 'Unable to read ARP table.',
    'arp.note': 'Same-subnet entries from the OS ARP cache for this interface.',
    'footer.note': 'local control · 127.0.0.1:9993',
    'updated.never': 'not refreshed yet',
    'updated': 'Updated ',
    'interval.off': 'Off',
    'interval.5': '5s', 'interval.10': '10s', 'interval.30': '30s',
    'interval.menuOff': 'Manual (off)',
    'interval.menu5': 'Every 5s', 'interval.menu10': 'Every 10s', 'interval.menu30': 'Every 30s',
    'refresh.now': 'Refresh now',
    'theme.toggle': 'Toggle theme',
    'lang.toggle': 'Switch language',
    'type.static': 'Static', 'type.dynamic': 'Dynamic', 'type.unknown': 'Unknown',
  },
  zh: {
    'app.subtitle': '本地节点',
    'node.connecting': '连接中',
    'node.waiting': '等待服务',
    'node.offline': '离线',
    'node.online': '在线',
    'node.unavailable': '服务不可用',
    'node.reconnecting': '正在重连…',
    'node.v': 'v',
    'node.fallback': 'TCP 回退',
    'reconnect.button': '重新连接',
    'join.placeholder': '加入网络 — 16 位十六进制',
    'join.button': '加入',
    'join.invalid': '网络 ID 必须是 16 位十六进制。',
    'join.sent': '已发送加入请求：',
    'join.failed': '加入失败：',
    'leave.confirm': '离开网络 ',
    'leave.short': '离开',
    'leave.done': '已离开 ',
    'leave.failed': '离开失败：',
    'networks.title': '网络',
    'networks.empty': '尚未加入任何网络。在上方输入网络 ID 加入。',
    'networks.loadError': '无法加载网络。',
    'networks.loading': '正在加载网络',
    'detail.empty': '选择一个网络查看其邻居',
    'meta.interface': '接口',
    'meta.type': '类型',
    'meta.mac': 'MAC',
    'meta.mtu': 'MTU',
    'meta.ips': '托管 IP',
    'neighbors.title': '邻居 (ARP)',
    'arp.addr': 'Internet 地址',
    'arp.phys': '物理地址',
    'arp.type': '类型',
    'arp.loading': '正在加载邻居…',
    'arp.empty': '未找到同子网邻居。',
    'arp.error': '无法读取 ARP 表。',
    'arp.note': '来自该接口系统 ARP 缓存的同子网条目。',
    'footer.note': '本地控制 · 127.0.0.1:9993',
    'updated.never': '尚未刷新',
    'updated': '已更新 ',
    'interval.off': '关闭',
    'interval.5': '5秒', 'interval.10': '10秒', 'interval.30': '30秒',
    'interval.menuOff': '手动（关闭）',
    'interval.menu5': '每 5 秒', 'interval.menu10': '每 10 秒', 'interval.menu30': '每 30 秒',
    'refresh.now': '立即刷新',
    'theme.toggle': '切换主题',
    'lang.toggle': '切换语言',
    'type.static': '静态', 'type.dynamic': '动态', 'type.unknown': '未知',
  },
};

function makeMockBridge() {
  const ok = (data) => Promise.resolve({ ok: true, data });
  return {
    _mock: true,
    getStatus: () => ok({ address: 'a1b2c3d4e5', online: true, version: '1.16.1', tcpFallbackActive: false }),
    getNetworks: () => ok([
      { id: '8056c2e21c434f64', name: 'Demo Network', status: 'OK', type: 'PRIVATE', mac: '66:1f:ea:51:d4:70', mtu: 2800, assignedAddresses: ['10.147.20.5/24'] },
      { id: '8056c2e21cce9e4a', name: 'Office', status: 'OK', type: 'PRIVATE', mac: '4a:ce:67:51:d4:70', mtu: 2800, assignedAddresses: ['172.25.50.160/24'] },
    ]),
    joinNetwork: () => ok({ status: 'REQUESTING_CONFIGURATION' }),
    leaveNetwork: () => ok({}),
    getArp: (_ip, cidr) => {
      const base = (cidr || '10.147.20.0/24').split('/')[0].split('.').slice(0, 3).join('.');
      const rows = [
        { ip: base + '.1', mac: '66-9f-f3-7d-5e-4a', type: 'dynamic' },
        { ip: base + '.12', mac: '66-96-f4-1f-e8-8b', type: 'dynamic' },
        { ip: base + '.88', mac: '66-ec-35-bf-16-cd', type: 'dynamic' },
        { ip: base + '.203', mac: '66-70-34-6e-c0-60', type: 'dynamic' },
      ];
      return ok(rows);
    },
    reportSelfTest: () => {},
  };
}

const ZT = window.zerotier || makeMockBridge();
if (ZT._mock) window.zerotier = ZT; // expose mock for the standalone browser preview / testing
const gsap = window.gsap || null;
const SELFTEST = new URLSearchParams(window.location.search).get('selftest') === '1';
const MO = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const store = (() => { try { return window.localStorage; } catch (e) { return { getItem: () => null, setItem: () => {} }; } })();

let lang = store.getItem('zt.lang') || 'en';
let theme = store.getItem('zt.theme') || 'dark';
let interval = parseInt(store.getItem('zt.interval'), 10); if (isNaN(interval)) interval = 10;

function t(key) { return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key; }

const el = {
  topbar: document.getElementById('topbar'),
  toolbar: document.getElementById('toolbar'),
  nodeStatus: document.getElementById('nodeStatus'),
  statusDot: document.getElementById('statusDot'),
  nodeAddress: document.getElementById('nodeAddress'),
  nodeSub: document.getElementById('nodeSub'),
  joinForm: document.getElementById('joinForm'),
  networkIdInput: document.getElementById('networkIdInput'),
  joinBtn: document.getElementById('joinBtn'),
  refreshNowBtn: document.getElementById('refreshNowBtn'),
  refreshIcon: document.querySelector('#refreshNowBtn .refresh-icon'),
  intervalBtn: document.getElementById('intervalBtn'),
  intervalLabel: document.getElementById('intervalLabel'),
  intervalMenu: document.getElementById('intervalMenu'),
  langBtn: document.getElementById('langBtn'),
  themeBtn: document.getElementById('themeBtn'),
  reconnectBtn: document.getElementById('reconnectBtn'),
  networkSplit: document.getElementById('networkSplit'),
  netItems: document.getElementById('netItems'),
  networkCount: document.getElementById('networkCount'),
  netDetail: document.getElementById('netDetail'),
  footer: document.getElementById('footer'),
  lastUpdated: document.getElementById('lastUpdated'),
  toast: document.getElementById('toast'),
};

const state = { networks: [], selectedId: null, arpToken: 0, online: false };
let pollTimer = null;
let statusTimer = null;
let firstRefreshDone = false;
let pulseTween = null;

/* ---------- utils ---------- */
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function runGsap(fn) { if (!gsap || MO) return; try { fn(); } catch (e) { console.error('gsap error:', e); } }
function shortId(id) { return String(id || '').slice(0, 10); }

/* ---------- i18n apply ---------- */
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = t(node.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-ph]').forEach((node) => { node.placeholder = t(node.getAttribute('data-i18n-ph')); });
  document.querySelectorAll('[data-i18n-title]').forEach((node) => { node.title = t(node.getAttribute('data-i18n-title')); });
  if (el.langBtn) el.langBtn.textContent = lang === 'en' ? '中' : 'EN';
  updateIntervalLabel();
  // re-render dynamic labels for the currently selected network
  if (state.selectedId) {
    const net = state.networks.find((n) => n.id === state.selectedId);
    if (net) renderDetail(net);
  } else {
    showDetailEmpty();
  }
}

/* ---------- theme ---------- */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme);
  if (!el.themeBtn) return;
  const sun = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8"/></svg>';
  const moon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  el.themeBtn.innerHTML = theme === 'dark' ? sun : moon; // icon shows the action's target
}

/* ---------- refresh interval ---------- */
function intervalShort(v) { return v === 0 ? t('interval.off') : t('interval.' + v); }
function updateIntervalLabel() { if (el.intervalLabel) el.intervalLabel.textContent = intervalShort(interval); }
function setPoll() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  // Data-refresh interval (status is always monitored by the heartbeat).
  if (interval > 0) pollTimer = setInterval(refreshData, interval * 1000);
}
function applyInterval(v) {
  interval = v;
  store.setItem('zt.interval', String(v));
  updateIntervalLabel();
  // mark active option
  el.intervalMenu.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', parseInt(b.getAttribute('data-int'), 10) === v);
  });
  setPoll();
}

/* ---------- status dot pulse ---------- */
function setPulse(st) {
  if (pulseTween) { pulseTween.kill(); pulseTween = null; }
  gsap && gsap.set(el.statusDot, { scale: 1, opacity: 1 });
  if (st !== 'online') return;
  runGsap(() => { pulseTween = gsap.to(el.statusDot, { scale: 1.45, opacity: 0.55, duration: 0.9, ease: 'sine.inOut', repeat: -1, yoyo: true, transformOrigin: 'center' }); });
}

/* ---------- toast ---------- */
const ICONS = {
  success: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  error: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>',
};
let toastTimer = null;
function toast(msg, kind) {
  el.toast.innerHTML = '<span class="toast-icon">' + (ICONS[kind] || '') + '</span><span>' + escapeHtml(msg) + '</span>';
  el.toast.className = 'toast' + (kind ? ' ' + kind : '');
  runGsap(() => gsap.to(el.toast, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'back.out(1.6)' }));
  if (!gsap || MO) { el.toast.style.opacity = '1'; el.toast.style.visibility = 'visible'; }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 3200);
}
function hideToast() {
  runGsap(() => gsap.to(el.toast, { autoAlpha: 0, y: 16, duration: 0.3, ease: 'power2.in' }));
  if (!gsap || MO) { el.toast.style.opacity = '0'; el.toast.style.visibility = 'hidden'; }
}

/* ---------- render: node status ---------- */
function applyConnectionState() {
  // Reconnect button shows only when offline; status heartbeat keeps trying to recover.
  if (el.reconnectBtn) el.reconnectBtn.classList.toggle('show', !state.online);
}

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
    el.nodeAddress.textContent = reachable ? (data.address || '—') : t('node.offline');
    el.nodeSub.textContent = reachable ? t('node.offline') : t('node.reconnecting');
  }
  setPulse(online ? 'online' : 'offline');
  applyConnectionState();
  return online;
}

/* ---------- network list ---------- */
function statusPill(status) {
  const st = String(status || '').toUpperCase();
  let cls = 'pill-muted', label = status || 'UNKNOWN';
  if (st === 'OK') { cls = 'pill-ok'; label = 'OK'; }
  else if (st.indexOf('DENIED') >= 0) { cls = 'pill-denied'; label = 'ACCESS DENIED'; }
  else if (st === 'REQUESTING_CONFIGURATION' || st === 'TRYING_CONFIGURATION') { cls = 'pill-warn'; label = 'REQUESTING'; }
  else if (st === 'NOT_FOUND') { cls = 'pill-denied'; label = 'NOT FOUND'; }
  return '<span class="pill ' + cls + '">' + escapeHtml(label) + '</span>';
}
function firstIp(net) { const a = (net.assignedAddresses || [])[0]; return a ? a.split('/')[0] : '—'; }

function buildList(nets) {
  if (nets.length === 0) {
    el.netItems.innerHTML = '<div class="empty">' + escapeHtml(t('networks.empty')) + '</div>';
    return;
  }
  el.netItems.innerHTML = nets.map((n) => {
    const selected = n.id === state.selectedId ? ' selected' : '';
    return (
      '<button class="net-item' + selected + '" data-id="' + escapeHtml(n.id) + '" type="button">' +
        '<span class="net-item-main">' +
          '<span class="net-item-name">' + escapeHtml(n.name || '(unnamed)') + '</span>' +
          '<span class="net-item-sub">' + escapeHtml(firstIp(n)) + ' · ' + escapeHtml(shortId(n.id)) + '</span>' +
        '</span>' +
        '<span class="net-item-status" data-state="' + escapeHtml(String(n.status || '').toLowerCase()) + '"></span>' +
      '</button>'
    );
  }).join('');
}

function renderNetworks(res) {
  if (!res || !res.ok) {
    el.networkCount.textContent = '0';
    el.netItems.innerHTML = '<div class="empty">' + escapeHtml((res && res.error) || t('networks.loadError')) + '</div>';
    showDetailEmpty();
    return false;
  }
  const nets = Array.isArray(res.data) ? res.data : [];
  state.networks = nets;
  el.networkCount.textContent = String(nets.length);

  if (nets.length === 0) {
    state.selectedId = null;
    buildList(nets);
    showDetailEmpty();
    return true;
  }
  const ids = nets.map((n) => n.id);
  let changed = false;
  if (!state.selectedId || ids.indexOf(state.selectedId) < 0) { state.selectedId = nets[0].id; changed = true; }
  buildList(nets);
  animateList();
  if (changed) selectNetwork(state.selectedId);
  return true;
}

/* ---------- selection ---------- */
function selectNetwork(id) {
  const net = state.networks.find((n) => n.id === id);
  if (!net) { showDetailEmpty(); return; }
  state.selectedId = id;
  el.netItems.querySelectorAll('.net-item').forEach((node) => { node.classList.toggle('selected', node.getAttribute('data-id') === id); });
  renderDetail(net);
  loadArp(net, false); // full load (loading state + animation)
}
function showDetailEmpty() {
  el.netDetail.innerHTML =
    '<div class="detail-empty">' +
      '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg>' +
      '<span>' + escapeHtml(t('detail.empty')) + '</span>' +
    '</div>';
}

/* ---------- detail ---------- */
function metaRow(k, v, id) {
  return '<div class="detail-row"><span class="k">' + escapeHtml(k) + '</span>' +
    '<span class="v' + (id ? '" id="' + id : '') + '">' + escapeHtml(v) + '</span></div>';
}
function renderDetail(net) {
  const ips = (net.assignedAddresses && net.assignedAddresses.length) ? net.assignedAddresses.join(', ') : '—';
  const ipOnly = firstIp(net);
  el.netDetail.innerHTML =
    '<div class="detail-scroll">' +
      '<div class="detail-head">' +
        '<div>' +
          '<div class="detail-name">' + escapeHtml(net.name || '(unnamed)') + '</div>' +
          '<div class="detail-id">' + escapeHtml(net.id || '—') + '</div>' +
        '</div>' +
        '<div class="detail-head-right">' +
          statusPill(net.status) +
          '<button class="btn btn-danger btn-sm leave-btn" type="button" data-id="' + escapeHtml(net.id) + '">' + escapeHtml(t('leave.short')) + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="detail-meta">' +
        metaRow(t('meta.interface'), ipOnly + ' --- …', 'detailIfc') +
        metaRow(t('meta.type'), net.type || '—') +
        metaRow(t('meta.mac'), net.mac || '—') +
        metaRow(t('meta.mtu'), String(net.mtu != null ? net.mtu : '—')) +
        metaRow(t('meta.ips'), ips) +
      '</div>' +
      '<div class="arp-section">' +
        '<div class="arp-head">' +
          '<span class="panel-title">' + escapeHtml(t('neighbors.title')) + '</span>' +
          '<div class="arp-head-right">' +
            '<span class="panel-count" id="arpCount">…</span>' +
            '<button class="btn btn-ghost btn-sm arp-refresh" type="button" data-i18n-title="refresh.now" aria-label="Refresh ARP">' +
              '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="arp-wrap">' +
          '<table class="arp-table">' +
            '<thead><tr><th>' + escapeHtml(t('arp.addr')) + '</th><th>' + escapeHtml(t('arp.phys')) + '</th><th>' + escapeHtml(t('arp.type')) + '</th></tr></thead>' +
            '<tbody id="arpBody"><tr><td colspan="3" class="empty">' + escapeHtml(t('arp.loading')) + '</td></tr></tbody>' +
          '</table>' +
        '</div>' +
        '<div class="arp-note">' + escapeHtml(t('arp.note')) + '</div>' +
      '</div>' +
    '</div>';
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
    arpBody.innerHTML = '<tr><td colspan="3" class="empty">' + escapeHtml(t('arp.loading')) + '</td></tr>';
    const c = document.getElementById('arpCount'); if (c) c.textContent = '…';
  }
  const res = await ZT.getArp(ip, cidr);
  if (token !== state.arpToken) return;
  renderArp(res, net, !silent);
}

function renderArp(res, net, animate) {
  const arpBody = document.getElementById('arpBody');
  const arpCount = document.getElementById('arpCount');
  const ifc = document.getElementById('detailIfc');
  if (!arpBody) return;
  if (ifc) {
    const ip = firstIp(net);
    const idx = (res && res.ok && res.index) ? (' --- ' + res.index) : '';
    ifc.textContent = ip + idx;
  }
  if (!res || !res.ok) {
    if (arpCount) arpCount.textContent = '0';
    arpBody.innerHTML = '<tr><td colspan="3" class="empty">' + escapeHtml((res && res.error) || t('arp.error')) + '</td></tr>';
    return;
  }
  const rows = Array.isArray(res.rows) ? res.rows : [];
  if (arpCount) arpCount.textContent = String(rows.length);
  if (rows.length === 0) {
    arpBody.innerHTML = '<tr><td colspan="3" class="empty">' + escapeHtml(t('arp.empty')) + '</td></tr>';
    return;
  }
  arpBody.innerHTML = rows.map((r) =>
    '<tr>' +
      '<td class="mono">' + escapeHtml(r.ip) + '</td>' +
      '<td class="mono">' + escapeHtml(r.mac) + '</td>' +
      '<td><span class="arp-type ' + escapeHtml(r.type) + '">' + escapeHtml(t('type.' + r.type)) + '</span></td>' +
    '</tr>'
  ).join('');
  if (animate) animateArpRows();
}

/* ---------- animations ---------- */
function animateEntrance() {
  runGsap(() => {
    const tl = gsap.timeline();
    tl.from(el.topbar, { y: -18, opacity: 0, duration: 0.6, ease: 'power3.out' })
      .from(el.toolbar, { y: 14, opacity: 0, duration: 0.5, ease: 'power3.out' }, '-=0.35')
      .from(el.networkSplit, { y: 20, opacity: 0, duration: 0.6, ease: 'power3.out' }, '-=0.3')
      .from(el.footer, { opacity: 0, duration: 0.5 }, '-=0.3');
  });
}
function animateList() { runGsap(() => gsap.from('.net-item', { x: -12, opacity: 0, duration: 0.4, ease: 'power2.out', stagger: 0.06 })); }
function animateDetail() { runGsap(() => gsap.from('.detail-scroll > *', { y: 12, opacity: 0, duration: 0.45, ease: 'power2.out', stagger: 0.07 })); }
function animateArpRows() { runGsap(() => gsap.from('#arpBody tr', { opacity: 0, y: 6, duration: 0.3, ease: 'power2.out', stagger: 0.02 })); }

/* ---------- refresh ---------- */
async function refresh() {
  const results = await Promise.all([ZT.getStatus(), ZT.getNetworks()]);
  const [stRes, netRes] = results;
  renderStatus(stRes);
  renderNetworks(netRes);
  try { el.lastUpdated.textContent = t('updated') + new Date().toLocaleTimeString(lang === 'zh' ? 'zh-CN' : undefined); } catch (e) {}
  if (!firstRefreshDone) { firstRefreshDone = true; reportSelfTestIfNeeded(results); }
  return results;
}
function safeRefresh() { refresh().catch((e) => console.error('refresh failed:', e)); }

// Always-on status heartbeat: keeps the dot current and auto-recovers on
// reconnect, even when the data-refresh interval is set to "off".
function refreshStatusOnly() {
  ZT.getStatus().then((res) => {
    const wasOnline = !!state.online;
    renderStatus(res);
    if (state.online && !wasOnline) refreshData(); // recovered -> refresh networks
  }).catch((e) => console.error('status poll failed:', e));
}
function refreshData() {
  return ZT.getNetworks().then(renderNetworks).catch((e) => console.error('networks poll failed:', e));
}

/* ---------- self-test ---------- */
async function reportSelfTestIfNeeded(results) {
  if (!SELFTEST) return;
  const [stRes, netRes] = results;
  const errors = [];
  if (!stRes || !stRes.ok) errors.push('status: ' + ((stRes && stRes.error) || 'failed'));
  if (!netRes || !netRes.ok) errors.push('networks: ' + ((netRes && netRes.error) || 'failed'));
  let arp = null;
  const nets = (netRes && netRes.ok && Array.isArray(netRes.data)) ? netRes.data : [];
  const first = nets[0];
  if (first && (first.assignedAddresses || [])[0]) {
    const full = first.assignedAddresses[0];
    const r = await ZT.getArp(full.split('/')[0], full);
    arp = r.ok ? { rows: r.rows.length, interface: r.interface, index: r.index } : { error: r.error };
    if (!r.ok) errors.push('arp: ' + r.error);
  }
  try {
    ZT.reportSelfTest({ rendered: true, mock: !!ZT._mock, lang, theme, interval,
      online: !!(stRes && stRes.ok && stRes.data && stRes.data.online),
      address: (stRes && stRes.ok && stRes.data && stRes.data.address) || null,
      networks: nets.length, selected: state.selectedId, arp, gsap: !!gsap, errors });
  } catch (e) { console.error('reportSelfTest failed:', e); }
}

/* ---------- actions ---------- */
async function onJoin(evt) {
  evt.preventDefault();
  const id = el.networkIdInput.value.trim();
  if (!/^[0-9a-fA-F]{16}$/.test(id)) { toast(t('join.invalid'), 'error'); return; }
  el.joinBtn.disabled = true;
  const res = await ZT.joinNetwork(id);
  el.joinBtn.disabled = false;
  if (res && res.ok) { el.networkIdInput.value = ''; toast(t('join.sent') + id, 'success'); safeRefresh(); }
  else { toast(t('join.failed') + ((res && res.error) || 'unknown'), 'error'); }
}
async function onLeave(id) {
  if (!id) return;
  let confirmed = true;
  try { confirmed = window.confirm(t('leave.confirm') + id + '?'); } catch (e) { confirmed = true; }
  if (!confirmed) return;
  const res = await ZT.leaveNetwork(id);
  if (res && res.ok) { if (state.selectedId === id) state.selectedId = null; toast(t('leave.done') + id, 'success'); safeRefresh(); }
  else { toast(t('leave.failed') + ((res && res.error) || 'unknown'), 'error'); }
}
function spinRefreshIcon(sel) { runGsap(() => gsap.fromTo(sel, { rotation: 0 }, { rotation: 360, duration: 0.7, ease: 'power2.inOut', transformOrigin: 'center' })); }

/* ---------- wiring ---------- */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  applyLang();
  applyInterval(interval);
  animateEntrance();

  el.joinForm.addEventListener('submit', onJoin);

  el.netItems.addEventListener('click', (e) => {
    const item = e.target.closest('.net-item');
    if (item) selectNetwork(item.getAttribute('data-id'));
  });
  el.netItems.addEventListener('mouseover', (e) => {
    const item = e.target.closest('.net-item');
    if (item && !item.classList.contains('selected')) runGsap(() => gsap.to(item, { x: 3, duration: 0.2, ease: 'power2.out' }));
  });
  el.netItems.addEventListener('mouseout', (e) => {
    const item = e.target.closest('.net-item');
    if (item) runGsap(() => gsap.to(item, { x: 0, duration: 0.25, ease: 'power3.out' }));
  });

  el.netDetail.addEventListener('click', (e) => {
    if (e.target.closest('.arp-refresh')) {
      const net = state.networks.find((n) => n.id === state.selectedId);
      if (net) { spinRefreshIcon('.arp-refresh svg'); loadArp(net, true); }
    }
    const leaveBtn = e.target.closest('.leave-btn');
    if (leaveBtn) onLeave(leaveBtn.getAttribute('data-id'));
  });

  el.refreshNowBtn.addEventListener('click', () => {
    spinRefreshIcon(el.refreshIcon);
    el.refreshNowBtn.disabled = true;
    safeRefresh();
    setTimeout(() => { el.refreshNowBtn.disabled = false; }, 700);
  });

  // interval dropdown
  el.intervalBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !el.intervalMenu.hidden;
    el.intervalMenu.hidden = open;
    el.intervalBtn.setAttribute('aria-expanded', String(!open));
  });
  el.intervalMenu.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-int]');
    if (!b) return;
    applyInterval(parseInt(b.getAttribute('data-int'), 10));
    el.intervalMenu.hidden = true;
    el.intervalBtn.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('click', () => { el.intervalMenu.hidden = true; el.intervalBtn.setAttribute('aria-expanded', 'false'); });

  // theme + language toggles
  el.themeBtn.addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; store.setItem('zt.theme', theme); applyTheme(); });
  el.langBtn.addEventListener('click', () => { lang = lang === 'en' ? 'zh' : 'en'; store.setItem('zt.lang', lang); applyLang(); });

  // manual reconnect (auto-recovery is also handled by the status heartbeat)
  el.reconnectBtn.addEventListener('click', () => {
    spinRefreshIcon(el.refreshIcon);
    el.reconnectBtn.disabled = true;
    safeRefresh();
    setTimeout(() => { el.reconnectBtn.disabled = false; }, 800);
  });

  safeRefresh();
  statusTimer = setInterval(refreshStatusOnly, 5000); // always-on connection monitor
  setPoll();
});

window.addEventListener('beforeunload', () => { if (pollTimer) clearInterval(pollTimer); if (statusTimer) clearInterval(statusTimer); });
