'use strict';
// Standalone manual test for screenlink-server.js (commands-only, no
// screen share / WebRTC). Not node:test format, so it isn't picked up
// by `npm test`. Run directly with:
//   cd server && npm i --no-save socket.io-client && node test/screenlink-server.manual-test.js
const http = require('http');
const assert = require('assert');
const { io: connect } = require('socket.io-client');
const { attachScreenLink } = require('../screenlink-server');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (s, ev, ms = 1500) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('timeout waiting for ' + ev)), ms);
  s.once(ev, (d) => { clearTimeout(t); res(d); });
});
const never = async (s, ev, ms = 250) => {
  let got = false;
  const h = () => { got = true; };
  s.on(ev, h); await wait(ms); s.off(ev, h);
  assert.strictEqual(got, false, `${ev} should NOT have been received`);
};

(async () => {
  const server = http.createServer();
  const sl = attachScreenLink(server, { hostGraceMs: 300, joinAttempts: { max: 4, windowMs: 5000 } });
  await new Promise((r) => server.listen(0, r));
  const url = `http://localhost:${server.address().port}`;
  const mk = () => connect(url, { transports: ['websocket'], forceNew: true });
  const sockets = [];
  const client = async () => { const s = mk(); sockets.push(s); await once(s, 'connect'); return s; };

  // 1. host + viewer basics
  const host = await client(), viewer = await client(), stranger = await client();
  host.emit('host:create', {});
  const { code } = await once(host, 'host:code');
  assert.match(code, /^\d{6}$/);
  const joined = once(host, 'viewer:joined');
  viewer.emit('viewer:join', { code, name: 'bob' });
  await once(viewer, 'viewer:ok');
  const { viewerId } = await joined;
  assert.strictEqual(viewerId, viewer.id);
  console.log('ok  host create + viewer join');

  // 3. open-url forwards popup fields, rejects javascript:
  const ou = once(host, 'cmd:open-url');
  viewer.emit('cmd:open-url', { url: 'https://example.com', mode: 'popup', width: 800, height: 600, left: 5, top: 6, windowTarget: 'other' });
  const got = await ou;
  assert.deepStrictEqual(got, { viewerId: viewer.id, url: 'https://example.com/', mode: 'popup', width: 800, height: 600, left: 5, top: 6, windowTarget: 'other' });
  viewer.emit('cmd:open-url', { url: 'javascript:alert(1)' });
  await never(host, 'cmd:open-url');
  console.log('ok  open-url payload + scheme filter');

  // 4. host->viewers relays only from host
  const tab = once(viewer, 'host:tab-opened');
  host.emit('host:tab-opened', { tabId: 't1', url: 'https://a.b', mode: 'tab' });
  assert.deepStrictEqual(await tab, { tabId: 't1', url: 'https://a.b', mode: 'tab' });
  viewer.emit('host:info', { status: 'spoofed' });
  await never(viewer, 'host:info');
  console.log('ok  host relays, spoof blocked');

  // 5. password + allow-list + public list
  const host2 = await client();
  host2.emit('host:create', { passwordHash: 'abc123' });
  const c2 = (await once(host2, 'host:code')).code;
  host2.emit('host:set-restrictions', { allowedViewers: ['alice'] });
  host2.emit('host:set-public', { isPublic: true, label: 'Demo' });
  await wait(100);
  const v2 = await client();
  v2.emit('viewer:join', { code: c2, passwordHash: 'nope', name: 'alice' });
  assert.strictEqual((await once(v2, 'viewer:error')).wrongPassword, true);
  v2.emit('viewer:join', { code: c2, passwordHash: 'abc123', name: 'mallory' });
  assert.match((await once(v2, 'viewer:error')).message, /not authorized/);
  v2.emit('viewer:get-public', { name: 'mallory' });
  assert.deepStrictEqual(await once(v2, 'public:list'), []);
  v2.emit('viewer:get-public', { name: 'alice' });
  const list = await once(v2, 'public:list');
  assert.strictEqual(list.length, 1); assert.strictEqual(list[0].hasPassword, true);
  v2.emit('viewer:join-public', { code: c2, name: 'alice' });          // no password -> blocked
  assert.strictEqual((await once(v2, 'viewer:error')).wrongPassword, true);
  v2.emit('viewer:join', { code: c2, passwordHash: 'abc123', name: 'ALICE' });
  await once(v2, 'viewer:ok');
  console.log('ok  password, allow-list, public list');

  // 6. brute-force lockout
  const brute = await client();
  for (let i = 0; i < 4; i++) { brute.emit('viewer:join', { code: '000000' }); await once(brute, 'viewer:error'); }
  brute.emit('viewer:join', { code });
  assert.match((await once(brute, 'viewer:error')).message, /Too many/);
  console.log('ok  join lockout');

  // 7. garbage payloads must not crash the process
  for (const ev of ['host:create', 'host:join', 'viewer:join', 'cmd:open-url', 'cmd:input', 'host:set-public', 'cmd:file-start']) {
    stranger.emit(ev); stranger.emit(ev, null); stranger.emit(ev, 'str'); stranger.emit(ev, [1, 2]); stranger.emit(ev, { code: {}, url: {}, to: [] });
  }
  await wait(150);
  assert.strictEqual(stranger.connected, true);
  console.log('ok  malformed payloads survived');

  // 8. refresh: keeps code with viewers, rotates without
  host.emit('host:refresh');
  assert.strictEqual((await once(host, 'host:code')).code, code);
  const host3 = await client();
  host3.emit('host:create', {});
  const c3 = (await once(host3, 'host:code')).code;
  host3.emit('host:refresh');
  const c3b = (await once(host3, 'host:code')).code;
  assert.notStrictEqual(c3, c3b);
  console.log('ok  host:refresh');

  // 9. host drop -> viewers told, then session expires after grace
  const sid = (await (async () => { host.emit('host:refresh'); return once(host, 'host:code'); })()).sessionId;
  const dc = once(viewer, 'host:disconnected');
  host.disconnect();
  await dc;
  // reconnect inside the grace window keeps the session
  const hostBack = await client();
  hostBack.emit('host:join', { sessionId: sid });
  assert.strictEqual((await once(hostBack, 'host:code')).code, code);
  await wait(450);
  assert.ok(sl.stats().some((s) => s.code === code), 'session should survive reconnect');
  const exp = once(viewer, 'session:expired');
  hostBack.disconnect();
  await exp;
  console.log('ok  host disconnect/reconnect/expiry');

  // 10. attach to an existing io on a custom namespace
  const { Server } = require('socket.io');
  const server2 = http.createServer();
  const io2 = new Server(server2);
  const sl2 = attachScreenLink(io2, { namespace: '/screenlink' });
  await new Promise((r) => server2.listen(0, r));
  const n = connect(`http://localhost:${server2.address().port}/screenlink`, { transports: ['websocket'], forceNew: true });
  await once(n, 'connect');
  n.emit('host:create', {});
  assert.match((await once(n, 'host:code')).code, /^\d{6}$/);
  n.close(); await sl2.close(); io2.close(); server2.close();
  console.log('ok  existing io + custom namespace');

  sockets.forEach((s) => s.close());
  await sl.close(); server.close();
  console.log('\nALL PASSED');
  process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
