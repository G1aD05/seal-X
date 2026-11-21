'use strict';

/**
 * Server-side scripting for Seal Worlds — the main-thread half.
 *
 * Scripts written in the Studio run in their own worker thread, inside QuickJS (a JavaScript
 * engine compiled to WebAssembly). Two layers keep a bad script from hurting the site:
 *
 *   1. Isolation. A script has no `process`, `require`, filesystem or network, only the API in
 *      world-scripting-api.js, which reaches this file through one JSON function. Each op is
 *      checked and applied by worlds.js, so scripts can't touch Seals, accounts or other worlds.
 *   2. Limits. Every event gets a 50 ms CPU budget and the engine a 32 MB memory cap. Plain loops
 *      are stopped by the budget; anything the engine can't interrupt is caught by the watchdog
 *      below, which terminates the whole thread. Either way the game server keeps running.
 *
 * One ScriptSandbox exists per live world (made when the first player joins, dropped when the last
 * one leaves). Nothing a script does is saved; the world's stored layout is never touched.
 */

const path = require('path');
const { Worker } = require('worker_threads');

const WORKER_FILE = path.join(__dirname, 'world-scripting-worker.js');
const RPC_BYTES = 512 * 1024;
const MAX_QUEUED_EVENTS = 300;      // events waiting for the script thread; more than this are dropped
const STALL_MS = 400;               // an event that makes no progress this long gets the thread killed
const LOAD_STALL_MS = 4000;         // start-up allowance (engine + every script's top level)
const WATCHDOG_MS = 100;
const MAX_LIVE_SANDBOXES = 10;      // each one is a thread; this keeps a pile of busy worlds from adding up

const live = new Set();
let watchdog = null;

function startWatchdog() {
  if (watchdog) return;
  watchdog = setInterval(() => {
    const now = Date.now();
    for (const sb of live) sb._checkStall(now);
  }, WATCHDOG_MS);
  watchdog.unref();
}
function stopWatchdogIfIdle() {
  if (!live.size && watchdog) { clearInterval(watchdog); watchdog = null; }
}

class ScriptSandbox {
  /**
   * @param {object} opts
   * @param {Array<{name:string, source:string}>} opts.scripts  server scripts, in order
   * @param {(op:string, args:any) => any} opts.host  runs one API call for a script; throw Error(message) to refuse
   * @param {(level:string, text:string) => void} opts.log  console output and errors
   * @param {() => void} [opts.onDead]  called once if the sandbox stops by itself (killed, out of memory, crashed)
   * @param {() => void} [opts.onReady]  called once every script's top level has run
   */
  constructor(opts) {
    if (live.size >= MAX_LIVE_SANDBOXES) throw new Error('Too many scripted worlds are running at once.');
    this.host = opts.host;
    this.log = opts.log;
    this.onDead = opts.onDead || null;
    this.onReady = opts.onReady || null;
    this.dead = false;
    this.ready = false;
    this.inFlight = 0;
    this.tickPending = false;
    this.lastProgress = Date.now();
    this.stallSeen = false;
    this.droppedWarned = false;
    this.idleWaiters = [];

    this.sab = new SharedArrayBuffer(8 + RPC_BYTES);
    this.ctrl = new Int32Array(this.sab, 0, 2);
    this.worker = new Worker(WORKER_FILE, {
      workerData: { sab: this.sab, scripts: opts.scripts.map(s => ({ name: s.name, source: s.source })) },
      resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 16 }
    });
    this.worker.on('message', m => this._onMessage(m));
    this.worker.on('error', err => this._die('The script engine crashed: ' + (err && err.message ? err.message : err)));
    this.worker.on('exit', () => { if (!this.dead) this._die('The script engine stopped unexpectedly.'); });
    live.add(this);
    startWatchdog();
  }

  /** Queues an event for the scripts: 'join', 'leave', 'remote' or 'tick'. Never throws, never blocks. */
  dispatch(kind, payload) {
    if (this.dead) return false;
    if (kind === 'tick') {
      if (this.tickPending) return false;   // the previous tick hasn't finished: skip rather than pile up
      this.tickPending = true;
    } else if (this.inFlight >= MAX_QUEUED_EVENTS) {
      if (!this.droppedWarned) { this.droppedWarned = true; this.log('warn', 'Scripts are falling behind; some events were dropped.'); }
      return false;
    }
    if (this.inFlight++ === 0) { this.lastProgress = Date.now(); this.stallSeen = false; }
    this.worker.postMessage({ t: 'event', kind, payload });
    return true;
  }

  /** Stops the scripts and frees the thread. Safe to call twice. */
  dispose() {
    this.dead = true;
    live.delete(this);
    stopWatchdogIfIdle();
    this.worker.terminate().catch(() => { /* already gone */ });
    this._settleIdle();
  }

  /** Resolves once the scripts are loaded and every queued event has run (or the sandbox died). For tests. */
  idle() {
    if (this.dead || (this.ready && this.inFlight === 0)) return Promise.resolve();
    return new Promise(resolve => this.idleWaiters.push(resolve));
  }

  /* --- internals --- */

  _onMessage(m) {
    if (this.dead) return;
    switch (m.t) {
      case 'rpc': this._answer(m); break;
      case 'log': this.log(m.level, m.text); break;
      case 'ready':
        this.ready = true; this.lastProgress = Date.now(); this.stallSeen = false; this._settleIdle();
        if (this.onReady) { try { this.onReady(); } catch { /* the owner's problem */ } }
        break;
      case 'done':
        this.inFlight = Math.max(0, this.inFlight - 1);
        if (m.kind === 'tick') this.tickPending = false;
        this.lastProgress = Date.now();
        this.stallSeen = false;
        this._settleIdle();
        break;
      case 'dead': this._die(null); break;      // the engine already logged why
      case 'fatal': this._die('The script engine could not start: ' + m.message); break;
      default: break;
    }
  }

  // Runs one API call for the script thread and wakes it with the JSON answer.
  _answer(m) {
    let out;
    try { out = { v: this.host(m.op, m.a) }; }
    catch (err) { out = { e: String(err && err.message ? err.message : err).slice(0, 200) }; }
    let bytes = Buffer.from(JSON.stringify(out) || '{}');
    if (bytes.length > RPC_BYTES) bytes = Buffer.from('{"e":"That result was too large."}');
    new Uint8Array(this.sab, 8).set(bytes);
    Atomics.store(this.ctrl, 1, bytes.length);
    Atomics.store(this.ctrl, 0, 1);
    Atomics.notify(this.ctrl, 0);
  }

  // Called every 100 ms. The first miss is only noted: if the main thread itself was busy, the
  // thread's "done" message may just not have been read yet. A second miss means it is really stuck.
  _checkStall(now) {
    if (this.dead || (this.inFlight === 0 && this.ready)) return;
    const limit = this.ready ? STALL_MS : LOAD_STALL_MS;
    if (now - this.lastProgress <= limit) return;
    if (!this.stallSeen) { this.stallSeen = true; return; }
    this._die(this.ready
      ? 'Server scripts were turned off: one of them got stuck and could not be interrupted. Edit and save the scripts to start again.'
      : 'Server scripts were turned off: they took too long to start. Edit and save the scripts to start again.');
  }

  _die(message) {
    if (this.dead) return;
    if (message) this.log('error', message);
    this.dispose();
    if (this.onDead) { try { this.onDead(); } catch { /* the owner's problem */ } }
  }

  _settleIdle() {
    if (!this.idleWaiters.length) return;
    if (!this.dead && !(this.ready && this.inFlight === 0)) return;
    for (const resolve of this.idleWaiters.splice(0)) resolve();
  }
}

module.exports = { ScriptSandbox, MAX_LIVE_SANDBOXES, STALL_MS };
