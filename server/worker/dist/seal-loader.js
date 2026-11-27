/* Seal loading screen — dashed rings orbiting a hatched hexagon
   (inspired by the Cloudflare dashboard loader). Self-contained: injects its own
   CSS + markup, shows until the page (and iframes) finish loading, then fades out.
   Manual use:  SealLoader.show()  /  SealLoader.hide()
   Skip on a page with <html data-no-loader>. */
(function () {
  if (window.SealLoader || document.documentElement.hasAttribute('data-no-loader')) return;
  var HEX = 'M50 20 L76 35 L76 65 L50 80 L24 65 L24 35 Z';
  var svg =
    '<svg class="sl-svg" viewBox="0 0 100 100" width="260" height="260" aria-hidden="true">' +
    '<defs>' +
      '<pattern id="sl-hatch" patternUnits="userSpaceOnUse" width="1.6" height="1.6" patternTransform="rotate(35)">' +
        '<path d="M0 -1V4" stroke="currentColor" stroke-width=".2" fill="none"/></pattern>' +
      '<mask id="sl-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">' +
        '<rect width="100" height="100" fill="white"/><path d="' + HEX + '" fill="black" stroke="black" stroke-width=".8" stroke-linejoin="round"/></mask>' +
    '</defs>' +
    '<g mask="url(#sl-cut)">' +
      '<g class="sl-guides"><path d="M0 50H100M50 0V100"/></g>' +
      '<circle class="sl-ring sl-a" pathLength="100" cx="50" cy="50" r="46"/>' +
      '<circle class="sl-ring sl-b" pathLength="100" cx="50" cy="50" r="38"/>' +
      '<circle class="sl-ring sl-c" pathLength="100" cx="50" cy="50" r="30"/>' +
      '<circle class="sl-ring sl-d" pathLength="100" cx="50" cy="50" r="22"/>' +
    '</g>' +
    '<path class="sl-hex" d="' + HEX + '" fill="url(#sl-hatch)"/>' +
    '</svg>';

  var css =
    '#seal-loader{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;' +
      'background:radial-gradient(55% 45% at 50% 45%,rgba(15,98,240,.16),transparent 70%),#0a0a0a;color:#8c8c8c;transition:opacity .35s ease,visibility .35s}' +
    '#seal-loader.sl-out{opacity:0;visibility:hidden;pointer-events:none}' +
    '#seal-loader .sl-svg{overflow:visible}' +
    '#seal-loader .sl-guides path{fill:none;stroke:#555;stroke-width:.2;stroke-dasharray:.65 .9}' +
    '#seal-loader .sl-ring{fill:none;stroke-width:.5;stroke-linecap:round;stroke-dasharray:1 1.5;animation:sl-dash 6.4s linear infinite}' +
    '#seal-loader .sl-a{stroke:#f6821f}#seal-loader .sl-b{stroke:#2c7aec;animation-delay:-1.6s}' +
    '#seal-loader .sl-c{stroke:#f6821f;animation-delay:-3.2s}#seal-loader .sl-d{stroke:#2c7aec;animation-delay:-4.8s}' +
    '#seal-loader .sl-hex{stroke:#f6821f;stroke-width:.5;stroke-linejoin:round;color:#f6821f}' +
    '#seal-loader .sl-label{font:500 13px Inter,system-ui,sans-serif;letter-spacing:.02em}' +
    '@keyframes sl-dash{to{stroke-dashoffset:-10}}' +
    '@media (prefers-reduced-motion:reduce){#seal-loader .sl-ring{animation:none}}' +
    '.sl-inline{display:inline-flex;flex-direction:column;align-items:center}';

  var style = document.createElement('style'); style.id = 'seal-loader-css'; style.textContent = css;
  var el = document.createElement('div'); el.id = 'seal-loader'; el.setAttribute('role', 'status');
  el.innerHTML = svg + '<div class="sl-label">Loading…</div>';
  (document.head || document.documentElement).appendChild(style);
  document.documentElement.appendChild(el);

  var t0 = Date.now(), done = false;
  function hide() {
    if (done) return; done = true;
    var wait = Math.max(0, 500 - (Date.now() - t0));
    window.__slT = setTimeout(function () { el.classList.add('sl-out'); setTimeout(function () { el.style.display = 'none'; }, 400); }, wait);
  }
  function show() { done = false; clearTimeout(window.__slT); el.style.display = ''; void el.offsetWidth; el.classList.remove('sl-out'); }
  window.SealLoader = { show: show, hide: hide, svg: svg };
  if (document.readyState === 'complete') hide(); else window.addEventListener('load', hide);
  setTimeout(hide, 8000); // never trap the page
})();
