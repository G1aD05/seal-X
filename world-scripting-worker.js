'use strict';

/**
 * Worker-thread entry for server-side world scripts (see world-scripting.js, which starts this).
 *
 * The scripts' API calls need an answer straight away ("what is this player's x?"), but the world
 * lives on the main thread. So each call is a tiny synchronous round trip: post the request to the
 * main thread, then sleep on a shared-memory flag (Atomics.wait) until it writes the reply. Only
 * this thread sleeps; the game server keeps running, and if a script gets stuck inside something
 * the engine can't interrupt, the main thread simply terminates this whole thread.
 */

const { parentPort, workerData } = require('worker_threads');

const RPC_TIMEOUT_MS = 2000;
const ctrl = new Int32Array(workerData.sab, 0, 2);   // [0] reply flag, [1] reply length in bytes
const replyBytes = new Uint8Array(workerData.sab, 8);
const decoder = new TextDecoder();

/** Asks the main thread to run one API op and waits for its JSON answer. */
function rpc(op, args) {
  Atomics.store(ctrl, 0, 0);
  parentPort.postMessage({ t: 'rpc', op, a: args });
  if (Atomics.wait(ctrl, 0, 0, RPC_TIMEOUT_MS) === 'timed-out') throw new Error('The server was too busy to answer.');
  const len = Atomics.load(ctrl, 1);
  const out = JSON.parse(decoder.decode(replyBytes.slice(0, len)));
  if (out.e !== undefined) throw new Error(out.e);
  return out.v;
}

let vm = null;
const early = [];   // events that arrive while the engine is still starting

function handle(msg) {
  if (msg.t !== 'event') return;
  vm.dispatch(msg.kind, msg.payload);
  parentPort.postMessage({ t: 'done', kind: msg.kind });
  if (vm.dead) parentPort.postMessage({ t: 'dead' });
}

parentPort.on('message', msg => { if (vm) handle(msg); else early.push(msg); });

(async () => {
  try {
    const { getQuickJS } = require('quickjs-emscripten');
    const { ScriptVM } = require('./world-scripting-vm');
    const quickjs = await getQuickJS();
    vm = new ScriptVM({
      quickjs,
      scripts: workerData.scripts,
      host: rpc,
      log: (level, text) => parentPort.postMessage({ t: 'log', level, text })
    });
    parentPort.postMessage({ t: 'ready' });
    if (vm.dead) parentPort.postMessage({ t: 'dead' });
    for (const msg of early.splice(0)) handle(msg);
  } catch (err) {
    parentPort.postMessage({ t: 'fatal', message: String(err && err.message ? err.message : err) });
  }
})();
