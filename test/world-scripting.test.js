'use strict';
// Server-side script sandbox: the API, isolation, and the CPU / memory limits.
// Run with:  npm test

const test = require('node:test');
const assert = require('node:assert/strict');
const { ScriptVM, LIMITS } = require('../world-scripting-vm');
const { ScriptSandbox } = require('../world-scripting');

// A tiny fake world so the sandbox can be tested without Express.
function makeHost() {
  const state = {
    players: { Ann: { name: 'Ann', x: 10, y: 20, speed: 1, scale: 1, color: '#111111', trail: null, frozen: false, hidden: false, title: '', attrs: {} } },
    objs: {}, nextId: 1, calls: [], remote: []
  };
  const host = (op, a) => {
    state.calls.push(op);
    switch (op) {
      case 'players.names': return Object.keys(state.players);
      case 'players.find': return Object.keys(state.players).find(n => n.toLowerCase() === a.n.toLowerCase()) || null;
      case 'p.get': return state.players[a.n] || null;
      case 'p.set': state.players[a.n][a.k] = a.v; return;
      case 'p.tp': state.players[a.n].x = a.x; state.players[a.n].y = a.y; return;
      case 'p.attr': if (a.v === null) delete state.players[a.n].attrs[a.k]; else state.players[a.n].attrs[a.k] = a.v; return;
      case 'w.info': return { name: 'Test', width: 1600, height: 1000, ground: '#2f6b3a', spawn: { x: 800, y: 500 } };
      case 'w.addObj': { const o = { id: 'n' + state.nextId++, kind: a.kind || 'rock', x: a.x || 0, y: a.y || 0, w: a.w || 60, h: a.h || 60 }; state.objs[o.id] = o; return o; }
      case 'w.objs': return Object.values(state.objs);
      case 'o.get': return state.objs[a.id] || null;
      case 'o.set': Object.assign(state.objs[a.id], a.p); return;
      case 'o.rm': delete state.objs[a.id]; return;
      case 'remote.fire': state.remote.push(a); return;
      default: throw new Error('Unknown op ' + op);
    }
  };
  return { state, host };
}

function boot(source, extra = {}) {
  const { state, host } = makeHost();
  const logs = [];
  const sb = new ScriptVM({
    quickjs,
    scripts: [{ name: 'main', source }],
    host: extra.host || host,
    log: (level, text) => logs.push({ level, text })
  });
  return { sb, state, logs };
}

let quickjs;
test.before(async () => { quickjs = await require('quickjs-emscripten').getQuickJS(); });

test('scripts can read and change players through the API', () => {
  const { sb, state, logs } = boot(`
    const ann = players.get('ann');
    ann.speed = 2; ann.title = 'Boss';
    ann.setAttribute('score', 3);
    ann.teleport(100, 200);
    console.log('x is', ann.x, 'name', ann.name, String(ann));
  `);
  assert.equal(state.players.Ann.speed, 2);
  assert.equal(state.players.Ann.title, 'Boss');
  assert.equal(state.players.Ann.attrs.score, 3);
  assert.equal(state.players.Ann.x, 100);
  assert.deepEqual(logs, [{ level: 'log', text: 'x is 100 name Ann Ann' }]);
  sb.dispose();
});

test('position is read-only with a helpful message', () => {
  const { sb, logs } = boot(`try { players.get('Ann').x = 5; } catch (e) { console.log(e.message); }`);
  assert.match(logs[0].text, /teleport/);
  sb.dispose();
});

test('world objects can be created, edited and removed', () => {
  const { sb, state } = boot(`
    const wall = world.addObject({ kind: 'wall', x: 100, y: 100, w: 80, h: 40 });
    wall.x = 300; wall.set({ w: 120 });
    const rock = world.addObject({ kind: 'rock' }); rock.remove();
    console.log(world.objects().length, world.name, world.width);
  `);
  assert.equal(state.objs.n1.x, 300);
  assert.equal(state.objs.n1.w, 120);
  assert.equal(state.objs.n2, undefined);
  sb.dispose();
});

test('join, leave, tick and remote events reach the scripts', () => {
  const { sb, logs, state } = boot(`
    players.onJoin(p => console.log('join', p.name));
    players.onLeave(p => console.log('leave', p.name));
    onTick(dt => { if (!globalThis.ticked) { globalThis.ticked = 1; console.log('tick', typeof dt); } });
    Remote.event('Ping').onServerEvent((player, a, b) => {
      console.log('ping from', player.name, a, JSON.stringify(b));
      Remote.event('Pong').fireClient(player, a + 1);
    });
  `);
  sb.dispatch('join', { n: 'Ann' });
  sb.dispatch('tick', { t: 1000, dt: 0.05 });
  sb.dispatch('remote', { p: 'Ann', n: 'Ping', a: [41, { ok: true }] });
  sb.dispatch('remote', { p: 'Ann', n: 'Nobody listens', a: [] });
  sb.dispatch('leave', { n: 'Ann' });
  assert.deepEqual(logs.map(l => l.text), ['join Ann', 'tick number', 'ping from Ann 41 {"ok":true}', 'leave Ann']);
  assert.deepEqual(state.remote, [{ n: 'Pong', to: 'Ann', a: [42] }]);
  sb.dispose();
});

test('timers and wait() run off the tick clock', async () => {
  const { sb, logs } = boot(`
    setTimeout(() => console.log('once'), 100);
    const id = setInterval(() => console.log('every'), 100);
    setTimeout(() => clearInterval(id), 250);
    (async () => { await wait(150); console.log('waited'); })();
  `);
  for (let t = 0; t <= 400; t += 50) sb.dispatch('tick', { t, dt: 0.05 });
  const text = logs.map(l => l.text).join(',');
  assert.equal(text, 'once,every,waited,every');
  sb.dispose();
});

test('the sandbox has no way out to Node', () => {
  const { sb, logs } = boot(`
    const probes = [
      typeof process, typeof require, typeof module, typeof fetch, typeof XMLHttpRequest, typeof __host,
      typeof globalThis.constructor.constructor('return this')().process,
      typeof (function () {}).constructor('return typeof process')(),
      typeof players.all.constructor('return typeof require')()
    ];
    console.log(probes.join(','));
  `);
  assert.equal(logs[0].text, 'undefined,undefined,undefined,undefined,undefined,undefined,undefined,string,string');
  assert.equal(logs.length, 1);
  sb.dispose();
});

test('an infinite loop is stopped, logged, and the scripts shut off after repeated offences', () => {
  const { sb, logs } = boot(`onTick(() => { while (true) {} });`);
  for (let i = 0; i < LIMITS.maxStrikes + 2; i++) sb.dispatch('tick', { t: i * 50, dt: 0.05 });
  assert.ok(logs.some(l => /ran for more than/.test(l.text)));
  assert.ok(logs.some(l => /turned off/.test(l.text)));
  assert.equal(sb.dead, true);
  sb.dispose();
});

test('an infinite loop at the top level of a script does not hang loading', () => {
  const t0 = Date.now();
  const { sb, logs } = boot(`while (true) {}`);
  assert.ok(Date.now() - t0 < 2000);
  assert.ok(logs.some(l => /ran for more than/.test(l.text)));
  sb.dispose();
});

test('hoarding memory is stopped', () => {
  const { sb, logs } = boot(`onTick(() => { const a = []; for (;;) a.push(new Array(1e5).fill(1)); });`);
  sb.dispatch('tick', { t: 0, dt: 0.05 });
  assert.ok(logs.some(l => /out of memory|ran for more than/.test(l.text)), JSON.stringify(logs));
  sb.dispose();
});

test('an error in one script or handler does not stop the others', () => {
  const { sb, state, logs } = boot(`
    players.onJoin(() => { throw new Error('boom'); });
    players.onJoin(p => { p.speed = 3; });
  `);
  sb.dispatch('join', { n: 'Ann' });
  assert.equal(state.players.Ann.speed, 3);
  assert.ok(logs.some(l => l.level === 'error' && /boom/.test(l.text)));

  const second = new ScriptVM({
    quickjs,
    scripts: [{ name: 'bad', source: 'throw new Error("first fails")' }, { name: 'good', source: 'console.log("second runs")' }],
    host: makeHost().host, log: (level, text) => logs.push({ level, text })
  });
  assert.ok(logs.some(l => /bad: first fails/.test(l.text)));
  assert.ok(logs.some(l => l.text === 'second runs'));
  second.dispose(); sb.dispose();
});

test('scripts are scoped separately, and host errors surface as ordinary exceptions', () => {
  const logs = [];
  const sb = new ScriptVM({
    quickjs,
    scripts: [{ name: 'a', source: 'const shared = 1; console.log(shared)' }, { name: 'b', source: 'const shared = 2; console.log(shared)' },
      { name: 'c', source: 'try { world.addObject({ kind: "lava" }); } catch (e) { console.log("caught", e.message); }' }],
    host: (op, a) => { if (op === 'w.addObj') throw new Error('Unknown object type.'); },
    log: (level, text) => logs.push(text)
  });
  assert.deepEqual(logs, ['1', '2', 'caught Unknown object type.']);
  sb.dispose();
});

test('console output is rate limited and truncated', () => {
  const { sb, logs } = boot(`for (let i = 0; i < 500; i++) console.log('x'.repeat(1000));`);
  assert.ok(logs.length <= LIMITS.maxLogsPerSecond + 1);
  assert.ok(logs[0].text.length <= LIMITS.maxLogChars + 1);
  sb.dispose();
});
