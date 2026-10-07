#!/usr/bin/env node
/* Installs the new Worlds (server-authoritative multiplayer game + Seals dev products).
 *
 *   1. Copy worlds.js into the repo root and worlds.html into public/.
 *   2. From the repo root run:  node install-worlds.js
 *
 * It edits by searching for anchor text instead of line numbers, so it still works when your files
 * have changed. It is safe to run twice, and it removes the earlier "uploaded-game" Worlds
 * (sandboxed iframe version) if you had installed that. Anything it can't place is reported
 * as a WARNING with the exact snippet to add by hand. Use `git diff` afterwards to review. */
const fs = require('fs'), path = require('path');
const R = (...p) => path.join(process.cwd(), ...p);
const read = f => fs.readFileSync(R(f), 'utf8');
const write = (f, s) => fs.writeFileSync(R(f), s);
const log = m => console.log('  ' + m), warn = m => console.log('  WARNING: ' + m);

for (const f of ['server.js', 'worlds.js', 'public/worlds.html', 'public/studio.html', 'public/js/api.js', 'public/js/main.js'])
  if (!fs.existsSync(R(f))) { console.error(`Missing ${f}. Run from the repo root, after copying worlds.js, public/worlds.html and public/studio.html in.`); process.exit(1); }

/* ---------- 1. remove the earlier uploaded-game Worlds, if present ---------- */
let s = read('server.js'), removed = [];
const start = s.indexOf('// ── Worlds: multiplayer games + dev products');
if (start !== -1) {
  const ends = ['// Public, so the UI can tell people what the drains are.', "app.get('/api/shop', (req, res) => {"].map(m => s.indexOf(m, start)).filter(i => i > start);
  if (ends.length) { s = s.slice(0, start) + s.slice(Math.min(...ends)); removed.push('old Worlds routes'); }
  else warn('found the old Worlds routes but not their end; remove the block starting "// ── Worlds: multiplayer games + dev products" by hand.');
}
const seed = /  if \(!Array\.isArray\(db\.worldCreators\)\)[\s\S]*?\n    changed = true;\n  \}\n/;
if (seed.test(s)) { s = s.replace(seed, ''); removed.push('old Worlds defaults'); }
const cors = /\/\/ Worlds run in a sandboxed iframe[^\n]*\napp\.use\(\['\/worlds', '\/1'\][^\n]*\n/;
if (cors.test(s)) { s = s.replace(cors, ''); removed.push('old CORS rule'); }
for (const f of ['public/js/seal-world-sdk.js', 'public/worlds/arena/index.html']) if (fs.existsSync(R(f))) { fs.unlinkSync(R(f)); removed.push(f); }
for (const d of ['public/worlds/arena', 'public/worlds']) { try { fs.rmdirSync(R(d)); } catch {} }
const dockBlock = '    <a href="worlds.html" class="dock-item">\n      <span class="dock-icon"><i data-icon="users" data-size="17"></i></span>\n      <span class="dock-label">Worlds</span>\n    </a>\n';
for (const f of fs.readdirSync(R('public')).filter(x => x.endsWith('.html') && x !== 'worlds.html')) {
  const h = read('public/' + f);
  if (h.includes(dockBlock)) { write('public/' + f, h.replace(dockBlock, '')); removed.push('old dock link in ' + f); }
}
console.log(removed.length ? 'Removed the earlier Worlds: ' + removed.length + ' piece(s).' : 'No earlier Worlds found to remove.');

/* ---------- 2. server.js ---------- */
console.log('server.js');
if (!s.includes("require('./worlds')")) {
  const a = "const market = require('./market');";
  if (s.includes(a)) { s = s.replace(a, a + "\nconst mountWorlds = require('./worlds');"); log('added require'); }
  else warn("add this near the top of server.js:  const mountWorlds = require('./worlds');");
} else log('require already there');
if (!/db\.worlds = \[\]/.test(s)) {
  const a = ["  if (!Array.isArray(db.polls)) { db.polls = []; changed = true; }", "  if (!Array.isArray(db.auditLog)) { db.auditLog = []; changed = true; }"].find(x => s.includes(x));
  const add = "\n  if (!Array.isArray(db.worlds)) { db.worlds = []; changed = true; }\n  // Records from the earlier uploaded-game Worlds had a url/products shape; the new Worlds use a template.\n  if (db.worlds.some(w => w && !w.template)) { db.worlds = db.worlds.filter(w => w && w.template); changed = true; }";
  if (a) { s = s.replace(a, a + add); log('added db.worlds default'); }
  else warn('add inside readDB():' + add);
} else log('db.worlds default already there');
if (!s.includes('mountWorlds(app')) {
  const m = s.match(/^market\(app,[^\n]*\n/m);
  const call = `
// ── Worlds — a small multiplayer game. Tier 4+ create worlds, everyone can join, and dev products
// are bought with Seals (and burned, so they count as a Seal drain). See worlds.js. ─────
mountWorlds(app, {
  readDB, writeDB, requireLogin, requireTier4, isTier4, audit,
  avatarColor(record) {
    const item = shopItemById(record.profile && record.profile.avatar);
    return item && /^#[0-9a-f]{3,8}$/i.test(item.value) ? item.value : AVATAR_COLORS[0].value;
  },
  burn: typeof ledger === 'function' ? (db, kind, amount) => ledger(db, 'burned', kind, amount) : null
});
`;
  if (m) { s = s.replace(m[0], m[0] + call); log('mounted worlds'); }
  else warn('add after your market(app, ...) line:' + call);
} else log('already mounted');
for (const name of ['requireTier4', 'isTier4', 'audit', 'shopItemById', 'AVATAR_COLORS'])
  if (!new RegExp('(function ' + name + '\\b|const ' + name + '\\b|let ' + name + '\\b)').test(s)) warn(`server.js doesn't seem to define ${name}, which worlds.js needs.`);
write('server.js', s);

/* ---------- 3. api.js ---------- */
console.log('public/js/api.js');
let api = read('public/js/api.js');
if (!api.includes('getWorlds')) {
  api += `
// ── Worlds (multiplayer game) ── joining a world is an EventSource on /api/worlds/:id/stream (see worlds.html).
Object.assign(API, {
  getWorlds() { return this._req('/api/worlds'); },
  createWorld(name, template) { return this._req('/api/worlds', { method: 'POST', body: JSON.stringify({ name, template }) }); },
  deleteWorld(id) { return this._req(\`/api/worlds/\${encodeURIComponent(id)}\`, { method: 'DELETE' }); },
  moveInWorld(id, x, y) { return this._req(\`/api/worlds/\${encodeURIComponent(id)}/move\`, { method: 'POST', body: JSON.stringify({ x, y }) }); },
  buyWorldProduct(productId) { return this._req(\`/api/worlds/products/\${encodeURIComponent(productId)}/buy\`, { method: 'POST' }); }
});
`;
  write('public/js/api.js', api); log('added API methods');
} else log('already there');

/* ---------- 4. main.js (dock + cloak nav) ---------- */
console.log('public/js/main.js');
let main = read('public/js/main.js'), mainChanged = false;
if (!main.includes('worldsLink')) {
  const a = 'dock.appendChild(shopLink);';
  if (main.includes(a)) {
    main = main.replace(a, `const worldsLink = document.createElement('a');
  worldsLink.href = 'worlds.html';
  worldsLink.className = 'dock-item' + (location.pathname.endsWith('worlds.html') ? ' active' : '');
  worldsLink.innerHTML = \`<span class="dock-icon">\${sealIcon('rocket', { size: 17 })}</span><span class="dock-label">Worlds</span>\`;
  dock.appendChild(worldsLink);
  ` + a);
    mainChanged = true; log('added Worlds dock link');
  } else warn("couldn't find 'dock.appendChild(shopLink);' in ensureProfileNavLink — add a Worlds dock link by hand.");
} else log('dock link already there');
if (!/href: 'worlds\.html'/.test(main)) {
  const m = main.match(/^( *)\{ href: 'shop\.html',[^\n]*\n/m);
  if (m) { main = main.replace(m[0], `${m[1]}{ href: 'worlds.html',      match: ['worlds.html'],    icon: 'rocket',       label: 'Worlds'  },\n` + m[0]); mainChanged = true; log('added to cloak nav'); }
  else warn("couldn't find the shop entry in CLOAK_NAV — add { href: 'worlds.html', match: ['worlds.html'], icon: 'rocket', label: 'Worlds' } by hand.");
}
if (mainChanged) write('public/js/main.js', main);

/* ---------- 5. home page card ---------- */
console.log('public/index.html');
let idx = read('public/index.html');
if (!idx.includes('href="worlds.html"')) {
  const a = '<a class="feature-card" href="shop.html">';
  if (idx.includes(a)) {
    idx = idx.replace(a, `<a class="feature-card" href="worlds.html">
        <span class="feature-icon"><i data-icon="rocket" data-size="22"></i></span>
        <h3>Worlds</h3>
        <p>Join other players in live worlds and spend your Seals on boosts and effects.</p>
        <span class="feature-link">Enter a world <i data-icon="arrow-right" data-size="16"></i></span>
      </a>
      ` + a);
    write('public/index.html', idx); log('added home card');
  } else warn('home page card not added (anchor not found) — optional.');
} else log('already there');
console.log('\nDone. Restart the server. Tier 4+ can now create worlds on the Worlds page.');
