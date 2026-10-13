'use strict';
// Worker thread for the AI's sandbox (see ai-sandbox.js). Two jobs:
//   kind 'js'   - run plain JavaScript in QuickJS (no network, files, process or timers of the host)
//   kind 'seal' - run a Seal world script against a simulated world and report what happened
// The main thread terminates this worker if it ever takes too long, so even a stuck native call is harmless.

const { parentPort, workerData } = require('worker_threads');
const path = require('path');

const MAX_OUTPUT_LINES = 60, MAX_LINE = 300;

const PRELUDE = `
(function (g) {
  var fmt = function (a) {
    if (typeof a === 'string') return a;
    if (a instanceof Error) return a.name + ': ' + a.message;
    try { return JSON.stringify(a, function (k, v) { return typeof v === 'function' ? '[Function]' : typeof v === 'bigint' ? String(v) + 'n' : v; }); } catch (e) { return String(a); }
  };
  g.console = {};
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (l) { g.console[l] = function () { __log(l, Array.prototype.map.call(arguments, fmt).join(' ')); }; });
  var q = [], now = 0, nextId = 1;
  function add(fn, ms, every, extra) { var id = nextId++; q.push({ id: id, fn: fn, at: now + Math.max(0, Number(ms) || 0), every: every, args: extra }); return id; }
  g.setTimeout = function (fn, ms) { return add(fn, ms, false, Array.prototype.slice.call(arguments, 2)); };
  g.setInterval = function (fn, ms) { return add(fn, Math.max(1, Number(ms) || 1), true, Array.prototype.slice.call(arguments, 2)); };
  g.clearTimeout = g.clearInterval = function (id) { q = q.filter(function (t) { return t.id !== id; }); };
  g.queueMicrotask = function (fn) { Promise.resolve().then(fn); };
  // Timers run on a virtual clock, so setTimeout(fn, 5000) finishes instantly.
  g.__runTimers = function (limitMs) {
    var guard = 0;
    while (q.length && guard++ < 2000) {
      q.sort(function (a, b) { return a.at - b.at || a.id - b.id; });
      var t = q[0];
      if (t.at > limitMs) break;
      now = t.at;
      if (t.every) t.at = now + t.every; else q.shift();
      try { t.fn.apply(null, t.args); } catch (e) { console.error('Uncaught ' + fmt(e)); }
      if (g.__drain) g.__drain();
    }
    return q.length;
  };
})(globalThis);`;

function clip(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

async function main() {
  const { getQuickJS } = require('quickjs-emscripten');
  const quickjs = await getQuickJS();
  const job = workerData.job;
  return job.kind === 'seal' ? runSeal(quickjs, job) : runJs(quickjs, job);
}

/* ---------------------------------------------------------------- plain JavaScript */

function runJs(quickjs, job) {
  const out = [];
  const t0 = Date.now(), hardDeadline = t0 + 3000;
  const rt = quickjs.newRuntime();
  rt.setMemoryLimit(24 * 1024 * 1024); rt.setMaxStackSize(256 * 1024);
  rt.setInterruptHandler(() => Date.now() > hardDeadline);
  const vm = rt.newContext();
  const result = { ok: true, output: out, truncated: false };
  try {
    const logFn = vm.newFunction('__log', (l, t) => {
      if (out.length < MAX_OUTPUT_LINES) out.push({ level: vm.getString(l), text: clip(vm.getString(t), MAX_LINE) }); else result.truncated = true;
    });
    vm.setProp(vm.global, '__log', logFn); logFn.dispose();
    const pre = vm.evalCode(PRELUDE, 'prelude.js');
    if (pre.error) { pre.error.dispose(); throw new Error('sandbox failed to start'); }
    pre.value.dispose();

    const jobs = () => { const r = rt.executePendingJobs(); if (r.error) { fail(vm.dump(r.error)); r.error.dispose(); } };
    const fail = err => { result.ok = false; result.error = clip((err && err.message ? err.name + ': ' + err.message : String(err)) + (err && err.stack ? '\n' + String(err.stack).split('\n').slice(0, 3).join('\n') : ''), 600); };
    let res = vm.evalCode(String(job.code), 'main.js');
    if (res.error) {
      const err = vm.dump(res.error); res.error.dispose();
      // Top-level await is fine in the snippets people write, so retry as an async function body.
      if (err && /await|expecting/i.test(String(err.message)) && /\bawait\b/.test(job.code)) {
        res = vm.evalCode('(async function(){' + job.code + '\n})().catch(function(e){ console.error("Uncaught " + (e && e.message ? e.name + ": " + e.message : e)); })', 'main.js');
        if (res.error) { fail(vm.dump(res.error)); res.error.dispose(); } else res.value.dispose();
      } else fail(err);
    } else {
      const v = vm.dump(res.value); res.value.dispose();
      if (v !== undefined) { try { result.result = clip(JSON.stringify(v), 500); } catch { /* not serialisable */ } }
    }
    const drainFn = vm.newFunction('__drain', () => { jobs(); });
    vm.setProp(vm.global, '__drain', drainFn); drainFn.dispose();
    jobs();
    const run = vm.evalCode('__runTimers(10000)', 'timers.js');
    if (run.error) { fail(vm.dump(run.error)); run.error.dispose(); } else run.value.dispose();
    jobs();
  } catch (err) {
    result.ok = false;
    const msg = String(err && err.message ? err.message : err);
    result.error = /interrupted/.test(msg) ? 'Stopped: the code ran for more than 3 seconds (an infinite loop?).' : /out of memory/.test(msg) ? 'Stopped: the code used too much memory.' : clip(msg, 300);
  }
  if (result.error && /interrupted/.test(result.error)) result.error = 'Stopped: the code ran for more than 3 seconds (an infinite loop?).';
  if (result.error && /out of memory/.test(result.error)) result.error = 'Stopped: the code used too much memory.';
  try { vm.dispose(); rt.dispose(); } catch { /* ignore */ }
  result.ms = Date.now() - t0;
  return result;
}

/* ------------------------------------------------------------ Seal world scripts */

const WORLD_W = 1600, WORLD_H = 1000, KINDS = ['tree', 'rock', 'water', 'wall', 'svg'];
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const isHex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

// A small stand-in for a live world. It follows the same rules as the real one for the things scripts
// can ask about (value checks, limits, errors), but has no physics, collisions, real touch detection or
// other people: only what the test steps say happens.
function makeWorld(job) {
  const w = { players: new Map(), objs: [], nextId: 1, ground: '#2f6b3a', spawn: { x: 800, y: 500 }, remote: [], says: [], watch: new Set(), templates: (job.storage || []).map(t => ({ name: String(t.name), kind: KINDS.includes(t.kind) ? t.kind : 'rock', w: Number(t.w) || 60, h: Number(t.h) || 60, script: String(t.script || '') })) };
  w.addPlayer = name => {
    const p = { name, x: w.spawn.x, y: w.spawn.y, color: '#45d6c8', speed: 1, scale: 1, trail: false, frozen: false, hidden: false, title: '', attrs: {} };
    w.players.set(name.toLowerCase(), p); return p;
  };
  w.find = n => w.players.get(String(n).toLowerCase()) || null;
  w.need = n => { const p = w.find(n); if (!p) throw new Error('That player is not in the world.'); return p; };
  w.describe = p => ({ name: p.name, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, color: p.color, speed: p.speed, scale: p.scale, trail: p.trail, frozen: p.frozen, hidden: p.hidden, title: p.title, attrs: Object.assign({}, p.attrs) });
  w.obj = spec => {
    if (!KINDS.includes(spec.kind)) throw new Error('Unknown object type “' + String(spec.kind).slice(0, 20) + '”. Use one of: ' + KINDS.join(', ') + '.');
    const ww = clamp(Math.round(Number(spec.w)), 20, WORLD_W), hh = clamp(Math.round(Number(spec.h)), 20, WORLD_H), x = Number(spec.x), y = Number(spec.y);
    if (![ww, hh, x, y].every(Number.isFinite)) throw new Error('Object size and position must be numbers.');
    const o = { id: 'o' + w.nextId++, kind: spec.kind, w: ww, h: hh, x: Math.round(clamp(x, 0, WORLD_W - ww)), y: Math.round(clamp(y, 0, WORLD_H - hh)) };
    if (spec.kind === 'svg') { o.asset = spec.asset; o.solid = spec.solid !== false; }
    return o;
  };
  w.host = (op, a) => {
    a = a || {};
    switch (op) {
      case 'players.names': return [...w.players.values()].map(p => p.name);
      case 'players.find': { const p = w.find(a.n); return p ? p.name : null; }
      case 'p.get': { const p = w.find(a.n); return p ? w.describe(p) : null; }
      case 'p.set': {
        const p = w.need(a.n), v = a.v;
        switch (a.k) {
          case 'speed': { const n = Number(v); if (!Number.isFinite(n)) throw new Error('speed must be a number (1 is normal).'); p.speed = Math.round(clamp(n, 0, 5) * 100) / 100; return; }
          case 'scale': { const n = Number(v); if (!Number.isFinite(n)) throw new Error('scale must be a number (1 is normal).'); p.scale = Math.round(clamp(n, 0.25, 6) * 100) / 100; return; }
          case 'color': if (v === null) p.color = '#45d6c8'; else if (isHex(v)) p.color = v.toLowerCase(); else throw new Error('color must look like "#ff8800" (or null for the default).'); return;
          case 'trail': p.trail = !!v; return;
          case 'frozen': p.frozen = !!v; return;
          case 'hidden': p.hidden = !!v; return;
          case 'title': p.title = String(v == null ? '' : v).slice(0, 24); return;
          default: throw new Error('Unknown player property.');
        }
      }
      case 'p.tp': { const p = w.need(a.n), x = Number(a.x), y = Number(a.y); if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('teleport needs two numbers: x and y.'); p.x = clamp(x, 14, WORLD_W - 14); p.y = clamp(y, 14, WORLD_H - 14); return; }
      case 'p.attr': {
        const p = w.need(a.n), k = String(a.k);
        if (!/^[A-Za-z0-9_]{1,24}$/.test(k)) throw new Error('Attribute names are 1-24 letters, numbers or _.');
        const v = a.v;
        if (v === null || v === undefined) delete p.attrs[k];
        else {
          if (!(k in p.attrs) && Object.keys(p.attrs).length >= 12) throw new Error('A player can have at most 12 attributes.');
          if (typeof v === 'number' && Number.isFinite(v)) p.attrs[k] = v; else if (typeof v === 'boolean') p.attrs[k] = v; else if (typeof v === 'string') p.attrs[k] = v.slice(0, 100);
          else throw new Error('Attributes can be numbers, text or true/false.');
        }
        return;
      }
      case 'p.say': w.need(a.n); w.says.push({ to: a.n, text: String(a.t).slice(0, 200) }); return;
      case 'w.info': return { name: 'Test world', width: WORLD_W, height: WORLD_H, ground: w.ground, spawn: Object.assign({}, w.spawn) };
      case 'w.set': {
        if (a.ground !== undefined) { if (!isHex(a.ground)) throw new Error('ground must look like "#2f6b3a".'); w.ground = a.ground.toLowerCase(); }
        if (a.spawn !== undefined) { const x = Number(a.spawn && a.spawn.x), y = Number(a.spawn && a.spawn.y); if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('setSpawn needs two numbers: x and y.'); w.spawn = { x: Math.round(clamp(x, 14, WORLD_W - 14)), y: Math.round(clamp(y, 14, WORLD_H - 14)) }; }
        return;
      }
      case 'w.objs': return w.objs.map(o => Object.assign({}, o));
      case 'o.get': { const o = w.objs.find(x => x.id === String(a.id)); return o ? Object.assign({}, o) : null; }
      case 'w.addObj': { if (w.objs.length >= 300) throw new Error('A world can have at most 300 objects.'); const o = w.obj(Object.assign({ kind: 'rock', w: 60, h: 60, x: 0, y: 0 }, a)); w.objs.push(o); return Object.assign({}, o); }
      case 'o.set': { const o = w.objs.find(x => x.id === String(a.id)); if (!o) throw new Error('That object no longer exists.'); Object.assign(o, w.obj(Object.assign({}, o, a.p), o)); o.id = String(a.id); return; }
      case 'o.rm': { const i = w.objs.findIndex(x => x.id === String(a.id)); if (i >= 0) { w.objs.splice(i, 1); w.watch.delete(String(a.id)); } return; }
      case 'o.watch': if (!w.objs.some(x => x.id === String(a.id))) throw new Error('That object no longer exists.'); if (a.on === false) w.watch.delete(String(a.id)); else w.watch.add(String(a.id)); return;
      case 'o.overlap': return;
      case 'tpl.list': return w.templates.map(t => ({ name: t.name, kind: t.kind, w: t.w, h: t.h, hasScript: !!t.script }));
      case 'tpl.clone': {
        const t = w.templates.find(x => x.name.toLowerCase() === String(a.n).toLowerCase());
        if (!t) throw new Error('There is no “' + String(a.n).slice(0, 30) + '” in Storage.');
        const spec = a.spec && typeof a.spec === 'object' ? a.spec : {};
        const o = w.obj({ kind: t.kind, w: spec.w !== undefined ? spec.w : t.w, h: spec.h !== undefined ? spec.h : t.h, x: spec.x || 0, y: spec.y || 0 });
        o.tpl = t.name; w.objs.push(o);
        return { obj: Object.assign({}, o), script: t.script };
      }
      case 'w.announce': w.says.push({ to: '(everyone)', text: String(a.t).slice(0, 200) }); return;
      case 'w.confetti': w.says.push({ to: '(effect)', text: 'confetti at ' + Math.round(a.x) + ',' + Math.round(a.y) }); return;
      case 'remote.fire': {
        if (!/^[A-Za-z0-9_.-]{1,40}$/.test(String(a.n))) throw new Error('Remote event names are 1-40 letters, numbers, _ . or -');
        if (w.remote.length < 60) w.remote.push({ event: a.n, to: a.to == null ? (a.except ? 'everyone except ' + a.except : 'everyone') : a.to, args: a.a });
        return;
      }
      default: throw new Error('Unknown script call: ' + String(op).slice(0, 40));
    }
  };
  return w;
}

function runSeal(quickjs, job) {
  const t0 = Date.now();
  const { ScriptVM } = require('./world-scripting-vm');
  const result = { ok: true, output: [], steps: [], notes: [] };
  const world = makeWorld(job);
  let vt = 0;                                                            // virtual time, ms
  const log = (level, text) => { if (result.output.length < MAX_OUTPUT_LINES) result.output.push({ level, text: clip(text, MAX_LINE), at: vt }); else result.truncated = true; };
  const players = (job.players && job.players.length ? job.players : ['Ann']).slice(0, 6).map(String);
  players.forEach(n => world.addPlayer(n));
  const side = job.side === 'object' ? 'object' : 'server';
  const placed = side === 'object' ? world.obj({ kind: 'rock', x: 200, y: 200, w: 60, h: 60 }) : null;
  if (placed) { placed.tpl = 'Item'; world.objs.push(placed); }

  let sb;
  try {
    sb = new ScriptVM({ quickjs, scripts: side === 'object' ? [] : [{ name: 'main', source: String(job.source) }], host: world.host, log });
  } catch (err) { return { ok: false, error: clip(err.message, 300), output: result.output, ms: Date.now() - t0 }; }
  const ev = (kind, payload) => { try { sb.dispatch(kind, payload); } catch (err) { log('error', 'Test harness: ' + clip(err.message, 200)); } };
  const tick = ms => { const end = vt + ms; while (vt < end && !sb.dead) { vt = Math.min(end, vt + 50); ev('tick', { t: vt, dt: 0.05 }); } };
  if (side === 'object') ev('objscript', { id: placed.id, name: 'Item', src: String(job.source) });
  players.forEach(n => ev('join', { n }));
  tick(100);

  for (const raw of (Array.isArray(job.steps) ? job.steps : []).slice(0, 40)) {
    if (sb.dead) { result.notes.push('The scripts were shut off (too slow or out of memory), so later steps were skipped.'); break; }
    const s = raw && typeof raw === 'object' ? raw : {};
    const d = String(s.do || '');
    try {
      if (d === 'join') { const n = String(s.player || ''); if (!n || world.find(n)) throw new Error('join needs a new player name'); world.addPlayer(n); ev('join', { n }); }
      else if (d === 'leave') { const n = String(s.player || ''); const p = world.find(n); if (!p) throw new Error('no such player'); ev('leave', { n: p.name }); world.players.delete(n.toLowerCase()); }
      else if (d === 'fire') { const p = world.find(s.player || players[0]); if (!p) throw new Error('no such player'); ev('remote', { n: String(s.event), p: p.name, a: Array.isArray(s.args) ? s.args : [] }); }
      else if (d === 'wait') tick(clamp(Number(s.ms) || 0, 0, 60000));
      else if (d === 'move') { const p = world.find(s.player || players[0]); if (!p) throw new Error('no such player'); p.x = clamp(Number(s.x), 14, WORLD_W - 14); p.y = clamp(Number(s.y), 14, WORLD_H - 14); }
      else if (d === 'touch') {
        const id = String(s.object || (placed && placed.id) || ''), p = world.find(s.player || players[0]);
        if (!p) throw new Error('no such player');
        if (!world.watch.has(id)) result.notes.push('Step touch: object ' + (id || '(none)') + ' has no onTouch handler, so nothing happened.');
        else ev('touch', { id, n: p.name });
      } else throw new Error('unknown step "' + d.slice(0, 20) + '" (use join, leave, fire, wait, move, touch)');
      tick(100);
      result.steps.push(d);
    } catch (err) { result.notes.push('Step "' + d.slice(0, 20) + '" failed: ' + clip(err.message, 150)); }
  }
  result.ok = !result.output.some(o => o.level === 'error');
  result.final = {
    players: [...world.players.values()].map(world.describe),
    objects: world.objs.slice(0, 30), objectCount: world.objs.length, ground: world.ground
  };
  result.remoteEvents = world.remote; result.messages = world.says.slice(0, 30);
  result.notes.push('This is a simulation: no collisions or real timing, and only the steps you list happen.');
  try { sb.dispose(); } catch { /* ignore */ }
  result.ms = Date.now() - t0;
  return result;
}

main().then(r => parentPort.postMessage({ ok: true, result: r }), e => parentPort.postMessage({ ok: false, error: String(e && e.message ? e.message : e) }));
