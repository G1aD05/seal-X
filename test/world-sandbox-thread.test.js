'use strict';
// The worker-thread layer: scripts keep working end to end, and nothing a script does can freeze
// the game server. Run with:  npm test

const test = require('node:test');
const assert = require('node:assert/strict');
const { ScriptSandbox } = require('../world-scripting');

function make(source, host) {
  const logs = [];
  let died = 0;
  const calls = [];
  const sb = new ScriptSandbox({
    scripts: [{ name: 'main', source }],
    host: host || ((op, a) => { calls.push([op, a]); if (op === 'p.get') return { name: 'Ann', x: 7, y: 8, attrs: {} }; if (op === 'players.names') return ['Ann']; }),
    log: (level, text) => logs.push({ level, text }),
    onDead: () => { died++; }
  });
  return { sb, logs, calls, died: () => died };
}

test('scripts load, get events, and call back into the host', async () => {
  const { sb, logs, calls } = make(`
    players.onJoin(p => { console.log('hello', p.name, p.x); });
    Remote.event('Ping').onServerEvent((p, n) => Remote.event('Pong').fireClient(p, n * 2));
  `);
  sb.dispatch('join', { n: 'Ann' });
  sb.dispatch('remote', { p: 'Ann', n: 'Ping', a: [21] });
  await sb.idle();
  assert.deepEqual(logs, [{ level: 'log', text: 'hello Ann 7' }]);
  assert.deepEqual(calls.find(c => c[0] === 'remote.fire'), ['remote.fire', { n: 'Pong', to: 'Ann', a: [42] }]);
  sb.dispose();
});

test('a host error comes back to the script as an exception, not a crash', async () => {
  const { sb, logs } = make(`try { world.addObject({ kind: 'lava' }); } catch (e) { console.log('caught: ' + e.message); }`,
    () => { throw new Error('Unknown object type.'); });
  await sb.idle();
  assert.deepEqual(logs.map(l => l.text), ['caught: Unknown object type.']);
  sb.dispose();
});

test('events from before the engine finished starting are not lost', async () => {
  const { sb, logs } = make(`players.onJoin(p => console.log('joined ' + p.name));`);
  sb.dispatch('join', { n: 'Ann' });        // sent immediately, long before the thread is ready
  await sb.idle();
  assert.deepEqual(logs.map(l => l.text), ['joined Ann']);
  sb.dispose();
});

test('ticks are coalesced instead of piling up behind a slow script', async () => {
  const { sb, logs } = make(`let n = 0; onTick(() => { n++; if (n === 1) { const t = Date.now(); while (Date.now() - t < 30) {} } });`);
  await sb.idle();
  let accepted = 0;
  for (let i = 0; i < 50; i++) if (sb.dispatch('tick', { t: i, dt: 0.05 })) accepted++;
  assert.ok(accepted < 50, 'accepted ' + accepted);
  await sb.idle();
  assert.equal(logs.length, 0);
  sb.dispose();
});

test('a script stuck inside a native call (which the engine cannot interrupt) is killed without freezing the server', async () => {
  // This is the case a CPU budget alone can't handle: one builtin that runs for seconds.
  const { sb, logs, died } = make(`onTick(() => { for (;;) new Array(1e5).fill(1); });`);
  await sb.idle();
  const heartbeat = [];
  const beat = setInterval(() => heartbeat.push(Date.now()), 20);
  const t0 = Date.now();
  sb.dispatch('tick', { t: 0, dt: 0.05 });
  while (!sb.dead && Date.now() - t0 < 5000) await new Promise(r => setTimeout(r, 25));
  clearInterval(beat);
  assert.equal(sb.dead, true, 'the stuck thread should have been terminated');
  assert.equal(died(), 1);
  assert.ok(logs.some(l => /turned off/.test(l.text)), JSON.stringify(logs));
  // The main thread stayed responsive the whole time: no gap in the heartbeat longer than 250 ms.
  const gaps = heartbeat.slice(1).map((t, i) => t - heartbeat[i]);
  assert.ok(Math.max(...gaps) < 250, 'longest main-thread stall: ' + Math.max(...gaps) + ' ms');
});

test('repeated overruns shut the scripts off and report it once', async () => {
  const { sb, logs, died } = make(`onTick(() => { while (true) {} });`);
  await sb.idle();
  for (let i = 0; i < 12 && !sb.dead; i++) { sb.dispatch('tick', { t: i, dt: 0.05 }); await sb.idle(); }
  assert.equal(sb.dead, true);
  assert.equal(died(), 1);
  assert.ok(logs.some(l => /kept running too long/.test(l.text)));
});

test('a script that fails to load reports the error and the others still run', async () => {
  const logs = [];
  const sb = new ScriptSandbox({
    scripts: [{ name: 'broken', source: 'this is not javascript' }, { name: 'fine', source: 'console.log("fine runs")' }],
    host: () => {}, log: (level, text) => logs.push(text)
  });
  await sb.idle();
  assert.ok(logs.some(t => /broken:/.test(t)));
  assert.ok(logs.includes('fine runs'));
  sb.dispose();
});

test('dispose() ends the thread and further events are ignored', async () => {
  const { sb } = make(`players.onJoin(() => {});`);
  await sb.idle();
  sb.dispose();
  assert.equal(sb.dispatch('join', { n: 'Ann' }), false);
  await sb.idle();
});
