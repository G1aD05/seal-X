/* SealShapes — draws and exports Studio SVG designs.
 *
 * A design is plain data: { w, h, shapes: [ ... ] } where each shape is one of
 *   { t:'rect', x, y, w, h, rx }   { t:'ellipse', cx, cy, rx, ry }
 *   { t:'line', x1, y1, x2, y2 }   { t:'poly', pts:[[x,y],...], closed }
 * plus { fill, stroke, sw, op } (colours are #hex or 'none').
 * The server validates all of it, and this file only ever builds SVG text from numbers and
 * validated colours, so a design can't carry markup or script.
 */
(function (root) {
  'use strict';
  var COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

  function paint(v) { return v && v !== 'none' && COLOR.test(v) ? v : 'none'; }
  function n(v, d) { v = Number(v); return isFinite(v) ? v : (d || 0); }
  function r2(v) { return Math.round(n(v) * 100) / 100; }

  /** Draws design `a` into the box (x, y, w, h) of a 2D canvas context. */
  function draw(ctx, a, x, y, w, h) {
    if (!a || !a.shapes || !a.w || !a.h) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(w / a.w, h / a.h);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (var i = 0; i < a.shapes.length; i++) {
      var s = a.shapes[i], fill = paint(s.fill), stroke = paint(s.stroke), sw = n(s.sw);
      ctx.globalAlpha = s.op == null ? 1 : Math.max(0, Math.min(1, n(s.op, 1)));
      ctx.beginPath();
      if (s.t === 'rect') {
        var rx = Math.min(n(s.rx), n(s.w) / 2, n(s.h) / 2);
        if (rx > 0) {
          ctx.moveTo(s.x + rx, s.y);
          ctx.arcTo(s.x + s.w, s.y, s.x + s.w, s.y + s.h, rx);
          ctx.arcTo(s.x + s.w, s.y + s.h, s.x, s.y + s.h, rx);
          ctx.arcTo(s.x, s.y + s.h, s.x, s.y, rx);
          ctx.arcTo(s.x, s.y, s.x + s.w, s.y, rx);
          ctx.closePath();
        } else ctx.rect(s.x, s.y, s.w, s.h);
      } else if (s.t === 'ellipse') {
        ctx.ellipse(s.cx, s.cy, Math.max(0.01, s.rx), Math.max(0.01, s.ry), 0, 0, Math.PI * 2);
      } else if (s.t === 'line') {
        ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2);
        fill = 'none';
      } else if (s.t === 'poly' && s.pts && s.pts.length) {
        ctx.moveTo(s.pts[0][0], s.pts[0][1]);
        for (var k = 1; k < s.pts.length; k++) ctx.lineTo(s.pts[k][0], s.pts[k][1]);
        if (s.closed !== false) ctx.closePath(); else fill = 'none';
      } else continue;
      if (fill !== 'none') { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke !== 'none' && sw > 0) { ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.stroke(); }
    }
    ctx.restore();
  }

  /** Returns standalone SVG text for design `a` (safe: built only from numbers and validated colours). */
  function toSvg(a, size) {
    var W = r2(a.w), H = r2(a.h), body = '';
    (a.shapes || []).forEach(function (s) {
      var fill = paint(s.fill), stroke = paint(s.stroke), sw = r2(s.sw), op = s.op == null ? 1 : r2(s.op);
      var st = ' stroke="' + stroke + '"' + (stroke !== 'none' ? ' stroke-width="' + sw + '" stroke-linejoin="round" stroke-linecap="round"' : '') + (op < 1 ? ' opacity="' + op + '"' : '');
      if (s.t === 'rect') body += '<rect x="' + r2(s.x) + '" y="' + r2(s.y) + '" width="' + r2(s.w) + '" height="' + r2(s.h) + '"' + (n(s.rx) > 0 ? ' rx="' + r2(s.rx) + '"' : '') + ' fill="' + fill + '"' + st + '/>';
      else if (s.t === 'ellipse') body += '<ellipse cx="' + r2(s.cx) + '" cy="' + r2(s.cy) + '" rx="' + r2(s.rx) + '" ry="' + r2(s.ry) + '" fill="' + fill + '"' + st + '/>';
      else if (s.t === 'line') body += '<line x1="' + r2(s.x1) + '" y1="' + r2(s.y1) + '" x2="' + r2(s.x2) + '" y2="' + r2(s.y2) + '" fill="none"' + st + '/>';
      else if (s.t === 'poly' && s.pts) {
        var pts = s.pts.map(function (p) { return r2(p[0]) + ',' + r2(p[1]); }).join(' ');
        var closed = s.closed !== false;
        body += '<' + (closed ? 'polygon' : 'polyline') + ' points="' + pts + '" fill="' + (closed ? fill : 'none') + '"' + st + '/>';
      }
    });
    var dim = size ? ' width="' + r2(size) + '" height="' + r2(size * H / W) + '"' : ' width="' + W + '" height="' + H + '"';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"' + dim + '>' + body + '</svg>';
  }

  root.SealShapes = { draw: draw, toSvg: toSvg, paint: paint };
})(window);
