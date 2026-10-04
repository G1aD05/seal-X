// ── GAME/TOOL GRID PAGE ─────────────────────────────────────────
// COLLECTION is set inline in 1.html ("games") / tools.html ("tools")
let ITEMS = [];
let TRENDING = []; // [{ id, rank, players, minutes }] — Games page only

function renderItems(list) {
  const grid = $('game-grid');
  grid.innerHTML = '';
  const admin = CURRENT_USER && CURRENT_USER.isAdmin;

  list.forEach(item => {
    const card = document.createElement('a');
    card.href = COLLECTION === 'games'
      ? `play.html?c=${encodeURIComponent(COLLECTION)}&g=${encodeURIComponent(item.id)}`
      : item.url;
    card.className = 'game-card';
    card.innerHTML = `
      ${admin ? `<button class="card-remove" data-id="${item.id}" title="Remove">${sealIcon('x', { size: 14 })}</button>` : ''}
      <div class="game-thumb">
        ${item.thumb
          ? `<img src="${item.thumb}" alt="${item.name}" onerror="this.parentElement.innerHTML='<span class=game-icon>'+sealIcon('gamepad-2',{size:34,stroke:1.5})+'</span>'">`
          : `<span class="game-icon">${item.icon || sealIcon('gamepad-2', { size: 34, stroke: 1.5 })}</span>`}
      </div>
      <div class="game-info">
        <div class="game-top">
          <span class="game-name">${item.name}</span>
          <span class="game-tag">${item.tag}</span>
          ${item.new ? '<span class="game-new">New</span>' : ''}
          ${trendBadge(item.id)}
        </div>
        <p class="game-desc">${item.desc}</p>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('.card-remove').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.preventDefault(); e.stopPropagation();
      if (!confirm('Remove this from the library?')) return;
      await API.remove(COLLECTION, btn.dataset.id);
      await loadItems();
    });
  });

  $('no-results').classList.toggle('hidden', list.length > 0);
}


// ── TRENDING (Games page) ────────────────────────────────────────
// The server tallies playtime pings per game per day; /api/trending returns
// the top games for the last week, newer days weighted more. Nothing shows
// until someone has actually played something.
function trendBadge(id) {
  const t = TRENDING.find(x => x.id === id);
  return t && t.rank <= 3
    ? `<span class="game-trending" title="#${t.rank} trending this week">${sealIcon('flame', { size: 11 })} Trending</span>`
    : '';
}

function trendMeta(t) {
  const players = t.players === 1 ? '1 player' : `${t.players} players`;
  const mins = t.minutes;
  const played = mins >= 60 ? `${Math.round(mins / 6) / 10}h played` : `${mins}m played`;
  return `${players} \u00b7 ${played}`;
}

function renderTrending() {
  const box = $('trending');
  if (!box) return;
  const q = $('search-input') ? $('search-input').value.trim() : '';
  const cards = TRENDING
    .map(t => ({ t, item: ITEMS.find(g => g.id === t.id) }))
    .filter(x => x.item);
  // Hide while searching so results aren't pushed down the page.
  box.classList.toggle('hidden', !cards.length || !!q);
  const row = $('trending-row');
  row.innerHTML = '';
  cards.forEach(({ t, item }) => {
    const a = document.createElement('a');
    a.className = 'trend-card';
    a.href = `play.html?c=games&g=${encodeURIComponent(item.id)}`;
    const thumb = item.thumb
      ? `<img src="${escapeHtml(item.thumb)}" alt="" onerror="this.remove()">`
      : sealIcon('gamepad-2', { size: 20, stroke: 1.5 });
    a.innerHTML = `
      <span class="trend-rank">${t.rank}</span>
      <span class="trend-thumb">${thumb}</span>
      <span class="trend-info">
        <span class="trend-name">${escapeHtml(item.name)}</span>
        <span class="trend-meta">${trendMeta(t)}</span>
      </span>`;
    row.appendChild(a);
  });
}

async function loadTrending() {
  if (COLLECTION !== 'games') return;
  try {
    const res = await API.getTrending(6);
    TRENDING = (res && res.items) || [];
  } catch { TRENDING = []; }
  renderTrending();
  renderItems(applyCurrentFilter()); // refresh the badges in the main grid
}

function filterItems() {
  const q = $('search-input').value.toLowerCase();
  const filtered = ITEMS.filter(g =>
    g.name.toLowerCase().includes(q) ||
    g.desc.toLowerCase().includes(q) ||
    g.tag.toLowerCase().includes(q)
  );
  renderItems(filtered);
  renderTrending();
}

async function loadItems() {
  ITEMS = await API.list(COLLECTION);
  filterItems();
}

// ── ADMIN: add-to-library form ───────────────────────────────────
function setupAddForm() {
  const panel = $('add-panel');
  const form = $('add-form');
  if (!panel || !form) return;

  document.addEventListener('seal:user-ready', e => {
    const admin = e.detail && e.detail.isAdmin;
    panel.classList.toggle('hidden', !admin);
    renderItems(ITEMS.length ? applyCurrentFilter() : ITEMS);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('add-form-error');
    err.classList.add('hidden');
    try {
      await API.add(COLLECTION, {
        name: $('add-name').value.trim(),
        url: $('add-url').value.trim(),
        desc: $('add-desc').value.trim(),
        tag: $('add-tag').value.trim() || 'Misc',
        thumb: $('add-thumb').value.trim(),
        isNew: $('add-new').checked
      });
      form.reset();
      await loadItems();
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('hidden');
    }
  });
}

function applyCurrentFilter() {
  const q = $('search-input').value.toLowerCase();
  return ITEMS.filter(g =>
    g.name.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q) || g.tag.toLowerCase().includes(q)
  );
}

async function initGridPage() {
  setupAddForm();
  await initSealPage();
  await loadItems();
  loadTrending(); // not awaited — the grid is already on screen
}
