'use strict';
// Talks to an Ollama server (local, or ollama.com with an API key) for the built-in Seal AI page.
// The browser never sees the host or key: it only talks to this site's /api/ai/* routes.

const fs = require('fs');

const MAX_HISTORY = 24;          // messages kept from the conversation sent with each question
const MAX_MESSAGE_CHARS = 4000;  // per message
const MAX_TOTAL_CHARS = 24000;   // whole conversation

const SYSTEM_PROMPT = [
  'You are Seal AI, the assistant built into the Seal website (a site with games, tools, chat, a Seals currency and multiplayer Worlds with scripting). You are also a general coding assistant: you can help write, explain and debug code in any language (JavaScript, Python, HTML/CSS, C#, SQL, shell and so on), not only Seal scripts.',
  'Be friendly, clear and concise. Use short paragraphs, and put code in fenced code blocks tagged with the language.',
  'You have sandbox tools. run_javascript runs plain JavaScript; test_seal_script runs Seal Worlds server and object scripts in a simulated world (client scripts are only checked, not run). Before you show JavaScript or a Seal script, test it with the right tool, fix any failure, and test again. Keep tests small. Never claim you tested something you did not: code in other languages cannot be run, so say it is untested. If the simulation differs from the real game (no collisions, simplified timing), say what you could and could not verify.',
  'You can only see this conversation. You cannot look at the site, accounts, balances, chat or anyone\'s data, and you cannot take actions on the site, so never claim to.',
  'Do not ask for passwords or personal information. If someone asks for something unsafe (malware, attacks, hacking other people), say you can\'t help with that.',
  'IMPORTANT: scripts in Seal Worlds are written in JavaScript, NOT Lua. Seal is not Roblox: never give Lua or Roblox API code (no game.Players, Instance.new, :Connect(), wait() in Lua style).',
  'For anything about Seal Worlds, scripting, RemoteEvents, the Studio or Storage, answer only from the reference below and write JavaScript that uses only the functions it lists. If the reference doesn\'t cover something, say so instead of guessing. For code outside Seal Worlds, use normal best practice for that language and do not use Seal-specific functions.'
].join(' ');

// The scripting guide page (public/scripting.html) turned into plain text, so the AI always answers from
// the real, current docs. Re-read whenever the file changes.
function htmlToText(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, '')
    .replace(/<\/(tr|p|h\d|li|pre|div|section)>/g, '\n').replace(/<th[^>]*>/g, ' | ').replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
function docsReader(file) {
  let text = '', mtime = 0;
  return function () {
    if (!file) return '';
    try { const m = fs.statSync(file).mtimeMs; if (m !== mtime) { text = htmlToText(fs.readFileSync(file, 'utf8')).slice(0, 30000); mtime = m; } } catch { text = ''; }
    return text;
  };
}

function sanitizeMessages(raw) {
  if (!Array.isArray(raw) || !raw.length) return { error: 'Send at least one message.' };
  const out = [];
  for (const m of raw.slice(-MAX_HISTORY)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return { error: 'Invalid conversation.' };
    const content = m.content.trim();
    if (!content) continue;
    if (content.length > MAX_MESSAGE_CHARS) return { error: `Messages are limited to ${MAX_MESSAGE_CHARS} characters.` };
    out.push({ role: m.role, content });
  }
  if (!out.length || out[out.length - 1].role !== 'user') return { error: 'The last message must be yours.' };
  while (out[0].role !== 'user') out.shift();           // history trimming must not start on a reply
  if (out.reduce((n, m) => n + m.content.length, 0) > MAX_TOTAL_CHARS) return { error: 'This conversation is too long. Clear it and start again.' };
  return { messages: out };
}

function createAiService(opts) {
  opts = opts || {};
  const host = String(opts.host || 'http://localhost:11434').replace(/\/+$/, '');
  const model = opts.model || 'gpt-oss:120b';
  const apiKey = opts.apiKey || '';
  const think = opts.think === undefined ? 'low' : opts.think; // gpt-oss takes low | medium | high; '' leaves it to the server
  const doFetch = opts.fetch || fetch;
  const readDocs = docsReader(opts.docsFile);
  const headers = { 'content-type': 'application/json' };
  if (apiKey) headers.authorization = 'Bearer ' + apiKey;
  let cached = null, cachedAt = 0;

  // Is the Ollama server reachable, and does it list the model? Cached for 20 seconds.
  async function status() {
    if (cached && Date.now() - cachedAt < 20000) return cached;
    let result;
    try {
      const r = await doFetch(host + '/api/tags', { headers, signal: AbortSignal.timeout(6000) });
      if (!r.ok) result = { reachable: false, model, error: r.status === 401 || r.status === 403 ? 'The Ollama API key was rejected.' : `The Ollama server answered ${r.status}.` };
      else {
        const j = await r.json().catch(() => ({}));
        const names = (j.models || []).map(x => x.name || x.model);
        result = { reachable: true, model, modelListed: names.some(n => n === model || n === model + ':latest') };
      }
    } catch { result = { reachable: false, model, error: 'Can’t reach the Ollama server.' }; }
    cached = result; cachedAt = Date.now();
    return result;
  }

  // Streams the reply. onThinking() fires (many times) while the model reasons; onContent(text) with each piece.
  async function stream(messages, o) {
    o = o || {};
    const docs = readDocs();
    const system = docs ? SYSTEM_PROMPT + '\n\nSEAL WORLDS SCRIPTING REFERENCE (the only source of truth for Worlds):\n' + docs : SYSTEM_PROMPT;
    const convo = [{ role: 'system', content: system }].concat(messages);
    const maxRounds = o.tools && o.runTool ? (o.maxRounds || 5) : 1;
    let toolRuns = 0;
    for (let round = 0; round < maxRounds; round++) {
      const last = round === maxRounds - 1;
      const body = { model, stream: true, messages: convo, options: { num_predict: opts.maxTokens || 3000 } };
      if (think) body.think = think;
      if (o.tools && o.runTool && !last) body.tools = o.tools;
      const r = await doFetch(host + '/api/chat', { method: 'POST', headers, body: JSON.stringify(body), signal: o.signal });
      if (!r.ok) {
        let detail = ''; try { detail = (await r.json()).error || ''; } catch { /* no body */ }
        const e = new Error(r.status === 401 || r.status === 403 ? 'The Ollama API key was rejected.' : r.status === 404 ? `The model ${model} isn’t available on the Ollama server.` : `The AI server returned an error (${r.status}).`);
        e.detail = detail; throw e;
      }
      const decoder = new TextDecoder();
      let buf = '', content = '', thinkText = '';
      const calls = [];
      const handle = line => {
        if (!line.trim()) return;
        let j; try { j = JSON.parse(line); } catch { return; }
        if (j.error) { const e = new Error('The AI server reported an error.'); e.detail = String(j.error); throw e; }
        const m = j.message || {};
        if (m.thinking) { thinkText += m.thinking; if (o.onThinking) o.onThinking(); }
        if (m.content) { content += m.content; if (o.onContent) o.onContent(m.content); }
        if (Array.isArray(m.tool_calls)) for (const c of m.tool_calls) if (c && c.function && c.function.name) calls.push(c);
      };
      for await (const chunk of r.body) {
        buf += decoder.decode(chunk, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) { handle(buf.slice(0, i)); buf = buf.slice(i + 1); }
      }
      handle(buf);
      if (!calls.length) return;
      const assistant = { role: 'assistant', content, tool_calls: calls };
      if (thinkText) assistant.thinking = thinkText;
      convo.push(assistant);
      for (const c of calls) {
        const name = c.function.name;
        let res;
        if (toolRuns >= (o.maxToolRuns || 6)) res = { text: 'Tool limit reached for this question. Answer now with what you know and say what was not tested.', ok: false, summary: 'Limit reached' };
        else {
          toolRuns++;
          if (o.onTool) o.onTool({ name, phase: 'start', args: c.function.arguments });
          res = await o.runTool(name, c.function.arguments);
        }
        if (o.onTool) o.onTool({ name, phase: 'done', ok: res.ok, summary: res.summary, args: c.function.arguments, result: res.text });
        convo.push({ role: 'tool', tool_name: name, content: res.text });
      }
    }
  }

  return { model, host, status, stream };
}

module.exports = { htmlToText, createAiService, sanitizeMessages, SYSTEM_PROMPT, MAX_HISTORY, MAX_MESSAGE_CHARS };
