/* Seal motion helpers: animate the auth modal's height when switching Sign In / Register
   (instead of snapping), and fade/scale it out on close. Wraps the page's own functions. */
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var openedAt = 0;
  function wrap(name, make) { var orig = window[name]; if (typeof orig === 'function' && !orig.__sm) { var w = make(orig); w.__sm = true; window[name] = w; } }

  wrap('openAuth', function (orig) { return function () { openedAt = Date.now(); return orig.apply(this, arguments); }; });

  wrap('switchTab', function (orig) {
    return function () {
      var ov = document.getElementById('auth-overlay'), m = ov && ov.querySelector('.modal');
      if (reduce || !m || ov.classList.contains('hidden') || Date.now() - openedAt < 150) return orig.apply(this, arguments);
      var from = m.offsetHeight, r = orig.apply(this, arguments), to = m.offsetHeight;
      if (from && to && from !== to) {
        m.animate([{ height: from + 'px' }, { height: to + 'px' }],
                  { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
        var prev = m.style.overflow; m.style.overflow = 'hidden';
        setTimeout(function () { m.style.overflow = prev; }, 330);
      }
      return r;
    };
  });

  wrap('closeAuth', function (orig) {
    return function () {
      var ov = document.getElementById('auth-overlay'), self = this, args = arguments;
      if (reduce || !ov || ov.classList.contains('hidden') || ov.classList.contains('sm-closing')) return orig.apply(self, args);
      ov.classList.add('sm-closing');
      setTimeout(function () { ov.classList.remove('sm-closing'); orig.apply(self, args); }, 160);
    };
  });
})();
