'use strict';

/**
 * The QuickJS side of server-side world scripting: one JavaScript engine instance with CPU and
 * memory limits, running the author's scripts on top of world-scripting-api.js.
 *
 * This file is loaded inside a worker thread (world-scripting-worker.js) so that a script can never
 * block the game server; world-scripting.js is the main-thread side. Everything here is
 * synchronous and has no idea about threads, which also makes it easy to unit-test directly.
 *
 * What a script can and can't do:
 *  - It runs in QuickJS, a separate JavaScript engine compiled to WebAssembly. It has no
 *    `process`, `require`, filesystem, network or Node timers: there is simply nothing to reach.
 *  - The only door out is __host(op, json) -> json, and the host decides what each op may do.
 *  - Every run has a CPU budget (the engine checks it between instructions) and the whole engine
 *    has a memory cap. Native builtins can't be interrupted, which is why the thread around this
 *    also has a hard watchdog.
 */

const fs = require('fs');
const path = require('path');

const LIMITS = {
  memoryBytes: 32 * 1024 * 1024,   // per live world
  stackBytes: 512 * 1024,
  loadBudgetMs: 300,               // running one script's top level
  callBudgetMs: 50,                // one event, one tick, one timer burst
  maxStrikes: 5,                   // this many budget overruns in a row and the scripts are shut off
  maxLogChars: 400,
  maxLogsPerSecond: 100
};

const API_SOURCE = fs.readFileSync(path.join(__dirname, 'world-scripting-api.js'), 'utf8');

class ScriptVM {
  /**
   * @param {object} opts
   * @param {object} opts.quickjs  the loaded engine, from require('quickjs-emscripten').getQuickJS()
   * @param {Array<{name:string, source:string}>} opts.scripts  server scripts to run, in order
   * @param {(op:string, args:any) => any} opts.host  implements the API; throw Error(message) for the script to see
   * @param {(level:string, text:string) => void} opts.log  console output and errors
   */
  constructor(opts) {
    this.log = opts.log;
    this.host = opts.host;
    this.dead = false;
    this.strikes = 0;
    this.sawError = false;
    this.deadline = 0;
    this.logWindowStart = 0;
    this.logWindowCount = 0;

    this.rt = opts.quickjs.newRuntime();
    this.rt.setMemoryLimit(LIMITS.memoryBytes);
    this.rt.setMaxStackSize(LIMITS.stackBytes);
    this.rt.setInterruptHandler(() => this.deadline !== 0 && Date.now() > this.deadline);
    this.vm = this.rt.newContext();

    const vm = this.vm;
    const hostFn = vm.newFunction('__host', (opHandle, argHandle) => {
      let out;
      try {
        const op = vm.getString(opHandle);
        const args = JSON.parse(vm.getString(argHandle));
        if (op === 'log') this._console(args);
        else if (op === 'scripterr') this._reportError(cleanFileName(args.l), { message: String(args.m), stack: args.w ? String(args.w) : '' }, false);
        else out = { v: this.host(op, args) };
      } catch (err) {
        out = { e: String(err && err.message ? err.message : err).slice(0, 200) };
      }
      return vm.newString(out === undefined ? '{}' : JSON.stringify(out));
    });
    vm.setProp(vm.global, '__host', hostFn);
    hostFn.dispose();

    try {
      // The API first (a bug here is ours, so let it throw), then the author's scripts.
      this._eval(API_SOURCE, 'world-scripting-api.js', LIMITS.loadBudgetMs, true);
      this.dispatchFn = vm.getProp(vm.global, '__dispatch');
      for (const s of opts.scripts) {
        if (this.dead) break;
        // Each script gets its own function scope so two scripts can both use `const score`. It is an
        // async function, so a script can `await wait(1000)` at the top level like a Roblox thread.
        const label = cleanFileName(s.name);
        this._eval('(async function(){' + s.source + "\n})().catch(function(e){__fail('" + label + "', e);});", label, LIMITS.loadBudgetMs, false);
      }
    } catch (err) {
      this.dispose();
      throw err;
    }
  }

  /** Delivers an event to the scripts: 'join', 'leave', 'remote' or 'tick'. Never throws. */
  dispatch(kind, payload) {
    if (this.dead) return;
    const vm = this.vm;
    const a = vm.newString(kind), b = vm.newString(JSON.stringify(payload));
    this.deadline = Date.now() + LIMITS.callBudgetMs;
    let res;
    try {
      res = vm.callFunction(this.dispatchFn, vm.undefined, a, b);
    } finally {
      a.dispose(); b.dispose();
    }
    this._finish(res, 'event');
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.dead = true;
    try { if (this.dispatchFn) this.dispatchFn.dispose(); } catch { /* already gone */ }
    try { this.vm.dispose(); } catch { /* already gone */ }
    try { this.rt.dispose(); } catch { /* already gone */ }
  }

  /* --- internals --- */

  _eval(code, fileName, budgetMs, mustWork) {
    this.deadline = Date.now() + budgetMs;
    const res = this.vm.evalCode(code, fileName);
    this._finish(res, fileName, mustWork);
  }

  // Common tail of every run: report an error, count budget overruns, let promises settle.
  _finish(res, label, mustWork) {
    let ok = true;
    if (res.error) {
      ok = false;
      const err = this.vm.dump(res.error);
      res.error.dispose();
      this._reportError(label, err, mustWork);
    } else {
      res.value.dispose();
    }
    if (!this.dead) {
      this.deadline = Date.now() + LIMITS.callBudgetMs;
      const jobs = this.rt.executePendingJobs();
      if (jobs.error) {
        ok = false;
        const err = this.vm.dump(jobs.error);
        jobs.error.dispose();
        this._reportError(label, err, false);
      }
    }
    this.deadline = 0;
    if (ok && !this.sawError) this.strikes = 0;
    this.sawError = false;
  }

  _reportError(label, err, mustWork) {
    this.sawError = true;
    const message = err && err.message ? String(err.message) : String(err);
    const where = err && err.stack ? String(err.stack).split('\n')[0].trim() : '';
    if (mustWork) throw new Error('The script API failed to start: ' + message);
    if (message === 'interrupted') {
      this.strikes++;
      this._emit('error', label + ': stopped, it ran for more than ' + LIMITS.callBudgetMs + ' ms in one go (strike ' + this.strikes + ' of ' + LIMITS.maxStrikes + ').');
      if (this.strikes >= LIMITS.maxStrikes) this._shutdown('Server scripts were turned off for this session because they kept running too long. Edit and save them to start again.');
    } else if (message === 'out of memory') {
      this._emit('error', label + ': ran out of memory.');
      this._shutdown('Server scripts were turned off for this session because they ran out of memory.');
    } else {
      this._emit('error', label + ': ' + message + (where ? '  (' + where + ')' : ''));
    }
  }

  _shutdown(why) {
    this.dead = true;
    this._emit('error', why);
  }

  _console(a) {
    const level = ['log', 'info', 'warn', 'error'].includes(a && a.l) ? a.l : 'log';
    this._emit(level, String(a && a.t != null ? a.t : ''));
  }

  _emit(level, text) {
    const now = Date.now();
    if (now - this.logWindowStart > 1000) { this.logWindowStart = now; this.logWindowCount = 0; }
    if (++this.logWindowCount > LIMITS.maxLogsPerSecond) {
      if (this.logWindowCount === LIMITS.maxLogsPerSecond + 1) this.log('warn', 'Too much console output; some lines were dropped.');
      return;
    }
    this.log(level, text.length > LIMITS.maxLogChars ? text.slice(0, LIMITS.maxLogChars) + '…' : text);
  }
}

function cleanFileName(name) {
  return String(name || 'script').replace(/[^\w .-]/g, '_').slice(0, 40) || 'script';
}

module.exports = { ScriptVM, LIMITS };
