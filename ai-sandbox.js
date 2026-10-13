'use strict';
// The AI's test bench. Everything the model wants to run goes through here, into a throwaway worker thread
// that runs it inside QuickJS (a JavaScript engine compiled to WebAssembly): no network, no files, no
// process, no access to this site's data. The worker has a memory cap, an interrupt-based CPU limit, and
// the thread is terminated outright if it overruns, so a bad script can only hurt itself.

const path = require('path');
const { Worker } = require('worker_threads');
const ScriptLSP = require('./public/js/script-lsp');

const WALL_MS = 6000;            // the whole worker, startup included
const MAX_CODE_CHARS = 20000;
const MAX_CONCURRENT = 2;        // sandboxes running at once, site-wide
let running = 0;

function runInWorker(job) {
  return new Promise(resolve => {
    if (running >= MAX_CONCURRENT) return resolve({ ok: false, error: 'The sandbox is busy right now. Try again in a moment.' });
    running++;
    let done = false;
    const worker = new Worker(path.join(__dirname, 'ai-sandbox-worker.js'), { workerData: { job }, resourceLimits: { maxOldGenerationSizeMb: 160, maxYoungGenerationSizeMb: 24 } });
    const finish = value => { if (done) return; done = true; clearTimeout(timer); running--; worker.terminate().catch(() => {}); resolve(value); };
    const timer = setTimeout(() => finish({ ok: false, error: 'Stopped: the test took longer than ' + WALL_MS / 1000 + ' seconds.' }), WALL_MS);
    worker.on('message', m => finish(m.ok ? m.result : { ok: false, error: 'The sandbox failed: ' + m.error }));
    worker.on('error', err => finish({ ok: false, error: 'The sandbox crashed: ' + String(err && err.message || err).slice(0, 200) }));
    worker.on('exit', () => finish({ ok: false, error: 'The sandbox stopped unexpectedly.' }));
  });
}

/** Runs plain JavaScript. Returns { ok, output:[{level,text}], result?, error?, ms }. */
async function runJavaScript(code) {
  code = String(code == null ? '' : code);
  if (!code.trim()) return { ok: false, error: 'No code was given.' };
  if (code.length > MAX_CODE_CHARS) return { ok: false, error: 'The code is too long to test (limit ' + MAX_CODE_CHARS + ' characters).' };
  return runInWorker({ kind: 'js', code });
}

/**
 * Tests a Seal world script. side: 'server' | 'client' | 'object'.
 *  - server / object: run in a simulated world and replay `steps`.
 *  - client: client scripts need a browser (camera, UI, keys), so they are only checked for mistakes.
 * Every side also gets the Studio's own language-service checks (unknown functions, wrong-side API, read-only writes).
 */
async function testSealScript(args) {
  const side = ['server', 'client', 'object'].includes(args && args.side) ? args.side : null;
  const source = String(args && args.source != null ? args.source : '');
  if (!side) return { ok: false, error: 'side must be "server", "client" or "object".' };
  if (!source.trim()) return { ok: false, error: 'No script was given.' };
  if (source.length > 4000 && side === 'object') return { ok: false, error: 'Storage item scripts are limited to 4000 characters.' };
  if (source.length > MAX_CODE_CHARS) return { ok: false, error: 'The script is too long to test.' };
  const storage = (Array.isArray(args.storage) ? args.storage : []).slice(0, 10).filter(t => t && typeof t.name === 'string');
  let problems = [];
  try {
    const svc = ScriptLSP.create({ side, storage: storage.map(t => t.name), remotes: [] });
    problems = svc.diagnostics(source).slice(0, 15).map(d => ({ line: d.line + 1, severity: d.severity, message: d.message }));
  } catch { /* the checker is a bonus; the run below still happens */ }
  if (side === 'client') {
    // Compile-only check: wrap the body in a function that is never called.
    const syntax = await runJavaScript('(function(){' + source + '\n})');
    return { ok: !problems.some(p => p.severity === 'error') && syntax.ok, side, tested: 'checked only, not run', syntaxError: syntax.ok ? undefined : syntax.error, problems, notes: ['Client scripts can only be checked here: they need a real browser to run (camera, ui, keyboard). Review the problems list.'] };
  }
  const steps = typeof args.steps === 'string' ? safeJson(args.steps) : args.steps;
  const players = typeof args.players === 'string' ? safeJson(args.players) : args.players;
  const res = await runInWorker({ kind: 'seal', side, source, storage, steps: Array.isArray(steps) ? steps : [], players: Array.isArray(players) ? players : [] });
  res.problems = problems;
  if (problems.some(p => p.severity === 'error')) res.ok = false;
  return res;
}
function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

module.exports = { runJavaScript, testSealScript, MAX_CODE_CHARS };
