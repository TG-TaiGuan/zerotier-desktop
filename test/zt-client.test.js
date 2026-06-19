'use strict';

/* Non-GUI test: exercises the ZeroTier API client directly against the local
 * zerotier-one service. Produces a concrete pass/fail result with runtime
 * output. Run with:  npm test
 */

const assert = require('assert');
const zt = require('../src/zt-client');

(async () => {
  console.log('--- zt-client test ---');

  const tok = zt.loadAuthToken();
  if (!tok.ok) {
    console.error('SKIP: auth token not found (' + (tok.error || '') + ').');
    console.error('Tried: ' + JSON.stringify(tok.tried));
    process.exit(0); // not a failure of the code, just no service to test against
  }
  console.log('auth token loaded from:', tok.path);

  const st = await zt.getStatus();
  assert.ok(st.ok, 'getStatus should succeed: ' + (st.error || ''));
  assert.ok(typeof st.data.address === 'string' && /^[0-9a-fA-F]{10}$/.test(st.data.address),
    'address should be 10 hex chars, got: ' + st.data.address);
  assert.ok('online' in st.data, 'status should include online flag');
  console.log('status OK -> address=%s online=%s version=%s', st.data.address, st.data.online, st.data.version);

  const net = await zt.getNetworks();
  assert.ok(net.ok, 'getNetworks should succeed: ' + (net.error || ''));
  assert.ok(Array.isArray(net.data), 'networks should be an array');
  console.log('networks OK -> count=%d', net.data.length);

  const peers = await zt.getPeers();
  assert.ok(peers.ok, 'getPeers should succeed: ' + (peers.error || ''));
  assert.ok(Array.isArray(peers.data), 'peers should be an array');
  console.log('peers OK -> count=%d', peers.data.length);

  // Validation guard: invalid IDs must be rejected without hitting the service.
  const badJoin = await zt.joinNetwork('nothex');
  assert.ok(!badJoin.ok, 'join with invalid id must fail');
  const badLeave = await zt.leaveNetwork('short');
  assert.ok(!badLeave.ok, 'leave with invalid id must fail');
  console.log('input validation OK');

  console.log('\nALL TESTS PASSED');
})().catch((e) => {
  console.error('\nTEST FAILED:', e.message);
  process.exit(1);
});
