'use strict';
// Tools the Seal AI can call to test code before it answers. Results are plain strings sent back to the model.
const sandbox = require('./ai-sandbox');

const MAX_RESULT_CHARS = 2400;
const MAX_TOOL_RUNS = 6; // per question

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'run_javascript',
      description: 'Run plain JavaScript in a locked-down sandbox (no network, files, require or Node/browser APIs; 3 second limit) and get back console output, the final value and any error. Use it to test JavaScript before showing it. Not for Seal World scripts: use test_seal_script for those.',
      parameters: { type: 'object', properties: { code: { type: 'string', description: 'The JavaScript to run. console.log output is captured.' } }, required: ['code'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'test_seal_script',
      description: 'Test a Seal Worlds script in a simulated world. side is "server", "client" or "object" (a script attached to one object). Server and object scripts are run with players you describe and a list of steps; client scripts can only be checked for mistakes, not run. Returns lint problems, script output, what happened and the final world state.',
      parameters: {
        type: 'object',
        properties: {
          side: { type: 'string', enum: ['server', 'client', 'object'] },
          source: { type: 'string', description: 'The script source.' },
          players: { type: 'array', items: { type: 'string' }, description: 'Player names to have join first (default: one player).' },
          steps: { type: 'array', items: { type: 'object' }, description: 'Optional steps, e.g. {"join":"Ann"}, {"leave":"Ann"}, {"wait":2000}, {"move":"Ann","x":100,"y":200}, {"touch":"Ann"}, {"fire":"EventName","player":"Ann","args":[1]}.' },
          storage: { type: 'object', description: 'Optional Replicated Storage templates, e.g. {"Item":{"kind":"rock"}}.' }
        },
        required: ['side', 'source']
      }
    }
  }
];

function clip(s) {
  s = String(s);
  return s.length > MAX_RESULT_CHARS ? s.slice(0, MAX_RESULT_CHARS) + '\n…(cut off)' : s;
}
function fmtJs(r) {
  const lines = [];
  lines.push(r.ok ? 'Ran without errors.' : 'FAILED.');
  if (r.output && r.output.length) lines.push('Output:\n' + r.output.map(o => (o.level && o.level !== 'log' ? '[' + o.level + '] ' : '') + o.text).join('\n'));
  if (r.result !== undefined) lines.push('Final value: ' + r.result);
  if (r.error) lines.push('Error: ' + (typeof r.error === 'string' ? r.error : JSON.stringify(r.error)));
  if (r.truncated) lines.push('(output was cut off)');
  return clip(lines.join('\n'));
}
function fmtSeal(r) {
  const lines = [r.ok ? 'Script ran OK.' : 'Script has PROBLEMS.'];
  if (r.problems && r.problems.length) lines.push('Problems:\n' + r.problems.map(p => 'line ' + p.line + ' (' + p.severity + '): ' + p.message).join('\n'));
  if (r.notes && r.notes.length) lines.push('Notes: ' + [].concat(r.notes).join('; '));
  if (r.output && r.output.length) lines.push('Output:\n' + r.output.map(o => (o.at != null ? '[' + o.at + 'ms] ' : '') + (o.level && o.level !== 'log' ? '[' + o.level + '] ' : '') + o.text).join('\n'));
  if (r.remoteEvents && r.remoteEvents.length) lines.push('Remote events: ' + JSON.stringify(r.remoteEvents));
  if (r.messages && r.messages.length) lines.push('Messages: ' + JSON.stringify(r.messages));
  if (r.final) lines.push('Final world: ' + JSON.stringify(r.final));
  if (r.error) lines.push('Error: ' + (typeof r.error === 'string' ? r.error : JSON.stringify(r.error)));
  return clip(lines.join('\n'));
}

// Returns { text, summary, ok } for one tool call. Never throws.
async function runTool(name, args) {
  if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = {}; } }
  args = args && typeof args === 'object' ? args : {};
  try {
    if (name === 'run_javascript') {
      const r = await sandbox.runJavaScript(args.code);
      return { text: fmtJs(r), ok: !!r.ok, summary: 'Ran JavaScript' };
    }
    if (name === 'test_seal_script') {
      const r = await sandbox.testSealScript({ side: args.side, source: args.source, storage: args.storage, steps: args.steps, players: args.players });
      return { text: fmtSeal(r), ok: !!r.ok, summary: 'Tested ' + (args.side || 'Seal') + ' script' };
    }
    return { text: 'Unknown tool: ' + name, ok: false, summary: 'Unknown tool' };
  } catch (e) {
    return { text: 'The sandbox could not run this: ' + (e && e.message || e), ok: false, summary: name };
  }
}

module.exports = { TOOLS, runTool, MAX_TOOL_RUNS };
