'use strict';

/**
 * Preload — the ONLY bridge between the sandboxed renderer and the main process.
 *
 * The renderer receives a tiny, explicit API on window.zerotier. It can never
 * see the auth token, never touch the network directly, and can only invoke the
 * five whitelisted operations below (each of which returns { ok, ... }).
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zerotier', {
  getStatus: () => ipcRenderer.invoke('zt:status'),
  getNetworks: () => ipcRenderer.invoke('zt:networks'),
  getPeers: () => ipcRenderer.invoke('zt:peers'),
  joinNetwork: (id) => ipcRenderer.invoke('zt:join', String(id || '')),
  leaveNetwork: (id) => ipcRenderer.invoke('zt:leave', String(id || '')),
  getArp: (ip, cidr) => ipcRenderer.invoke('zt:arp', String(ip || ''), String(cidr || '')),
  reportSelfTest: (summary) => ipcRenderer.send('selftest:report', summary),
});
