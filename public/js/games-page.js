// ── GAME/TOOL GRID PAGE ─────────────────────────────────────────
// COLLECTION is set inline in games.html ("games") / tools.html ("tools")
let ITEMS = [];

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
      ${admin ? `<button class="card-remove" data-id="${item.id}" title="Remove">✕</button>` : ''}
      <div class="game-thumb">
        ${item.thumb
          ? `<img src="${item.thumb}" alt="${item.name}" onerror="this.parentElement.innerHTML='<span class=game-icon>🎮</span>'">`
          : `<span class="game-icon">${item.icon || '🎮'}</span>`}
      </div>
      <div class="game-info">
        <div class="game-top">
          <span class="game-name">${item.name}</span>
          <span class="game-tag">${item.tag}</span>
          ${item.new ? '<span class="game-new">New</span>' : ''}
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

function filterItems() {
  const q = $('search-input').value.toLowerCase();
  const filtered = ITEMS.filter(g =>
    g.name.toLowerCase().includes(q) ||
    g.desc.toLowerCase().includes(q) ||
    g.tag.toLowerCase().includes(q)
  );
  renderItems(filtered);
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
}
