'use strict';

/**
 * ZeroTier local-control API client.
 *
 * The zerotier-one service exposes a JSON control API on 127.0.0.1:9993 over
 * PLAIN HTTP (not HTTPS). Every request must carry the X-ZT1-Auth header with
 * the contents of the service's authtoken.secret file.
 *
 * Every public method resolves to { ok, data?, error?, ... } and NEVER throws,
 * so callers (main-process IPC handlers) can forward results straight to the
 * renderer without try/catching network failures.
 */

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = 9993;
const TIMEOUT_MS = 6000;

/**
 * Locations zerotier-one may store its auth token, by platform. The per-user
 * ~/.zeroTierOneAuthToken copy is checked last as a fallback.
 */
function candidateTokenPaths() {
  const userCopy = path.join(os.homedir(), '.zeroTierOneAuthToken');
  switch (process.platform) {
    case 'win32':
      return ['C:\\ProgramData\\ZeroTier\\One\\authtoken.secret', userCopy];
    case 'darwin':
      return ['/Library/Application Support/ZeroTier/One/authtoken.secret', userCopy];
    default:
      return ['/var/lib/zerotier-one/authtoken.secret', userCopy];
  }
}

let cachedToken = null; // string | null
let cachedTokenPath = null;

/** Read (and cache) the auth token from the first path that exists. */
function loadAuthToken(force) {
  if (cachedToken && !force) {
    return { ok: true, token: cachedToken, path: cachedTokenPath };
  }
  const tried = [];
  for (const p of candidateTokenPaths()) {
    try {
      const tok = fs.readFileSync(p, 'utf8').trim();
      if (tok) {
        cachedToken = tok;
        cachedTokenPath = p;
        return { ok: true, token: tok, path: p };
      }
    } catch (e) {
      tried.push(`${p} (${e.code || e.message})`);
    }
  }
  return {
    ok: false,
    error: 'authtoken.secret not found. Is zerotier-one installed?',
    tried,
  };
}

/** Low-level request helper. Always resolves, never rejects. */
function request(apiPath, options) {
  options = options || {};
  const method = options.method || 'GET';

  const tokenResult = loadAuthToken();
  if (!tokenResult.ok) return Promise.resolve(tokenResult);

  return new Promise((resolve) => {
    const headers = { 'X-ZT1-Auth': tokenResult.token };
    let payload = null;
    if (options.body !== undefined) {
      payload = JSON.stringify(options.body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      { host: HOST, port: PORT, path: apiPath, method, headers, timeout: TIMEOUT_MS },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          const status = res.statusCode;
          if (status === 401 || status === 403) {
            cachedToken = null; // token may have rotated; retry next call
          }
          if (status && status >= 200 && status < 300) {
            let parsed;
            try {
              parsed = data ? JSON.parse(data) : {};
            } catch (e) {
              return resolve({ ok: false, error: 'Invalid JSON from service', raw: data.slice(0, 200) });
            }
            return resolve({ ok: true, data: parsed, tokenPath: tokenResult.path });
          }
          resolve({
            ok: false,
            error: `Service responded HTTP ${status}`,
            status,
            raw: data.slice(0, 200),
          });
        });
      }
    );

    req.on('error', (e) => {
      resolve({
        ok: false,
        error: `Cannot reach zerotier-one: ${e.message}`,
        code: e.code,
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Request timed out — is zerotier-one running on port 9993?' });
    });

    if (payload) req.write(payload);
    req.end();
  });
}

function isValidNetworkId(id) {
  return typeof id === 'string' && /^[0-9a-fA-F]{16}$/.test(id.trim());
}

module.exports = {
  loadAuthToken,
  getStatus: () => request('/status'),
  getNetworks: () => request('/network'),
  getPeers: () => request('/peer'),
  joinNetwork: (id) => {
    if (!isValidNetworkId(id)) {
      return Promise.resolve({ ok: false, error: 'Network ID must be 16 hex characters.' });
    }
    return request(`/network/${id.trim()}`, { method: 'POST' });
  },
  leaveNetwork: (id) => {
    if (!isValidNetworkId(id)) {
      return Promise.resolve({ ok: false, error: 'Network ID must be 16 hex characters.' });
    }
    return request(`/network/${id.trim()}`, { method: 'DELETE' });
  },
  isValidNetworkId,
  _request: request,
};
