'use strict';
// Object scripts, touch events and Storage (templates that scripts can clone).
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const mountWorlds = require('../worlds');

const db = { users: { ann: { username: 'Ann', seals: 100 } }, worlds: [], worldAssets: [
  { id: 'coin1', name: 'Coin', w: 60, h: 60, shapes: [{ t: 'rect', x: 0, y: 0, w: 10, h: 10, rx: 0, fill: '#00ff00', stroke: 'none', sw: 0, op: 1 }] }
] };
let server, base;

function call(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(base + path, { method, headers: { 'content-type': 'application/json', 'x-user': 'Ann' } }, res => {
      let t = ''; res.on('data', c => { t += c; });
      res.on('end', () => { let j = {}; try { j = JSON.parse(t); } catch { /* not JSON */ } resolve({ status: res.statusCode, json: j }); });
    });
    req.on('error', reject); if (body !== undefined) req.write(JSON.stringify(body)); req.end();
  });
}
function openStream(id) {
  const events = []; let buf = '';
  const req = http.get(base + '/api/worlds/' + id + '/stream', { headers: { 'x-user': 'Ann' } });
  req.on('response', res => {
    res.setEncoding('utf8');
    res.on('data', c => {
      buf += c; let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const b = buf.slice(0, i); buf = buf.slice(i + 2);
        const m = /^event: (.+)\ndata: (.+)$/m.exec(b);
        if (m) events.push({ name: m[1], data: JSON.parse(m[2]) });
      }
    });
  });
  const until = (name, pred, ms = 4000) => new Promise((resolve, reject) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const e = events.find(x => x.name === name && (!pred || pred(x.data)));
      if (e) { clearInterval(iv); resolve(e.data); }
      else if (Date.now() - t0 > ms) { clearInterval(iv); reject(new Error('timeout waiting for ' + name + '; got ' + events.map(x => x.name).join(','))); }
    }, 30);
  });
  return { events, until, close: () => req.destroy() };
}

test.before(async () => {
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { req.session = { user: req.get('x-user') || null }; next(); });
  mountWorlds(app, {
    readDB: () => db, writeDB: () => {},
    requireLogin: (q, r, n) => (q.session.user ? n() : r.status(401).json({})),
    requireTier4: (q, r, n) => (q.session.user ? n() : r.status(403).json({})),
    isTier4: () => true, audit: () => {}, avatarColor: () => '#45d6c8'
  });
  server = app.listen(0); await new Promise(r => server.on('listening', r)); base = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => { server.close(); server.closeAllConnections && server.closeAllConnections(); });

const COIN_SCRIPT = `
  object.onTouch(function (player) {
    player.setAttribute('coins', (player.getAttribute('coins') || 0) + 1);
    object.remove();
  });
`;
const SERVER_SCRIPT = `
  const Go = Remote.event('Go');
  Go.onServerEvent(function (player, x, y) { player.teleport(x, y); });
  Remote.event('Drop').onServerEvent(function (player) {
    const coin = Storage.get('Coin').clone({ x: player.x - 10, y: player.y - 10 });
    console.log('dropped', coin.id, coin.template);
  });
  Remote.event('Bad').onServerEvent(function () { console.log('missing', Storage.get('Nope') === null); });
  const pad = Storage.get('Pad');
  console.log('pad', pad.kind, pad.hasScript, Storage.list().length);
`;
let id;

test('Storage is validated and saved with the scripts', async () => {
  const w = await call('POST', '/api/worlds', { name: 'Coin Land', template: 'blank' });
  assert.equal(w.status, 200);
  id = w.json.id;
  const coin = { name: 'Coin', kind: 'svg', asset: 'coin1', solid: false, w: 40, h: 40, script: COIN_SCRIPT };
  const bad = [
    [{ ...coin, asset: 'ghost' }],
    [coin, { ...coin, name: 'coin' }],
    [{ ...coin, name: 'x!' }],
    [{ ...coin, script: 'x'.repeat(5000) }],
    [{ ...coin, kind: 'lava' }]
  ];
  for (const t of bad) assert.equal((await call('PUT', `/api/worlds/${id}/scripts`, { scripts: [], templates: t })).status, 400);
  const ok = await call('PUT', `/api/worlds/${id}/scripts`, { scripts: [{ name: 'Main', side: 'server', source: SERVER_SCRIPT }], templates: [coin, { name: 'Pad', kind: 'rock', w: 60, h: 60, script: 'object.onTouch(p => console.log("touch", p.name)); object.onTouchEnd(p => console.log("leave", p.name));' }] });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.templates.length, 2);
  assert.equal(ok.json.world.scripted, true);
  // the layout puts one coin and one pad in the world, away from the spawn
  const l = await call('PUT', `/api/worlds/${id}/layout`, { layout: { ground: '#2f6b3a', spawn: { x: 200, y: 200 }, obstacles: [
    { kind: 'svg', asset: 'coin1', solid: false, x: 900, y: 600, w: 40, h: 40, tpl: 'Coin' },
    { kind: 'rock', x: 500, y: 500, w: 60, h: 60, tpl: 'Pad' },
    { kind: 'tree', x: 1200, y: 300, w: 60, h: 60, tpl: 'Bad name!' }
  ] } });
  assert.equal(l.status, 200);
  const got = await call('GET', `/api/worlds/${id}/layout`);
  assert.equal(got.json.layout.obstacles[0].tpl, 'Coin');
  assert.equal(got.json.layout.obstacles[2].tpl, undefined, 'a bad template name is dropped');
});

test('clients get the look of Storage items but never their scripts', async () => {
  const s = openStream(id);
  try {
    const hello = await s.until('hello');
    assert.deepEqual(hello.templates.map(t => t.name).sort(), ['Coin', 'Pad']);
    assert.ok(hello.templates.every(t => t.script === undefined));
    assert.ok(hello.world.assets.coin1, 'the design a clone needs is already there');
    assert.ok(!JSON.stringify(hello).includes('onTouch'));
  } finally { s.close(); }
});

test('touching an object runs its script; a clone gets one too', async () => {
  const s = openStream(id);
  try {
    await s.until('hello');
    const post = (n, a) => call('POST', `/api/worlds/${id}/remote`, { n, a });
    const log = async () => (await call('GET', `/api/worlds/${id}/script-log?after=0`)).json.lines.map(l => l.text);
    const waitLog = async re => { for (let i = 0; i < 60; i++) { if ((await log()).some(t => re.test(t))) return; await new Promise(r => setTimeout(r, 50)); } throw new Error('log never matched ' + re + ': ' + (await log()).join(' | ')); };

    await waitLog(/pad rock true 2/);

    // walk onto the placed coin: it adds to the balance and disappears for everyone
    await post('Go', [915, 615]);
    const attr = await s.until('attr', a => a.k === 'coins' && a.v === 1);
    assert.equal(attr.n, 'Ann');
    const gone = await s.until('delta', d => d.del.length === 1);
    assert.equal(gone.del.length, 1);

    // standing on the pad starts a touch, leaving it ends it
    await post('Go', [530, 530]);
    await waitLog(/touch Ann/);
    await post('Go', [300, 300]);
    await waitLog(/leave Ann/);

    // a clone dropped under the player is collected straight away
    await post('Drop', []);
    await s.until('attr', a => a.k === 'coins' && a.v === 2);
    await waitLog(/dropped o\d+ Coin/);

    // asking for something that isn't in Storage gives null, like world.getObject
    await post('Bad', []);
    await waitLog(/missing true/);
  } finally { s.close(); }
});

test('a Storage SVG design can not be deleted while it is in use', async () => {
  const res = await call('DELETE', '/api/studio/assets/coin1');
  assert.equal(res.status, 409);
});
