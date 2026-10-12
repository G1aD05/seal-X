/* Seal AI page. The conversation lives only in this tab (nothing is saved); each question sends the
   recent history to /api/ai/chat, which streams the answer back as one JSON object per line. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var history = [], busy = false, controller = null;

  /* A small, safe renderer: fenced code, `inline code` and **bold**. Everything is inserted as text nodes. */
  function renderInline(parent, text) {
    text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).forEach(function (part) {
      if (!part) return;
      var el;
      if (part.length > 2 && part[0] === '`' && part[part.length - 1] === '`') { el = document.createElement('code'); el.textContent = part.slice(1, -1); }
      else if (part.length > 4 && part.slice(0, 2) === '**' && part.slice(-2) === '**') { el = document.createElement('strong'); el.textContent = part.slice(2, -2); }
      else el = document.createTextNode(part);
      parent.appendChild(el);
    });
  }
  function render(target, text) {
    target.textContent = '';
    var parts = text.split(/```/);
    parts.forEach(function (part, i) {
      if (i % 2 === 1) {                                   // inside a fence (an unfinished one counts too, while streaming)
        var nl = part.indexOf('\n'), body = nl >= 0 && /^[\w+#.-]*$/.test(part.slice(0, nl).trim()) ? part.slice(nl + 1) : part;
        var pre = document.createElement('pre'), code = document.createElement('code');
        code.textContent = body.replace(/\n$/, ''); pre.appendChild(code); target.appendChild(pre);
      } else if (part) {
        var block = document.createElement('div'); block.className = 'ai-text';
        part.replace(/^\n+|\n+$/g, '').split('\n').forEach(function (line, n, arr) { renderInline(block, line); if (n < arr.length - 1) block.appendChild(document.createElement('br')); });
        target.appendChild(block);
      }
    });
  }

  function addMessage(role) {
    var row = document.createElement('div'); row.className = 'ai-msg ai-' + role;
    var who = document.createElement('div'); who.className = 'ai-who'; who.textContent = role === 'user' ? 'You' : 'Seal AI';
    var body = document.createElement('div'); body.className = 'ai-body';
    row.append(who, body); $('ai-log').appendChild(row);
    $('ai-empty').classList.add('hidden');
    $('ai-log').scrollTop = $('ai-log').scrollHeight;
    return body;
  }
  function setBusy(on) {
    busy = on; $('ai-send').classList.toggle('hidden', on); $('ai-stop').classList.toggle('hidden', !on); $('ai-input').disabled = false;
  }
  function notice(text) { var n = $('ai-notice'); n.textContent = text || ''; n.classList.toggle('hidden', !text); }
  function autosize() { var t = $('ai-input'); t.style.height = 'auto'; t.style.height = Math.min(160, t.scrollHeight) + 'px'; }

  async function ask(text) {
    notice('');
    history.push({ role: 'user', content: text });
    render(addMessage('user'), text);
    var body = addMessage('assistant'), answer = '';
    body.classList.add('ai-pending'); body.textContent = 'Thinking…';
    setBusy(true); controller = new AbortController();
    try {
      var res = await fetch('/api/ai/chat', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: history }), signal: controller.signal });
      if (!res.ok) { var j = {}; try { j = await res.json(); } catch (e) { /* no body */ } throw new Error(j.error || 'The AI could not answer (' + res.status + ').'); }
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
      for (;;) {
        var r = await reader.read(); if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        var i;
        while ((i = buf.indexOf('\n')) >= 0) {
          var line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (!line.trim()) continue;
          var m; try { m = JSON.parse(line); } catch (e) { continue; }
          if (m.type === 'content') { answer += m.text; body.classList.remove('ai-pending'); render(body, answer); $('ai-log').scrollTop = $('ai-log').scrollHeight; }
          else if (m.type === 'error') throw new Error(m.error);
        }
      }
      if (!answer) throw new Error('The AI sent an empty answer. Try again.');
      history.push({ role: 'assistant', content: answer });
    } catch (err) {
      if (err.name === 'AbortError') {                      // the Stop button: keep what arrived
        if (answer) history.push({ role: 'assistant', content: answer }); else { history.pop(); body.parentNode.remove(); }
      } else {
        history.pop(); if (!answer) body.parentNode.remove();
        notice(err.message || 'Something went wrong.');
      }
    } finally { body.classList.remove('ai-pending'); setBusy(false); controller = null; $('ai-input').focus(); }
  }

  function send() {
    if (busy) return;
    var t = $('ai-input'), text = t.value.trim();
    if (!text) return;
    t.value = ''; autosize(); ask(text);
  }

  async function init() {
    var signedIn = typeof CURRENT_USER !== 'undefined' && !!(CURRENT_USER && CURRENT_USER.username);
    $('ai-signed-out').classList.toggle('hidden', signedIn); $('ai-app').classList.toggle('hidden', !signedIn);
    if (!signedIn) return;
    try {
      var st = await (await fetch('/api/ai/status', { credentials: 'same-origin' })).json();
      $('ai-model').textContent = st.model ? 'Model: ' + st.model : '';
      if (!st.enabled) { notice((st.reason || 'The AI isn’t available right now.') + ' Ask whoever runs the site to check the Ollama setup.'); $('ai-input').disabled = true; $('ai-send').disabled = true; }
    } catch (e) { notice('Couldn’t check whether the AI is available.'); }
  }

  $('ai-form').addEventListener('submit', function (e) { e.preventDefault(); send(); });
  $('ai-input').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
  $('ai-input').addEventListener('input', autosize);
  $('ai-stop').addEventListener('click', function () { if (controller) controller.abort(); });
  $('ai-clear').addEventListener('click', function () {
    if (controller) controller.abort();
    history = []; var log = $('ai-log'); Array.prototype.slice.call(log.querySelectorAll('.ai-msg')).forEach(function (n) { n.remove(); }); $('ai-empty').classList.remove('hidden'); notice('');
  });
  $('ai-empty').addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button[data-ask]');
    if (b && !busy && !$('ai-input').disabled) ask(b.getAttribute('data-ask'));
  });
  document.addEventListener('seal:user-ready', init);
  if (typeof initSealPage === 'function') initSealPage();
})();
