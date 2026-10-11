'use strict';
// The script editor's language service: completions, hover, signature help and diagnostics.
const test = require('node:test');
const assert = require('node:assert/strict');
const LSP = require('../public/js/script-lsp.js');

const server = LSP.create({ side: 'server', storage: ['Coin', 'Pad'], remotes: ['Collect'] });
const client = LSP.create({ side: 'client' });
const object = LSP.create({ side: 'object' });
const labels = r => (r ? r.items.map(i => i.label) : []);
const end = t => t.length;

test('completes members of a callback parameter, a variable and a chain', () => {
  let t = 'players.onJoin(p => {\n  p.';
  assert.ok(labels(server.completions(t, end(t))).includes('teleport'));
  assert.ok(!labels(server.completions(t, end(t))).includes('fireServer'));
  t = "const c = Storage.get('Coin');\nconst o = c.clone({ x: 1, y: 2 });\no.";
  assert.ok(labels(server.completions(t, end(t))).includes('onTouch'));
  t = 'for (const q of players.all()) {\n  q.sp';
  assert.deepEqual(labels(server.completions(t, end(t))), ['speed']);
  t = 'world.objects().forEach(o => o.';
  assert.ok(labels(server.completions(t, end(t))).includes('remove'));
});

test('the client sees the client API, not the server one', () => {
  assert.ok(labels(client.completions('cam', 3)).includes('camera'));
  assert.ok(!labels(client.completions('pl', 2)).includes('onTick'));
  assert.ok(labels(client.completions('ui.', 3)).includes('toast'));
  assert.ok(labels(client.completions('Remote.event("A").', 18)).includes('fireServer'));
  assert.ok(labels(server.completions('Remote.event("A").', 18)).includes('fireClient'));
  assert.ok(labels(object.completions('obj', 3)).includes('object'));
  assert.ok(!labels(server.completions('obj', 3)).includes('object'));
});

test('suggests Storage items and remote names inside strings, and nothing in comments', () => {
  assert.deepEqual(labels(server.completions("Storage.get('", 13)), ['Coin', 'Pad']);
  assert.deepEqual(labels(server.completions("Storage.get('Co", 15)), ['Coin']);
  assert.deepEqual(labels(server.completions('Remote.event("Co', 16)), ['Collect']);
  assert.equal(server.completions('// players.', 10), null);
  assert.equal(server.completions('const s = "players.', 19), null);
});

test('hover explains members, globals and typed variables', () => {
  const t = 'const w = world;\nplayers.onJoin(p => { p.speed = 2; });';
  const h = server.hover(t, t.indexOf('speed') + 1);
  assert.match(h.title, /Player\.speed: number/);
  assert.match(server.hover(t, t.indexOf('players') + 2).title, /players: Players/);
  assert.match(server.hover(t, t.indexOf('p.speed')).title, /variable\) p: Player/);
  assert.equal(server.hover('// players', 5), null);
  assert.match(server.hover('camera.zoom', 2).doc, /client/);
});

test('signature help follows the argument you are typing', () => {
  let t = 'players.onJoin(p => { p.teleport(1, ';
  let s = server.signature(t, end(t));
  assert.equal(s.active, 1);
  assert.deepEqual(s.params, ['x: number', 'y: number']);
  t = 'ui.text(';
  s = client.signature(t, end(t));
  assert.match(s.label, /^Ui\.text\(id: string/);
  assert.equal(client.signature('const a = (1, ', 14), null);
});

test('diagnostics catch read-only writes, typos, wrong-side API and bad argument counts', () => {
  const t = 'players.onJoin(p => {\n  p.x = 5;\n  p.spd = 2;\n  p.teleport(1);\n  camera.zoom = 2;\n});';
  const d = server.diagnostics(t);
  assert.equal(d.length, 4);
  assert.match(d[0].message, /Player\.x is read-only/);
  assert.equal(d[0].line, 1);
  assert.match(d[1].message, /Did you mean “speed”/);
  assert.equal(d[2].severity, 'warning');
  assert.match(d[3].message, /only exists in client scripts/);
  const c = client.diagnostics('onTick(dt => {}); localPlayer.x = 3; Remote.event("A").fireServer(1); Remote.event("B").fireClient(null);');
  assert.equal(c.length, 3);
  assert.match(c[2].message, /only available in server scripts/);
});

test('good scripts produce no diagnostics', () => {
  const coin = 'object.onTouch(function (player) {\n  player.setAttribute("balance", (player.getAttribute("balance") || 0) + 1);\n  world.confetti(object.x, object.y);\n  object.remove();\n});';
  assert.deepEqual(object.diagnostics(coin), []);
  const hud = "ui.text('b', 'Balance: 0', { anchor: 'top-left', x: 12, y: 12 });\nlocalPlayer.onAttributeChanged((k, v) => { if (k === 'balance') ui.text('b', 'Balance: ' + v); });\ninput.onKeyDown(key => { if (key === ' ') camera.shake(5); });";
  assert.deepEqual(client.diagnostics(hud), []);
  const spawner = "const coin = Storage.get('Coin');\nlet coins = [];\nsetInterval(() => { coins = coins.filter(c => c.exists); coins.push(coin.clone({ x: 5, y: 5 })); }, 2000);\nplayers.onJoin(p => p.setAttribute('balance', 0));";
  assert.deepEqual(server.diagnostics(spawner), []);
  assert.deepEqual(server.diagnostics('const s = "p.x = 1; camera.zoom"; // camera.x = 1'), [], 'strings and comments are ignored');
});

test('every example script in the Studio is clean', () => {
  const html = require('fs').readFileSync(require('path').join(__dirname, '../public/studio.html'), 'utf8');
  // the examples are written as JS strings in studio.html; evaluate just that array
  const start = html.indexOf('var EXAMPLES = ['), stop = html.indexOf('function uid()');
  const EXAMPLES = new Function(html.slice(start, stop) + '; return EXAMPLES;')();
  assert.ok(EXAMPLES.length >= 5);
  for (const ex of EXAMPLES) {
    for (const s of ex.scripts) assert.deepEqual(LSP.create({ side: s.side, storage: ['Coin'] }).diagnostics(s.source), [], ex.label + ' / ' + s.name);
    for (const t of ex.tpls || []) assert.deepEqual(LSP.create({ side: 'object' }).diagnostics(t.source), [], ex.label + ' / ' + t.name);
  }
});
