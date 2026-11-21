'use strict';
// Scripting together with SVG design objects (kind: 'svg', asset, solid).
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const mountWorlds = require('../worlds');

const db = { users: { ann: { username: 'Ann', seals: 100 } }, worlds: [], worldAssets: [
  { id: 'tree1', name: 'Tree', w: 60, h: 60, shapes: [{ t: 'rect', x: 0, y: 0, w: 10, h: 10, rx: 0, fill: '#00ff00', stroke: 'none', sw: 0, op: 1 }] }
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

test('saved SVG objects keep their design and solidity when a world goes live, and scripts can add and edit them', async () => {
  const w = await call('POST', '/api/worlds', { name: 'Svg Script', template: 'blank' });
  const id = w.json.id;
  const put = await call('PUT', `/api/worlds/${id}/layout`, { layout: { ground: '#112233', spawn: { x: 800, y: 500 }, obstacles: [
    { kind: 'svg', asset: 'tree1', solid: false, x: 100, y: 100, w: 60, h: 60 },
    { kind: 'rock', x: 300, y: 300, w: 80, h: 80 }
  ] } });
  assert.equal(put.status, 200);
  await call('PUT', `/api/worlds/${id}/scripts`, { scripts: [{ name: 's', side: 'server', source: `
    const Go = Remote.event('Go');
    Go.onServerEvent(function () {
      world.addObject({ kind: 'svg', asset: 'tree1', x: 500, y: 500, w: 60, h: 60, solid: true });
      world.objects().forEach(o => { if (o.kind === 'svg' && o.solid === false) o.x = 140; });
      try { world.addObject({ kind: 'svg', x: 1, y: 1 }); } catch (e) { console.log('refused: ' + e.message); }
      try { world.addObject({ kind: 'svg', asset: 'nope', x: 1, y: 1 }); } catch (e) { console.log('refused2'); }
    });
  ` }] });
  const s = openStream(id);
  try {
    const hello = await s.until('hello');
    const svgs = hello.world.obstacles.filter(o => o.kind === 'svg');
    assert.equal(svgs.length, 1);
    assert.equal(svgs[0].asset, 'tree1'); assert.equal(svgs[0].solid, false);
    assert.ok(hello.world.assets.tree1, 'hello carries the design');
    await s.until('attrs', () => true, 100).catch(() => {});
    await new Promise(r => setTimeout(r, 400));   // let the scripts finish loading
    await call('POST', `/api/worlds/${id}/remote`, { n: 'Go', a: [] });
    // (changes go out every 50 ms, so wait for the final state rather than the first one)
    const layout = await s.until('layout', l => l.obstacles.some(o => o.kind === 'svg' && o.solid === true) && l.obstacles.some(o => o.kind === 'svg' && o.solid === false && o.x === 140));
    assert.ok(layout.assets.tree1, 'SVG changes go out as a full layout with the designs');
    assert.equal(layout.obstacles.find(o => o.kind === 'svg' && o.solid === false).x, 140);
    await new Promise(r => setTimeout(r, 300));
    const log = await call('GET', `/api/worlds/${id}/script-log?after=0`);
    assert.ok(log.json.lines.some(l => /refused: .*asset/.test(l.text)), JSON.stringify(log.json.lines));
    assert.ok(log.json.lines.some(l => /refused2/.test(l.text)));
  } finally { s.close(); }
});
