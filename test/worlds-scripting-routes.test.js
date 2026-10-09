'use strict';
// worlds.js with real server scripts running: the HTTP routes, the live stream, and RemoteEvents.
// Run with:  npm test

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const mountWorlds = require('../worlds');

const db = {
  users: {
    ann: { username: 'Ann', seals: 100 },
    bob: { username: 'Bob', seals: 100 }
  },
  worlds: []
};

let server, base;

function makeApp() {
  const app = express();
  app.use(express.json());
  // Test sign-in: the x-user header is the session, x-admin marks Tier 4.
  app.use((req, res, next) => { req.session = { user: req.get('x-user') || null, admin: req.get('x-admin') === '1' }; next(); });
  mountWorlds(app, {
    readDB: () => db,
    writeDB: () => {},
    requireLogin: (req, res, next) => (req.session.user ? next() : res.status(401).json({ error: 'Sign in.' })),
    requireTier4: (req, res, next) => (req.session.user && req.session.admin ? next() : res.status(403).json({ error: 'Tier 4 only.' })),
    isTier4: u => !!u,
    audit: () => {},
    avatarColor: r => '#45d6c8'
  });
  return app;
}

function call(method, path, user, body, admin) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = http.request(base + path, {
      method,
      headers: Object.assign({ 'content-type': 'application/json' }, user ? { 'x-user': user } : {}, admin ? { 'x-admin': '1' } : {})
    }, res => {
      let text = '';
      res.on('data', c => { text += c; });
      res.on('end', () => { let json = {}; try { json = JSON.parse(text); } catch { /* not JSON */ } resolve({ status: res.statusCode, json }); });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Opens the live stream and collects events by name.
function openStream(worldId, user) {
  const events = [];
  const waiters = [];
  let buf = '';
  const req = http.get(base + '/api/worlds/' + worldId + '/stream', { headers: { 'x-user': user } });
  req.on('response', res => {
    res.setEncoding('utf8');
    res.on('data', chunk => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const m = /^event: (.+)\ndata: (.+)$/m.exec(block);
        if (m) { events.push({ name: m[1], data: JSON.parse(m[2]) }); for (const w of waiters.slice()) w(); }
      }
    });
  });
  const find = (name, pred) => events.find(e => e.name === name && (!pred || pred(e.data)));
  return {
    events, find,
    until(name, pred, ms = 4000) {
      return new Promise((resolve, reject) => {
        const t0 = Date.now();
        const check = () => {
          const e = find(name, pred);
          if (e) { waiters.splice(waiters.indexOf(check), 1); return resolve(e.data); }
          if (Date.now() - t0 > ms) { waiters.splice(waiters.indexOf(check), 1); return reject(new Error('Timed out waiting for ' + name + '. Got: ' + events.map(x => x.name).join(','))); }
        };
        waiters.push(check);
        check();
        const iv = setInterval(() => { if (!waiters.includes(check)) return clearInterval(iv); check(); }, 50);
      });
    },
    close() { req.destroy(); }
  };
}

test.before(async () => {
  server = makeApp().listen(0);
  await new Promise(r => server.on('listening', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => { server.close(); server.closeAllConnections && server.closeAllConnections(); });

const SERVER_SCRIPT = `
  const Ping = Remote.event('Ping');
  const Pong = Remote.event('Pong');
  players.onJoin(function (p) {
    p.speed = 2; p.scale = 1.5; p.title = 'Hi'; p.color = '#ff0000';
    p.setAttribute('coins', 3);
    p.teleport(300, 300);
    console.log('joined', p.name);
  });
  Ping.onServerEvent(function (player, a, b) { Pong.fireClient(player, a + b, player.name); });
  Remote.event('Freeze').onServerEvent(function (player) { player.frozen = true; });
  Remote.event('Build').onServerEvent(function () { const o = world.addObject({ kind: 'rock', x: 500, y: 500, w: 60, h: 60 }); Pong.fireAllClients('built', o.id); });
`;

test('only Tier 4 can read or write scripts, and bad scripts are refused', async () => {
  const w = await call('POST', '/api/worlds', 'Ann', { name: 'Script Land', template: 'blank' }, true);
  assert.equal(w.status, 200);
  const id = w.json.id;
  assert.equal((await call('PUT', `/api/worlds/${id}/scripts`, 'Bob', { scripts: [] }, false)).status, 403);
  assert.equal((await call('PUT', `/api/worlds/${id}/scripts`, 'Ann', { scripts: 'nope' }, true)).status, 400);
  assert.equal((await call('PUT', `/api/worlds/${id}/scripts`, 'Ann', { scripts: [{ side: 'both', source: '' }] }, true)).status, 400);
  const huge = await call('PUT', `/api/worlds/${id}/scripts`, 'Ann', { scripts: [{ side: 'server', source: 'x'.repeat(30000) }] }, true);
  assert.equal(huge.status, 400);
  const ok = await call('PUT', `/api/worlds/${id}/scripts`, 'Ann', { scripts: [
    { name: 'Main', side: 'server', source: SERVER_SCRIPT },
    { name: 'Cam', side: 'client', source: 'camera.zoom = 2;' },
    { name: 'Off', side: 'client', enabled: false, source: 'console.log("no")' },
    { name: 'Typo', side: 'server', enabled: false, source: 'let = = 1' }
  ] }, true);
  assert.equal(ok.status, 200);
  assert.equal(ok.json.warnings.length, 1);
  assert.equal(ok.json.warnings[0].name, 'Typo');
  assert.equal(ok.json.world.scripted, true);
  const got = await call('GET', `/api/worlds/${id}/scripts`, 'Ann', undefined, true);
  assert.equal(got.json.scripts.length, 4);
  db.testWorld = id;
});

test('server scripts change the player; clients get the right scripts and state', async () => {
  const id = db.testWorld;
  const s = openStream(id, 'Ann');
  try {
    const hello = await s.until('hello');
    assert.deepEqual(hello.scripts.map(x => x.name), ['Cam'], 'only enabled client scripts are sent');
    assert.ok(hello.world.obstacles.every(o => typeof o.id === 'string') || hello.world.obstacles.length === 0);
    assert.equal(hello.you.e, 0);

    const tp = await s.until('tp');
    assert.equal(tp.e, 1);
    assert.ok(Math.abs(tp.x - 300) < 2 && Math.abs(tp.y - 300) < 2);
    const attr = await s.until('attr', a => a.k === 'coins');
    assert.deepEqual(attr, { n: 'Ann', k: 'coins', v: 3 });

    // the public player list carries the scripted look
    const st = await s.until('state', d => d.players.some(p => p.n === 'Ann' && p.m === 2 && p.z === 1.5 && p.l === 'Hi' && p.c === '#ff0000'));
    const me = st.players.find(p => p.n === 'Ann');
    assert.equal(me.z, 1.5); assert.equal(me.l, 'Hi'); assert.equal(me.c, '#ff0000');

    // a move with the pre-teleport epoch is ignored; the right epoch works
    const stale = await call('POST', `/api/worlds/${id}/move`, 'Ann', { x: 10, y: 10, e: 0 });
    assert.equal(stale.json.e, 1);
    assert.ok(Math.abs(stale.json.x - 300) < 2, 'stale move must not move the player');

    // client -> server -> client
    assert.equal((await call('POST', `/api/worlds/${id}/remote`, 'Ann', { n: 'Ping', a: [2, 5] })).status, 200);
    const pong = await s.until('remote', r => r.n === 'Pong' && r.a[1] === 'Ann');
    assert.deepEqual(pong.a, [7, 'Ann']);

    // the sender can't be spoofed, bad input is refused
    assert.equal((await call('POST', `/api/worlds/${id}/remote`, 'Ann', { n: 'bad name!', a: [] })).status, 400);
    assert.equal((await call('POST', `/api/worlds/${id}/remote`, 'Ann', { n: 'Ping', a: 'x' })).status, 400);
    assert.equal((await call('POST', `/api/worlds/${id}/remote`, 'Ann', { n: 'Ping', a: ['y'.repeat(5000)] })).status, 400);
    assert.equal((await call('POST', `/api/worlds/${id}/remote`, 'Bob', { n: 'Ping', a: [1, 1] })).status, 409, 'not in the world');

    // changing the world sends a delta with the new object
    await call('POST', `/api/worlds/${id}/remote`, 'Ann', { n: 'Build', a: [] });
    const delta = await s.until('delta');
    assert.equal(delta.set.length, 1);
    assert.equal(delta.set[0].kind, 'rock');

    // freezing stops the server moving you
    await call('POST', `/api/worlds/${id}/remote`, 'Ann', { n: 'Freeze', a: [] });
    await s.until('state', d => d.players.some(p => p.n === 'Ann' && p.f === 1));
    await new Promise(r => setTimeout(r, 150));
    const frozen = await call('POST', `/api/worlds/${id}/move`, 'Ann', { x: 900, y: 900, e: 1 });
    assert.ok(Math.abs(frozen.json.x - 300) < 2);

    const log = await call('GET', `/api/worlds/${id}/script-log?after=0`, 'Ann', undefined, true);
    assert.ok(log.json.lines.some(l => /joined Ann/.test(l.text)), JSON.stringify(log.json.lines));
    assert.equal(log.json.running, true);
  } finally { s.close(); }
});

test('a second player sees the first one\'s scripted state and attributes on joining', async () => {
  const id = db.testWorld;
  const a = openStream(id, 'Ann');
  await a.until('hello');
  await a.until('attr', x => x.k === 'coins');
  const b = openStream(id, 'Bob');
  try {
    const hello = await b.until('hello');
    assert.equal(hello.attrs.Ann.coins, 3);
    await b.until('attr', x => x.n === 'Bob' && x.k === 'coins');
  } finally { a.close(); b.close(); }
});

test('saving scripts while someone is inside restarts them and tells clients', async () => {
  const id = db.testWorld;
  const s = openStream(id, 'Ann');
  try {
    await s.until('hello');
    await call('PUT', `/api/worlds/${id}/scripts`, 'Ann', { scripts: [{ name: 'New', side: 'client', source: 'ui.text("a","b")' }] }, true);
    const sc = await s.until('scripts');
    assert.deepEqual(sc.scripts.map(x => x.name), ['New']);
    await s.until('attrs');
  } finally { s.close(); }
});

test('the client sandbox is served with a CSP that blocks all network access', async () => {
  // (the file is created by this change; the route sets the header either way)
  const res = await new Promise(resolve => http.get(base + '/js/world-sandbox-client.js', r => { r.resume(); resolve(r); }));
  const csp = res.headers['content-security-policy'];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /connect-src 'none'/);
  assert.doesNotMatch(csp, /'self'/);
});
