'use strict';

/**
 * Electron main process.
 *
 * Responsibilities:
 *  - Create the BrowserWindow with strict security defaults.
 *  - Expose ZeroTier operations to the renderer through sandboxed IPC.
 *  - Support a deterministic `--selftest` mode that boots the app, renders real
 *    data, prints a structured report, and exits — so the app can be validated
 *    headlessly (test result, runtime output) without manual GUI inspection.
 */

const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const zt = require('./zt-client');
const arp = require('./arp');

const SELFTEST =
  process.argv.includes('--selftest') || process.env.ZT_SELFTEST === '1';
// Screenshot mode: renderer still reports after first render; main then captures
// full-width + narrow PNGs (to SHOT_DIR) before quitting, for visual review.
const SCREENSHOT =
  process.argv.includes('--shot') || process.env.ZT_SHOT === '1';
const REPORT = SELFTEST || SCREENSHOT;

// capturePage needs software compositing to be reliable in some GPU setups;
// force it for screenshot runs only (normal runs keep GPU acceleration).
if (SCREENSHOT) {
  app.disableHardwareAcceleration();
}

// ---------------------------------------------------------------------------
// IPC handlers — every handler resolves to { ok, ... } and never rejects,
// so the renderer's awaited calls can't throw on network/auth failures.
// ---------------------------------------------------------------------------
function registerHandler(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      return { ok: false, error: (e && e.message) ? e.message : String(e) };
    }
  });
}

registerHandler('zt:status', () => zt.getStatus());
registerHandler('zt:networks', () => zt.getNetworks());
registerHandler('zt:peers', () => zt.getPeers());
registerHandler('zt:join', (id) => zt.joinNetwork(id));
registerHandler('zt:leave', (id) => zt.leaveNetwork(id));
registerHandler('zt:arp', (ip, cidr) => arp.getArpTable(ip, cidr));

// ---------------------------------------------------------------------------
// Self-test: the renderer sends a report after its first render. We also
// collect renderer-side problems (console errors, crashes, load failures) so
// the test genuinely verifies "no errors during app activity".
// ---------------------------------------------------------------------------
let selftestExitCode = 0;
let selftestWatchdog = null;
const selftestErrors = [];

function finishSelftest(code) {
  if (!REPORT) return;
  if (selftestWatchdog) clearTimeout(selftestWatchdog);
  selftestExitCode = code;
  process.exitCode = code;
  // app.exit guarantees termination even if a GPU/service teardown hangs.
  app.exit(code);
}

function attachSelfTestListeners(webContents) {
  webContents.on('console-message', (_e, level, message, line, sourceId) => {
    const tag = level >= 2 ? 'ERROR' : (level === 1 ? 'WARN' : 'log');
    console.log(`[selftest] renderer ${tag}: ${message} (${sourceId}:${line})`);
    if (level >= 2) selftestErrors.push(`renderer console error: ${message}`);
  });
  webContents.on('render-process-gone', (_e, details) => {
    console.log('[selftest] render-process-gone:', JSON.stringify(details));
    selftestErrors.push('renderer process gone: ' + (details && details.reason));
    finishSelftest(3);
  });
  webContents.on('did-fail-load', (_e, errorCode, errorDescription) => {
    console.log(`[selftest] did-fail-load: ${errorCode} ${errorDescription}`);
    selftestErrors.push('failed to load renderer: ' + errorDescription);
    finishSelftest(3);
  });
}

async function captureShots(win) {
  const dir = process.env.SHOT_DIR;
  if (!dir || !win) { console.log('[shot] no SHOT_DIR or window'); return []; }
  const problems = [];
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ignore */ }

  await new Promise((r) => setTimeout(r, 950)); // let entrance animations settle

  const full = await win.webContents.capturePage();
  fs.writeFileSync(path.join(dir, 'full.png'), full.toPNG());
  const fs2 = full.getSize();
  console.log('[shot] wrote full.png ' + fs2.width + 'x' + fs2.height);

  // Narrow viewport to exercise the responsive layout.
  win.setContentSize(420, 860);
  await new Promise((r) => setTimeout(r, 750));
  const narrow = await win.webContents.capturePage();
  fs.writeFileSync(path.join(dir, 'narrow.png'), narrow.toPNG());
  console.log('[shot] wrote narrow.png ' + narrow.getSize().width + 'x' + narrow.getSize().height);

  return problems;
}

ipcMain.on('selftest:report', async (_event, summary) => {
  console.log('[selftest] renderer report:', JSON.stringify(summary));
  const rendererErrors = (summary && Array.isArray(summary.errors)) ? summary.errors : [];
  let allErrors = rendererErrors.concat(selftestErrors);
  if (SCREENSHOT) {
    try { await captureShots(mainWindow); }
    catch (e) { console.log('[shot] capture failed: ' + e.message); allErrors.push('shot: ' + e.message); }
  }
  if (allErrors.length) {
    console.log('[selftest] problems: ' + JSON.stringify(allErrors));
  }
  finishSelftest(allErrors.length ? 1 : 0);
});

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 760,
    minHeight: 520,
    backgroundColor: '#0f1420',
    title: 'ZeroTier Desktop',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const loadOpts = REPORT ? { query: { selftest: '1' } } : undefined;
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'), loadOpts);

  if (REPORT) attachSelfTestListeners(mainWindow.webContents);

  mainWindow.on('closed', () => { mainWindow = null; });
  return mainWindow;
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
async function runMainSideSelfCheck() {
  // Independently verify the API client from the main process.
  const st = await zt.getStatus();
  const net = await zt.getNetworks();
  console.log('[selftest] main status:',
    st.ok ? `address=${st.data.address} online=${st.data.online} v=${st.data.version}` : `FAIL ${st.error}`);
  console.log('[selftest] main networks:',
    net.ok ? `count=${net.data.length}` : `FAIL ${net.error}`);
}

app.whenReady().then(async () => {
  // Remove the application menu entirely so Alt no longer pops a menu bar.
  Menu.setApplicationMenu(null);

  if (REPORT) {
    console.log('[selftest] starting (electron ' + process.versions.electron + ', node ' + process.versions.node +
      (SCREENSHOT ? ' +screenshot' : '') + ')');
    await runMainSideSelfCheck();
    // Hard cap so a stuck renderer can never hang the run.
    selftestWatchdog = setTimeout(() => {
      console.log('[selftest] TIMEOUT waiting for renderer report');
      finishSelftest(2);
    }, SCREENSHOT ? 25000 : 15000);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  if (SELFTEST && selftestExitCode) process.exitCode = selftestExitCode;
});
