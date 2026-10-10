/* A tiny JavaScript syntax highlighter for the Studio's script editor and the scripting guide.
   highlightJS(source) returns HTML (everything escaped) with <span class="tk-…"> around tokens.
   It is a colouring aid, not a parser: it never rejects anything and never changes the text. */
(function (global) {
  'use strict';
  var KEYWORDS = toSet('const let var function return if else for while do break continue new typeof instanceof in of await async try catch finally throw switch case default class extends delete void yield static get set import export from as');
  var LITERALS = toSet('true false null undefined this NaN Infinity');
  // The script API (server and client), so the things this world gives you stand out from plain JavaScript.
  var API = toSet('players world Storage ReplicatedStorage Remote object onTick wait camera ui input effects localPlayer onFrame console print');
  var BUILTIN = toSet('Math JSON Number String Array Object Date Promise Boolean Map Set Symbol Error RegExp parseInt parseFloat isNaN isFinite setTimeout setInterval clearTimeout clearInterval');
  var RE = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\[\s\S]|[^`\\])*`?)|(0x[0-9a-f]+|\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b)|([A-Za-z_$][\w$]*)|(=>|[{}()\[\];,.<>+\-*\/%=!&|?:^~]+)/gi;

  function toSet(s) { var o = {}; s.split(' ').forEach(function (k) { o[k] = true; }); return o; }
  function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function span(cls, t) { return '<span class="tk-' + cls + '">' + esc(t) + '</span>'; }

  global.highlightJS = function (src) {
    var out = '', last = 0, prevWord = '', prevChar = '', m;
    RE.lastIndex = 0;
    while ((m = RE.exec(src))) {
      if (m.index > last) { var gap = src.slice(last, m.index); out += esc(gap); if (/\S/.test(gap)) { prevChar = gap.replace(/\s+$/, '').slice(-1); prevWord = ''; } }
      var t = m[0];
      if (m[1]) out += span('com', t);
      else if (m[2]) out += span('str', t);
      else if (m[3]) out += span('num', t);
      else if (m[4]) {
        var next = src.charAt(RE.lastIndex), after = src.slice(RE.lastIndex).match(/^\s*(\()?/), call = !!(after && after[1]);
        var cls = null;
        if (prevChar === '.') cls = call ? 'fn' : 'prop';
        else if (KEYWORDS[t]) cls = 'kw';
        else if (LITERALS[t]) cls = 'lit';
        else if (API[t]) cls = 'api';
        else if (BUILTIN[t]) cls = 'bi';
        else if (call || prevWord === 'function') cls = 'fn';
        out += cls ? span(cls, t) : esc(t);
        prevWord = t; prevChar = '';
        void next;
      } else { out += span('p', t); prevChar = t.slice(-1); prevWord = ''; }
      last = RE.lastIndex;
    }
    return out + esc(src.slice(last));
  };
})(window);
