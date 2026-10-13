'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const sandbox = require('../ai-sandbox');
const { runTool, TOOLS } = require('../ai-tools');
const { createAiService } = require('../ollama-ai');

test('plain JavaScript: output, result and errors are captured', async () => {
  const ok = await sandbox.runJavaScript('console.log("hi", [1,2].map(x => x * 2)); 40 + 2');
  assert.equal(ok.ok, true); assert.match(ok.output[0].text, /hi/); assert.match(String(ok.result), /42/);
  const bad = await sandbox.runJavaScript('null.foo');
  assert.equal(bad.ok, false); assert.ok(bad.error);
});

test('the sandbox has no Node, no network, and stops infinite loops', async () => {
  const r = await sandbox.runJavaScript('console.log(typeof require, typeof process, typeof fetch, typeof window)');
  assert.match(r.output[0].text, /undefined undefined undefined undefined/);
  const t0 = Date.now();
  const loop = await sandbox.runJavaScript('while (true) {}');
  assert.equal(loop.ok, false); assert.ok(Date.now() - t0 < 6500);
});

test('Seal scripts run in a simulated world and obvious mistakes are flagged', async () => {
  const r = await sandbox.testSealScript({ side: 'server', source: 'players.onJoin(p => { p.speed = 2; console.log("hi " + p.name); });', players: ['Ann'] });
  assert.equal(r.ok, true); assert.match(JSON.stringify(r.output), /hi Ann/);
  assert.equal(r.final.players[0].speed, 2);
  const bad = await sandbox.testSealScript({ side: 'server', source: 'players.onJoin(p => { p.speed(2); });' });
  assert.equal(bad.ok, false); assert.match(JSON.stringify(bad.problems), /property, not a function/);
});

test('tool wrapper formats results and never throws', async () => {
  const a = await runTool('run_javascript', { code: 'console.log(1+1)' });
  assert.equal(a.ok, true); assert.match(a.text, /2/);
  const b = await runTool('run_javascript', '{"code":"throw new Error(\\"boom\\")"}');
  assert.equal(b.ok, false); assert.match(b.text, /boom/);
  assert.equal((await runTool('nope', {})).ok, false);
  assert.deepEqual(TOOLS.map(t => t.function.name), ['run_javascript', 'test_seal_script']);
});

test('the AI can call a tool, see the result, and then answer', async () => {
  const calls = [];
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', c => b += c);
    req.on('end', () => {
      const J = JSON.parse(b); calls.push(J);
      res.setHeader('content-type', 'application/x-ndjson');
      const hasTool = J.messages.some(m => m.role === 'tool');
      if (!hasTool) res.end(JSON.stringify({ message: { role: 'assistant', content: '', tool_calls: [{ function: { name: 'run_javascript', arguments: { code: 'console.log(6*7)' } } }] } }) + '\n{"done":true}\n');
      else res.end(JSON.stringify({ message: { content: 'It printed 42.' } }) + '\n{"done":true}\n');
    });
  });
  await new Promise(r => srv.listen(0, r));
  const ai = createAiService({ host: 'http://127.0.0.1:' + srv.address().port, model: 'm' });
  const events = []; let text = '';
  await ai.stream([{ role: 'user', content: 'run it' }], { tools: TOOLS, runTool, onContent: t => { text += t; }, onTool: t => events.push(t.phase + ':' + (t.ok === undefined ? '' : t.ok)) });
  srv.close();
  assert.equal(text, 'It printed 42.'); assert.deepEqual(events, ['start:', 'done:true']);
  assert.ok(calls[0].tools && calls[0].tools.length === 2);
  const toolMsg = calls[1].messages.find(m => m.role === 'tool'); assert.match(toolMsg.content, /42/);
  assert.equal(calls[1].messages.find(m => m.tool_calls).role, 'assistant');
});
