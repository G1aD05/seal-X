/* SvgDesigner — a small vector drawing tool inside the World Studio.
 *
 *   SvgDesigner.open(asset | null, function (result) { ... })
 *     result = { asset, assets, isNew }   after Save
 *            | { deleted: id, assets }    after Delete
 *   SvgDesigner.isOpen()
 *
 * Designs are saved through /api/studio/assets (Tier 4+). Needs world-shapes.js.
 */
(function (root) {
  'use strict';

  var CSS = '' +
    '.sd-ov{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:50;display:flex;align-items:center;justify-content:center;font:13px Inter,system-ui,sans-serif;color:#e6e8ee}' +
    '.sd-ov.hidden{display:none}' +
    '.sd-win{width:min(1100px,96vw);height:min(720px,94vh);background:#17191d;border:1px solid #353944;border-radius:12px;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden}' +
    '.sd-top,.sd-bot{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#1b1d22}' +
    '.sd-top{border-bottom:1px solid #2a2d35}.sd-bot{border-top:1px solid #2a2d35}' +
    '.sd-sp{flex:1}' +
    '.sd-body{display:grid;grid-template-columns:54px 1fr 250px;min-height:0}' +
    '.sd-tools{background:#17191d;border-right:1px solid #2a2d35;padding:8px;display:flex;flex-direction:column;gap:6px}' +
    '.sd-tool{width:38px;height:38px;border-radius:8px;border:1px solid #353944;background:#22252c;color:#e6e8ee;cursor:pointer;font-size:16px}' +
    '.sd-tool.on{background:#2f6fed;border-color:#2f6fed}' +
    '.sd-stage{position:relative;min-width:0;background:#0c0d0f}' +
    '.sd-stage canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}' +
    '.sd-side{background:#17191d;border-left:1px solid #2a2d35;overflow-y:auto;padding:10px}' +
    '.sd-side h4{margin:12px 0 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8b92a5}.sd-side h4:first-child{margin-top:0}' +
    '.sd-row{display:grid;grid-template-columns:62px 1fr auto;gap:6px;align-items:center;margin-bottom:6px}' +
    '.sd-row label{color:#9aa1b2}' +
    '.sd-in{background:#101216;border:1px solid #353944;border-radius:6px;padding:4px 8px;color:inherit;font:inherit;min-width:0}' +
    '.sd-in[type=color]{padding:0;height:26px;width:100%;background:none}' +
    '.sd-b{background:#272a32;border:1px solid #353944;border-radius:6px;padding:5px 10px;color:inherit;font:inherit;cursor:pointer}.sd-b:hover:not(:disabled){background:#31353f}.sd-b:disabled{opacity:.4;cursor:default}' +
    '.sd-b.pri{background:#2f6fed;border-color:#2f6fed}.sd-b.warn{border-color:#8a3a3a}' +
    '.sd-lay{display:flex;justify-content:space-between;padding:4px 6px;border-radius:6px;cursor:pointer}.sd-lay:hover{background:#22252c}.sd-lay.on{background:#25407a}' +
    '.sd-hint{color:#7d8496;font-size:12px;line-height:1.4}.sd-err{color:#ffb4b4}' +
    '.sd-btns{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}';

  var TOOLS = [
    ['select', '⬚', 'Select / move / resize (V)'],
    ['rect', '▭', 'Rectangle (R)'],
    ['ellipse', '◯', 'Ellipse (E)'],
    ['line', '╱', 'Line (L)'],
    ['poly', '⬠', 'Polygon — click points, double-click or Enter to finish (P)'],
    ['pen', '✎', 'Freehand pen (B)']
  ];
  var LABEL = { rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', poly: 'Polygon' };
  var HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  var CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

  var D = null;            // state while open
  var ov = null, cv = null, ctx = null;   // DOM
  var $ = function (sel) { return ov.querySelector(sel); };

  /* ------------------------------------------------------------ geometry */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function r2(v) { return Math.round(v * 100) / 100; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function bbox(s) {
    if (s.t === 'rect') return [s.x, s.y, s.x + s.w, s.y + s.h];
    if (s.t === 'ellipse') return [s.cx - s.rx, s.cy - s.ry, s.cx + s.rx, s.cy + s.ry];
    var xs, ys;
    if (s.t === 'line') { xs = [s.x1, s.x2]; ys = [s.y1, s.y2]; }
    else { xs = s.pts.map(function (p) { return p[0]; }); ys = s.pts.map(function (p) { return p[1]; }); }
    return [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
  }
  // Returns a copy of `s` stretched from box `old` into box `nb`.
  function withBox(s, old, nb) {
    var ow = old[2] - old[0], oh = old[3] - old[1], nw = nb[2] - nb[0], nh = nb[3] - nb[1], c = clone(s);
    function mx(x) { return ow ? nb[0] + (x - old[0]) / ow * nw : nb[0] + nw / 2; }
    function my(y) { return oh ? nb[1] + (y - old[1]) / oh * nh : nb[1] + nh / 2; }
    if (c.t === 'rect') { c.x = r2(nb[0]); c.y = r2(nb[1]); c.w = r2(nw); c.h = r2(nh); }
    else if (c.t === 'ellipse') { c.cx = r2((nb[0] + nb[2]) / 2); c.cy = r2((nb[1] + nb[3]) / 2); c.rx = r2(nw / 2); c.ry = r2(nh / 2); }
    else if (c.t === 'line') { c.x1 = r2(mx(c.x1)); c.y1 = r2(my(c.y1)); c.x2 = r2(mx(c.x2)); c.y2 = r2(my(c.y2)); }
    else c.pts = c.pts.map(function (p) { return [r2(mx(p[0])), r2(my(p[1]))]; });
    return c;
  }
  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function hitShape(s, p) {
    var tol = Math.max((s.sw || 0) / 2, 5 / D.sc);
    if (s.t === 'line') return segDist(p.x, p.y, s.x1, s.y1, s.x2, s.y2) <= tol;
    if (s.t === 'poly' && s.closed === false) { for (var i = 1; i < s.pts.length; i++) if (segDist(p.x, p.y, s.pts[i - 1][0], s.pts[i - 1][1], s.pts[i][0], s.pts[i][1]) <= tol) return true; return false; }
    if (s.t === 'ellipse') { var a = s.rx + tol, b = s.ry + tol; return Math.pow((p.x - s.cx) / a, 2) + Math.pow((p.y - s.cy) / b, 2) <= 1; }
    var bb = bbox(s); return p.x >= bb[0] - tol && p.x <= bb[2] + tol && p.y >= bb[1] - tol && p.y <= bb[3] + tol;
  }
  function simplify(pts, minDist) {
    var out = [pts[0]];
    for (var i = 1; i < pts.length; i++) { var l = out[out.length - 1]; if (Math.hypot(pts[i][0] - l[0], pts[i][1] - l[1]) >= minDist) out.push(pts[i]); }
    return out;
  }

  /* ------------------------------------------------------------ state helpers */
  function snapshot() { return JSON.stringify({ w: D.w, h: D.h, shapes: D.shapes }); }
  function restore(js) { var d = JSON.parse(js); D.w = d.w; D.h = d.h; D.shapes = d.shapes; if (D.sel != null && !D.shapes[D.sel]) D.sel = null; }
  function commit(before) { D.undo.push(before); if (D.undo.length > 100) D.undo.shift(); D.redo = []; D.dirty = true; refresh(); }
  function refresh() { panel(); layers(); draw(); $('.sd-undo').disabled = !D.undo.length; $('.sd-redo').disabled = !D.redo.length; }
  function say(msg, err) { var s = $('.sd-status'); s.textContent = msg || ''; s.className = 'sd-status sd-hint' + (err ? ' sd-err' : ''); }
  function snapv(v) { return D.snap ? Math.round(v / 5) * 5 : r2(v); }

  function newShape(t, a, b) {
    var st = D.style, line = t === 'line';
    var base = { fill: line ? 'none' : st.fill, stroke: line && st.stroke === 'none' ? (st.fill !== 'none' ? st.fill : '#222222') : st.stroke, sw: line ? Math.max(st.sw, 2) : st.sw, op: st.op };
    if (t === 'rect') return Object.assign({ t: 'rect', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y), rx: 0 }, base);
    if (t === 'ellipse') return Object.assign({ t: 'ellipse', cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, rx: Math.abs(b.x - a.x) / 2, ry: Math.abs(b.y - a.y) / 2 }, base);
    return Object.assign({ t: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y }, base);
  }

  /* ------------------------------------------------------------ view */
  function fitView() {
    var r = cv.getBoundingClientRect(); if (!r.width) return;
    var d = root.devicePixelRatio || 1; cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
    D.sc = Math.max(0.5, Math.min((r.width - 70) / D.w, (r.height - 70) / D.h));
    D.ox = (r.width - D.w * D.sc) / 2; D.oy = (r.height - D.h * D.sc) / 2;
  }
  function toDesign(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - D.ox) / D.sc, y: (e.clientY - r.top - D.oy) / D.sc }; }

  function draw() {
    if (!D) return;
    var d = root.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0c0d0f'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    // checkerboard artboard
    ctx.save(); ctx.translate(D.ox, D.oy);
    var cell = 10 * D.sc;
    for (var yy = 0; yy * cell < D.h * D.sc; yy++) for (var xx = 0; xx * cell < D.w * D.sc; xx++) {
      ctx.fillStyle = (xx + yy) % 2 ? '#2a2d34' : '#23262c';
      ctx.fillRect(xx * cell, yy * cell, Math.min(cell, D.w * D.sc - xx * cell), Math.min(cell, D.h * D.sc - yy * cell));
    }
    ctx.restore();
    // the design (plus the in-progress shape)
    var shapes = D.shapes.slice();
    if (D.draft) shapes.push(D.draft.shape);
    root.SealShapes.draw(ctx, { w: D.w, h: D.h, shapes: shapes }, D.ox, D.oy, D.w * D.sc, D.h * D.sc);
    // polygon rubber band
    if (D.poly && D.poly.length) {
      ctx.strokeStyle = '#7db1ff'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.beginPath();
      D.poly.forEach(function (p, i) { var x = D.ox + p[0] * D.sc, y = D.oy + p[1] * D.sc; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      if (D.cursor) ctx.lineTo(D.ox + D.cursor.x * D.sc, D.oy + D.cursor.y * D.sc);
      ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#fff'; D.poly.forEach(function (p) { ctx.fillRect(D.ox + p[0] * D.sc - 3, D.oy + p[1] * D.sc - 3, 6, 6); });
    }
    // artboard border
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1; ctx.strokeRect(D.ox, D.oy, D.w * D.sc, D.h * D.sc);
    // selection
    var s = D.sel != null ? D.shapes[D.sel] : null;
    if (s && D.tool === 'select') {
      var b = bbox(s), x1 = D.ox + b[0] * D.sc, y1 = D.oy + b[1] * D.sc, x2 = D.ox + b[2] * D.sc, y2 = D.oy + b[3] * D.sc;
      ctx.strokeStyle = '#7db1ff'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.strokeRect(x1, y1, x2 - x1, y2 - y1); ctx.setLineDash([]);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2f6fed';
      HANDLES.forEach(function (h) { var p = hpos(b, h); ctx.fillRect(p[0] - 4, p[1] - 4, 8, 8); ctx.strokeRect(p[0] - 4, p[1] - 4, 8, 8); });
    }
  }
  function hpos(b, h) { // handle position in canvas CSS pixels
    var x = h.indexOf('w') >= 0 ? b[0] : h.indexOf('e') >= 0 ? b[2] : (b[0] + b[2]) / 2;
    var y = h.indexOf('n') >= 0 ? b[1] : h.indexOf('s') >= 0 ? b[3] : (b[1] + b[3]) / 2;
    return [D.ox + x * D.sc, D.oy + y * D.sc];
  }
  function handleAt(e) {
    var s = D.sel != null ? D.shapes[D.sel] : null; if (!s || D.tool !== 'select') return null;
    var r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, b = bbox(s);
    for (var i = 0; i < HANDLES.length; i++) { var p = hpos(b, HANDLES[i]); if (Math.abs(p[0] - mx) <= 8 && Math.abs(p[1] - my) <= 8) return HANDLES[i]; }
    return null;
  }

  /* ------------------------------------------------------------ pointer */
  function finishPoly() {
    if (!D.poly) return;
    var pts = D.poly.slice();
    D.poly = null; D.cursor = null;
    if (pts.length >= 3) addShape({ t: 'poly', pts: pts, closed: true, fill: D.style.fill, stroke: D.style.stroke, sw: D.style.sw, op: D.style.op });
    else { draw(); say('A polygon needs at least 3 points.', true); }
  }
  function addShape(shape) {
    if (D.shapes.length >= 100) { say('A design can have at most 100 shapes.', true); return draw(); }
    var before = snapshot(); D.shapes.push(shape); D.sel = D.shapes.length - 1; setTool('select', true); commit(before);
  }
  function onDown(e) {
    cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
    var p = toDesign(e); p = { x: snapv(p.x), y: snapv(p.y) };
    if (D.tool === 'select') {
      var h = handleAt(e), before = snapshot();
      if (h) { var s = D.shapes[D.sel]; D.drag = { t: 'resize', h: h, orig: clone(s), box: bbox(s), before: before, moved: false }; return; }
      var raw = toDesign(e), hit = null;
      for (var i = D.shapes.length - 1; i >= 0; i--) if (hitShape(D.shapes[i], raw)) { hit = i; break; }
      D.sel = hit; refresh();
      if (hit != null) D.drag = { t: 'move', p0: raw, orig: clone(D.shapes[hit]), box: bbox(D.shapes[hit]), before: before, moved: false };
    } else if (D.tool === 'poly') {
      if (!D.poly) D.poly = [[p.x, p.y]];
      else {
        var f = D.poly[0];
        if (D.poly.length >= 3 && Math.hypot(f[0] - p.x, f[1] - p.y) < 8 / D.sc) return finishPoly();
        D.poly.push([p.x, p.y]);
      }
      draw();
    } else if (D.tool === 'pen') {
      D.draft = { kind: 'pen', pts: [[p.x, p.y]], shape: { t: 'poly', pts: [[p.x, p.y]], closed: false, fill: 'none', stroke: D.style.stroke === 'none' ? D.style.fill : D.style.stroke, sw: Math.max(D.style.sw, 2), op: D.style.op } };
    } else {
      D.draft = { kind: D.tool, a: p, shape: newShape(D.tool, p, p) };
    }
  }
  function onMove(e) {
    var raw = toDesign(e);
    if (D.tool === 'poly' && D.poly) { D.cursor = { x: snapv(raw.x), y: snapv(raw.y) }; draw(); return; }
    if (D.draft) {
      var p = { x: snapv(raw.x), y: snapv(raw.y) };
      if (D.draft.kind === 'pen') { D.draft.pts.push([r2(raw.x), r2(raw.y)]); D.draft.shape.pts = D.draft.pts.slice(); }
      else D.draft.shape = newShape(D.draft.kind, D.draft.a, p);
      return draw();
    }
    if (!D.drag) { var h = handleAt(e); cv.style.cursor = h ? CURSORS[h] : (D.tool === 'select' ? 'default' : 'crosshair'); return; }
    var dg = D.drag, s = D.shapes[D.sel];
    if (!dg.moved && Math.hypot(raw.x - (dg.p0 ? dg.p0.x : raw.x), raw.y - (dg.p0 ? dg.p0.y : raw.y)) * D.sc < 2 && dg.t === 'move') return;
    dg.moved = true;
    if (dg.t === 'move') {
      var dx = snapv(dg.box[0] + raw.x - dg.p0.x) - dg.box[0], dy = snapv(dg.box[1] + raw.y - dg.p0.y) - dg.box[1];
      D.shapes[D.sel] = withBox(dg.orig, dg.box, [dg.box[0] + dx, dg.box[1] + dy, dg.box[2] + dx, dg.box[3] + dy]);
    } else {
      var b = dg.box.slice(), p2 = { x: snapv(raw.x), y: snapv(raw.y) };
      if (dg.h.indexOf('w') >= 0) b[0] = Math.min(p2.x, b[2] - 1);
      if (dg.h.indexOf('e') >= 0) b[2] = Math.max(p2.x, b[0] + 1);
      if (dg.h.indexOf('n') >= 0) b[1] = Math.min(p2.y, b[3] - 1);
      if (dg.h.indexOf('s') >= 0) b[3] = Math.max(p2.y, b[1] + 1);
      D.shapes[D.sel] = withBox(dg.orig, dg.box, b);
    }
    panel(); draw();
  }
  function onUp() {
    if (D.draft) {
      var d = D.draft; D.draft = null;
      if (d.kind === 'pen') { var pts = simplify(d.pts.map(function (q) { return [r2(q[0]), r2(q[1])]; }), 1.5 / D.sc * 2); if (pts.length >= 2) addShape(Object.assign(d.shape, { pts: pts })); else draw(); }
      else {
        var sh = d.shape, big = sh.t === 'rect' ? sh.w > 1 && sh.h > 1 : sh.t === 'ellipse' ? sh.rx > 0.5 && sh.ry > 0.5 : Math.hypot(sh.x2 - sh.x1, sh.y2 - sh.y1) > 1;
        if (big) addShape(sh); else draw();
      }
      return;
    }
    if (D.drag) { var dg = D.drag; D.drag = null; if (dg.moved) commit(dg.before); }
  }

  /* ------------------------------------------------------------ panels */
  function layers() {
    var box = $('.sd-layers'), n = {}, html = '';
    var names = D.shapes.map(function (s) { n[s.t] = (n[s.t] || 0) + 1; return LABEL[s.t] + ' ' + n[s.t]; });
    for (var i = D.shapes.length - 1; i >= 0; i--) html += '<div class="sd-lay' + (D.sel === i ? ' on' : '') + '" data-i="' + i + '"><span>' + names[i] + '</span></div>';
    box.innerHTML = html || '<p class="sd-hint">Nothing yet — pick a tool and draw.</p>';
    box.querySelectorAll('.sd-lay').forEach(function (el) { el.onclick = function () { D.sel = Number(el.dataset.i); setTool('select', true); refresh(); }; });
  }
  function colorRow(label, key, shape) {
    var v = shape ? shape[key] : D.style[key], none = v === 'none';
    return '<div class="sd-row"><label>' + label + '</label><input class="sd-in" type="color" data-c="' + key + '" value="' + (none ? '#888888' : v.slice(0, 7).length === 7 ? v.slice(0, 7) : '#888888') + '"' + (none ? ' disabled' : '') + '><label><input type="checkbox" data-n="' + key + '"' + (none ? ' checked' : '') + '> none</label></div>';
  }
  function panel() {
    var s = D.sel != null ? D.shapes[D.sel] : null, st = s || D.style, box = $('.sd-props');
    var html = '<h4>' + (s ? LABEL[s.t] : 'Style for new shapes') + '</h4>';
    if (!(s && s.t === 'line')) html += colorRow('Fill', 'fill', s);
    html += colorRow('Stroke', 'stroke', s);
    html += '<div class="sd-row"><label>Width</label><input type="range" min="0" max="20" step="0.5" data-r="sw" value="' + (st.sw || 0) + '"><span>' + (st.sw || 0) + '</span></div>';
    html += '<div class="sd-row"><label>Opacity</label><input type="range" min="0.1" max="1" step="0.05" data-r="op" value="' + (st.op == null ? 1 : st.op) + '"><span>' + (st.op == null ? 1 : st.op) + '</span></div>';
    if (s && s.t === 'rect') html += '<div class="sd-row"><label>Corners</label><input type="range" min="0" max="50" step="1" data-r="rx" value="' + (s.rx || 0) + '"><span>' + (s.rx || 0) + '</span></div>';
    if (s) html += '<div class="sd-btns"><button class="sd-b" data-a="front">To front</button><button class="sd-b" data-a="back">To back</button><button class="sd-b" data-a="dup">Duplicate</button><button class="sd-b warn" data-a="del">Delete</button></div>';
    else html += '<p class="sd-hint">Draw with the tools on the left. Select a shape to restyle, move or resize it.</p>';
    box.innerHTML = html;
    box.querySelectorAll('[data-c]').forEach(function (i) { i.onchange = function () { setProp(i.dataset.c, i.value); }; });
    box.querySelectorAll('[data-n]').forEach(function (i) { i.onchange = function () { var k = i.dataset.n; setProp(k, i.checked ? 'none' : (D.lastColor[k] || '#4aa3ff')); }; });
    box.querySelectorAll('[data-r]').forEach(function (i) {
      i.oninput = function () { i.nextElementSibling.textContent = i.value; };
      i.onchange = function () { setProp(i.dataset.r, Number(i.value)); };
    });
    box.querySelectorAll('[data-a]').forEach(function (b) { b.onclick = function () { action(b.dataset.a); }; });
  }
  function setProp(k, v) {
    if (typeof v === 'string' && v !== 'none') D.lastColor[k] = v;
    if (k in D.style) D.style[k] = v;
    if (D.sel != null) { var before = snapshot(); D.shapes[D.sel][k] = v; commit(before); } else refresh();
  }
  function action(a) {
    if (D.sel == null) return; var before = snapshot(), s = D.shapes[D.sel];
    if (a === 'del') { D.shapes.splice(D.sel, 1); D.sel = null; }
    else if (a === 'dup') { if (D.shapes.length >= 100) return say('A design can have at most 100 shapes.', true); var c = withBox(s, bbox(s), bbox(s).map(function (v) { return v + 5; })); D.shapes.push(c); D.sel = D.shapes.length - 1; }
    else if (a === 'front') { D.shapes.push(D.shapes.splice(D.sel, 1)[0]); D.sel = D.shapes.length - 1; }
    else if (a === 'back') { D.shapes.unshift(D.shapes.splice(D.sel, 1)[0]); D.sel = 0; }
    commit(before);
  }
  function setTool(t, quiet) {
    if (D.poly && t !== 'poly') { D.poly = null; D.cursor = null; }
    D.tool = t; D.draft = null;
    ov.querySelectorAll('.sd-tool').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
    cv.style.cursor = t === 'select' ? 'default' : 'crosshair';
    if (!quiet) draw();
  }
  function undo() { if (!D.undo.length) return; D.redo.push(snapshot()); restore(D.undo.pop()); D.dirty = true; fitView(); refresh(); syncSize(); }
  function redo() { if (!D.redo.length) return; D.undo.push(snapshot()); restore(D.redo.pop()); D.dirty = true; fitView(); refresh(); syncSize(); }
  function syncSize() { $('.sd-w').value = D.w; $('.sd-h').value = D.h; }

  /* ------------------------------------------------------------ server */
  function api(path, opts) {
    return fetch(path, Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, opts || {}))
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong.'); return d; }); });
  }
  function design() { return { name: $('.sd-name').value, w: D.w, h: D.h, shapes: D.shapes }; }
  function save() {
    if (!D.shapes.length) return say('Draw at least one shape first.', true);
    $('.sd-save').disabled = true; say('Saving…');
    var isNew = !D.id;
    api(isNew ? '/api/studio/assets' : '/api/studio/assets/' + encodeURIComponent(D.id), { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(design()) })
      .then(function (d) { var cb = D.onDone; close(true); if (cb) cb({ asset: d.asset, assets: d.assets, isNew: isNew }); })
      .catch(function (e) { say(e.message, true); $('.sd-save').disabled = false; });
  }
  function del() {
    if (!D.id || !root.confirm('Delete this design permanently?')) return;
    api('/api/studio/assets/' + encodeURIComponent(D.id), { method: 'DELETE' })
      .then(function (d) { var cb = D.onDone, id = D.id; close(true); if (cb) cb({ deleted: id, assets: d.assets }); })
      .catch(function (e) { say(e.message, true); });
  }
  function copySvg() {
    var svg = root.SealShapes.toSvg(design());
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(svg).then(function () { say('SVG code copied.'); }, function () { root.prompt('Copy the SVG code:', svg); });
    else root.prompt('Copy the SVG code:', svg);
  }
  function download() {
    var blob = new Blob([root.SealShapes.toSvg(design())], { type: 'image/svg+xml' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = ($('.sd-name').value || 'design').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.svg';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ------------------------------------------------------------ lifecycle */
  function build() {
    if (!document.getElementById('sd-css')) { var st = document.createElement('style'); st.id = 'sd-css'; st.textContent = CSS; document.head.appendChild(st); }
    ov = document.createElement('div'); ov.className = 'sd-ov hidden'; ov.tabIndex = -1;
    ov.innerHTML = '' +
      '<div class="sd-win">' +
        '<div class="sd-top"><strong>SVG Designer</strong>' +
          '<input class="sd-in sd-name" maxlength="30" placeholder="Design name" style="width:190px">' +
          '<label>W <input class="sd-in sd-w" type="number" min="10" max="400" style="width:62px"></label>' +
          '<label>H <input class="sd-in sd-h" type="number" min="10" max="400" style="width:62px"></label>' +
          '<label title="Snap to a 5-unit grid"><input type="checkbox" class="sd-snap" checked> Snap</label>' +
          '<button class="sd-b sd-undo" title="Undo (Ctrl+Z)">↶</button><button class="sd-b sd-redo" title="Redo (Ctrl+Shift+Z)">↷</button>' +
          '<span class="sd-sp"></span><span class="sd-status sd-hint"></span></div>' +
        '<div class="sd-body"><div class="sd-tools"></div><div class="sd-stage"><canvas></canvas></div>' +
          '<div class="sd-side"><div class="sd-props"></div><h4>Layers</h4><div class="sd-layers"></div></div></div>' +
        '<div class="sd-bot"><button class="sd-b sd-copy">Copy SVG</button><button class="sd-b sd-dl">Download .svg</button><button class="sd-b warn sd-del">Delete design</button>' +
          '<span class="sd-sp"></span><button class="sd-b sd-cancel">Cancel</button><button class="sd-b pri sd-save">Save design</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    cv = ov.querySelector('canvas'); ctx = cv.getContext('2d');
    var tools = ov.querySelector('.sd-tools');
    TOOLS.forEach(function (t) { var b = document.createElement('button'); b.className = 'sd-tool'; b.dataset.t = t[0]; b.title = t[2]; b.textContent = t[1]; b.onclick = function () { setTool(t[0]); }; tools.appendChild(b); });
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('dblclick', function () {
      if (D.tool !== 'poly' || !D.poly) return;
      // A real double-click registers the last point twice; drop the duplicate (but never a genuine point).
      var n = D.poly.length;
      if (n > 1 && D.poly[n - 1][0] === D.poly[n - 2][0] && D.poly[n - 1][1] === D.poly[n - 2][1]) D.poly.pop();
      finishPoly();
    });
    ov.querySelector('.sd-undo').onclick = undo; ov.querySelector('.sd-redo').onclick = redo;
    ov.querySelector('.sd-snap').onchange = function (e) { D.snap = e.target.checked; };
    ov.querySelector('.sd-copy').onclick = copySvg; ov.querySelector('.sd-dl').onclick = download;
    ov.querySelector('.sd-del').onclick = del; ov.querySelector('.sd-save').onclick = save;
    ov.querySelector('.sd-cancel').onclick = function () { close(false); };
    ['.sd-w', '.sd-h'].forEach(function (sel) {
      ov.querySelector(sel).onchange = function () {
        var before = snapshot(); D.w = clamp(Math.round(Number(ov.querySelector('.sd-w').value)) || D.w, 10, 400); D.h = clamp(Math.round(Number(ov.querySelector('.sd-h').value)) || D.h, 10, 400);
        syncSize(); fitView(); commit(before);
      };
    });
    // Keep every key inside the designer so the Studio's shortcuts don't fire behind it.
    ov.addEventListener('keydown', function (e) {
      e.stopPropagation();
      var typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== 'checkbox' && e.target.type !== 'range';
      var k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
      if (mod && k === 's') { e.preventDefault(); return save(); }
      if (typing) return;
      if (mod && k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
      if (mod && k === 'y') { e.preventDefault(); return redo(); }
      if (k === 'enter' && D.poly) { e.preventDefault(); return finishPoly(); }
      if (k === 'escape') { if (D.poly) { D.poly = null; D.cursor = null; return draw(); } if (D.draft) { D.draft = null; return draw(); } D.sel = null; return refresh(); }
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); return action('del'); }
      var map = { v: 'select', r: 'rect', e: 'ellipse', l: 'line', p: 'poly', b: 'pen' };
      if (map[k] && !mod) return setTool(map[k]);
      var step = e.shiftKey ? 1 : 5, dx = k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0, dy = k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0;
      if ((dx || dy) && D.sel != null) { e.preventDefault(); var before = snapshot(), s = D.shapes[D.sel], b = bbox(s); D.shapes[D.sel] = withBox(s, b, [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy]); commit(before); }
    });
    root.addEventListener('resize', function () { if (D) { fitView(); draw(); } });
  }

  function open(asset, onDone) {
    if (!ov) build();
    D = { id: asset ? asset.id : null, w: asset ? asset.w : 100, h: asset ? asset.h : 100, shapes: asset ? clone(asset.shapes) : [],
      sel: null, tool: 'select', undo: [], redo: [], draft: null, poly: null, cursor: null, drag: null, snap: true, dirty: false, onDone: onDone,
      style: { fill: '#4aa3ff', stroke: '#10264d', sw: 2, op: 1 }, lastColor: { fill: '#4aa3ff', stroke: '#10264d' }, sc: 1, ox: 0, oy: 0 };
    ov.classList.remove('hidden');
    ov.querySelector('.sd-name').value = asset ? asset.name : '';
    ov.querySelector('.sd-snap').checked = true;
    ov.querySelector('.sd-del').style.display = asset ? '' : 'none';
    ov.querySelector('.sd-save').disabled = false;
    syncSize(); say(''); setTool('select', true); fitView(); refresh();
    if (!asset) { setTool('rect'); ov.querySelector('.sd-name').focus(); } else ov.focus();
  }
  function close(force) {
    if (!D) return;
    if (!force && D.dirty && !root.confirm('Discard your changes to this design?')) return;
    ov.classList.add('hidden'); D = null;
  }

  root.SvgDesigner = { open: open, isOpen: function () { return !!D; } };
})(window);
