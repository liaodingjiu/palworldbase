/**
 * pal-finder.js — Palworld Pal Finder (client-side)
 *
 * Zero dependencies, vanilla JS.
 * Loads pal-stats.json and provides multi-select filtering, sorting,
 * URL parameter support, and card grid rendering.
 *
 * URL params: ?element=fire,water&work=mining,kindling&rarity=legendary,epic
 *             &mount=flyable&tier=S,A&sort=attack&q=anubis
 */
(function () {
  'use strict';

  // ---- Constants ----
  const ELEMENTS = ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Ground', 'Dark', 'Dragon', 'Neutral'];
  const WORKS = [
    { key: 'kindling', label: 'Kindling' },
    { key: 'watering', label: 'Watering' },
    { key: 'planting', label: 'Planting' },
    { key: 'generating', label: 'Generating Electricity' },
    { key: 'handiwork', label: 'Handiwork' },
    { key: 'gathering', label: 'Gathering' },
    { key: 'lumbering', label: 'Lumbering' },
    { key: 'mining', label: 'Mining' },
    { key: 'medicine', label: 'Medicine Production' },
    { key: 'cooling', label: 'Cooling' },
    { key: 'transporting', label: 'Transporting' },
    { key: 'farming', label: 'Farming' },
  ];
  const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
  const TIERS = ['S', 'A', 'B'];
  const PAGE_SIZE = 24;

  // ---- State ----
  let allPals = [];
  let filteredPals = [];
  let displayedCount = 0;

  let filters = {
    elements: new Set(),
    works: new Set(),
    rarities: new Set(),
    tiers: new Set(),
    mount: 'all', // 'all' | 'flyable' | 'rideable' | 'neither'
    sort: 'total', // 'total' | 'hp' | 'attack' | 'defense' | 'speed' | 'name'
    query: '',
  };

  // ---- Data Loading ----
  async function init() {
    try {
      const resp = await fetch('/data/pal-stats.json');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      allPals = await resp.json();
      console.log('[PalFinder] Loaded ' + allPals.length + ' Pals.');

      readURLParams();
      buildFilterPanel();
      applyFilters(true); // initial render
      setupEventListeners();

    } catch (err) {
      console.error('[PalFinder] Failed to load data:', err);
      const container = document.getElementById('finder-results');
      if (container) {
        container.innerHTML = '<div class="glass-panel" style="text-align:center;color:var(--color-danger);padding:var(--space-6)">Failed to load Pal data. Please refresh the page.</div>';
      }
    }
  }

  // ---- URL Parameters ----
  function readURLParams() {
    const params = new URLSearchParams(window.location.search);

    const el = params.get('element');
    if (el) el.split(',').forEach(e => {
      const norm = e.trim();
      const match = ELEMENTS.find(x => x.toLowerCase() === norm.toLowerCase());
      if (match) filters.elements.add(match);
    });

    const wk = params.get('work');
    if (wk) wk.split(',').forEach(w => {
      const norm = w.trim().toLowerCase();
      const match = WORKS.find(x => x.key === norm);
      if (match) filters.works.add(match.key);
    });

    const ra = params.get('rarity');
    if (ra) ra.split(',').forEach(r => {
      const norm = r.trim();
      const match = RARITIES.find(x => x.toLowerCase() === norm.toLowerCase());
      if (match) filters.rarities.add(match);
    });

    const ti = params.get('tier');
    if (ti) ti.split(',').forEach(t => {
      const norm = t.trim().toUpperCase();
      if (TIERS.includes(norm)) filters.tiers.add(norm);
    });

    const mt = params.get('mount');
    if (mt === 'flyable' || mt === 'rideable' || mt === 'neither') {
      filters.mount = mt;
    }

    const st = params.get('sort');
    if (['total', 'hp', 'attack', 'defense', 'speed', 'name'].includes(st)) {
      filters.sort = st;
    }

    const q = params.get('q');
    if (q) filters.query = q.trim();
  }

  function updateURL() {
    const params = new URLSearchParams();

    if (filters.elements.size > 0) params.set('element', [...filters.elements].join(','));
    if (filters.works.size > 0) params.set('work', [...filters.works].join(','));
    if (filters.rarities.size > 0) params.set('rarity', [...filters.rarities].join(','));
    if (filters.tiers.size > 0) params.set('tier', [...filters.tiers].join(','));
    if (filters.mount !== 'all') params.set('mount', filters.mount);
    if (filters.sort !== 'total') params.set('sort', filters.sort);
    if (filters.query) params.set('q', filters.query);

    const qs = params.toString();
    const url = window.location.pathname + (qs ? '?' + qs : '');
    window.history.replaceState({}, '', url);
  }

  // ---- Filter Panel Builder ----
  function buildFilterPanel() {
    const panel = document.getElementById('finder-filters');
    if (!panel) return;

    panel.innerHTML = `
      <div class="finder-filter-group">
        <label class="finder-filter-label">🔍 Search</label>
        <input type="text" id="finder-search" class="form-input" placeholder="Pal name or number…"
               value="${escAttr(filters.query)}" autocomplete="off">
      </div>

      <div class="finder-filter-group">
        <label class="finder-filter-label">🔥 Element</label>
        <div class="finder-chips" id="filter-elements">
          ${ELEMENTS.map(el => {
            const cls = el.toLowerCase();
            const checked = filters.elements.has(el);
            return `<label class="finder-chip ${cls} ${checked ? 'active' : ''}">
              <input type="checkbox" value="${el}" ${checked ? 'checked' : ''} hidden>
              ${el}
            </label>`;
          }).join('')}
        </div>
      </div>

      <div class="finder-filter-group">
        <label class="finder-filter-label">🔨 Work Type</label>
        <div class="finder-chips" id="filter-works">
          ${WORKS.map(w => {
            const checked = filters.works.has(w.key);
            return `<label class="finder-chip work-chip ${checked ? 'active' : ''}">
              <input type="checkbox" value="${w.key}" ${checked ? 'checked' : ''} hidden>
              ${w.label}
            </label>`;
          }).join('')}
        </div>
      </div>

      <div class="finder-filter-group">
        <label class="finder-filter-label">⭐ Rarity</label>
        <div class="finder-chips" id="filter-rarities">
          ${RARITIES.map(r => {
            const checked = filters.rarities.has(r);
            return `<label class="finder-chip rarity-chip ${checked ? 'active' : ''}">
              <input type="checkbox" value="${r}" ${checked ? 'checked' : ''} hidden>
              ${r}
            </label>`;
          }).join('')}
        </div>
      </div>

      <div class="finder-filter-group">
        <label class="finder-filter-label">🏷️ Tier</label>
        <div class="finder-chips" id="filter-tiers">
          ${TIERS.map(t => {
            const checked = filters.tiers.has(t);
            return `<label class="finder-chip tier-chip tier-${t.toLowerCase()} ${checked ? 'active' : ''}">
              <input type="checkbox" value="${t}" ${checked ? 'checked' : ''} hidden>
              ${t}-Tier
            </label>`;
          }).join('')}
        </div>
      </div>

      <div class="finder-filter-group">
        <label class="finder-filter-label">🕊️ Mount</label>
        <div class="finder-chips" id="filter-mount">
          ${[
            { v: 'all', l: 'All' },
            { v: 'flyable', l: '🕊️ Flyable' },
            { v: 'rideable', l: '🐎 Rideable' },
            { v: 'neither', l: '🚫 Neither' },
          ].map(m => {
            const checked = filters.mount === m.v;
            return `<label class="finder-chip mount-chip ${checked ? 'active' : ''}">
              <input type="radio" name="mount" value="${m.v}" ${checked ? 'checked' : ''} hidden>
              ${m.l}
            </label>`;
          }).join('')}
        </div>
      </div>

      <div class="finder-filter-group">
        <label class="finder-filter-label">📊 Sort By</label>
        <select id="finder-sort" class="form-select" style="max-width:200px">
          ${[
            { v: 'total', l: 'Stat Total' },
            { v: 'hp', l: 'HP' },
            { v: 'attack', l: 'Attack' },
            { v: 'defense', l: 'Defense' },
            { v: 'speed', l: 'Speed' },
            { v: 'name', l: 'Name A–Z' },
          ].map(s => `<option value="${s.v}" ${filters.sort === s.v ? 'selected' : ''}>${s.l}</option>`).join('')}
        </select>
      </div>

      <button id="finder-reset" class="cta-button cta-button-secondary" style="font-size:0.8125rem;padding:6px 16px">
        Reset All Filters
      </button>
    `;
  }

  // ---- Event Listeners ----
  function setupEventListeners() {
    // Use event delegation on the filter panel
    const panel = document.getElementById('finder-filters');
    if (!panel) return;

    panel.addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'mount') {
        filters.mount = t.value;
      } else if (t.closest('#filter-elements')) {
        toggleSetFilter(filters.elements, t.value, t.checked);
      } else if (t.closest('#filter-works')) {
        toggleSetFilter(filters.works, t.value, t.checked);
      } else if (t.closest('#filter-rarities')) {
        toggleSetFilter(filters.rarities, t.value, t.checked);
      } else if (t.closest('#filter-tiers')) {
        toggleSetFilter(filters.tiers, t.value, t.checked);
      } else if (t.id === 'finder-sort') {
        filters.sort = t.value;
      }

      // Update chip visual state
      updateChipState(t);

      updateURL();
      applyFilters(false);
    });

    // Search input (debounced)
    let searchTimer;
    panel.addEventListener('input', (e) => {
      if (e.target.id === 'finder-search') {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          filters.query = e.target.value.trim();
          updateURL();
          applyFilters(false);
        }, 300);
      }
    });

    // Reset button
    const resetBtn = document.getElementById('finder-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        filters.elements.clear();
        filters.works.clear();
        filters.rarities.clear();
        filters.tiers.clear();
        filters.mount = 'all';
        filters.sort = 'total';
        filters.query = '';
        updateURL();
        buildFilterPanel();
        setupEventListeners(); // Re-bind since panel was rebuilt
        applyFilters(false);
      });
    }

    // Infinite scroll / Load more
    const loadMore = document.getElementById('finder-load-more');
    if (loadMore) {
      loadMore.addEventListener('click', () => {
        renderMoreCards();
      });
    }
  }

  function toggleSetFilter(set, value, add) {
    if (add) set.add(value);
    else set.delete(value);
  }

  function updateChipState(input) {
    const label = input.closest('label');
    if (!label) return;
    if (input.checked) label.classList.add('active');
    else label.classList.remove('active');
  }

  // ---- Filter Logic ----
  function applyFilters(isInitial) {
    let result = [...allPals];

    // Element filter
    if (filters.elements.size > 0) {
      result = result.filter(p => p.elements.some(el => filters.elements.has(el)));
    }

    // Work filter: Pal must have at least one selected work type with level > 0
    if (filters.works.size > 0) {
      result = result.filter(p => {
        if (!p.workSuitability) return false;
        return [...filters.works].some(w => (p.workSuitability[w] || 0) > 0);
      });
    }

    // Rarity filter
    if (filters.rarities.size > 0) {
      result = result.filter(p => filters.rarities.has(p.rarity));
    }

    // Tier filter
    if (filters.tiers.size > 0) {
      result = result.filter(p => filters.tiers.has(p.tier));
    }

    // Mount filter
    if (filters.mount === 'flyable') {
      result = result.filter(p => p.isFlyable);
    } else if (filters.mount === 'rideable') {
      result = result.filter(p => p.isRideable && !p.isFlyable);
    } else if (filters.mount === 'neither') {
      result = result.filter(p => !p.isRideable && !p.isFlyable);
    }

    // Text search
    if (filters.query) {
      const q = filters.query.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        String(p.number).includes(q)
      );
    }

    // Sort
    result = sortPals(result, filters.sort);

    filteredPals = result;
    displayedCount = 0;

    // Render
    const container = document.getElementById('finder-results');
    if (!container) return;

    if (result.length === 0) {
      container.innerHTML = `<div class="glass-panel" style="text-align:center;padding:var(--space-8);grid-column:1/-1">
        <p style="font-size:1.125rem;color:var(--color-text-muted);margin-bottom:var(--space-4)">
          No Pals match your filters.
        </p>
        <button id="finder-reset-inline" class="cta-button cta-button-secondary">Reset Filters</button>
      </div>`;
      document.getElementById('finder-load-more').style.display = 'none';
      document.getElementById('finder-count').textContent = '0 Pals found';

      // Bind the inline reset button
      const resetInline = document.getElementById('finder-reset-inline');
      if (resetInline) {
        resetInline.addEventListener('click', () => {
          document.getElementById('finder-reset').click();
        });
      }
      return;
    }

    // Build grid and show first page
    container.innerHTML = '<div class="pal-grid" id="finder-grid"></div>';
    document.getElementById('finder-count').textContent =
      `${result.length} Pal${result.length !== 1 ? 's' : ''} found`;

    renderMoreCards();

    // Show/hide load more
    updateLoadMoreButton();
  }

  function sortPals(pals, sortKey) {
    return [...pals].sort((a, b) => {
      switch (sortKey) {
        case 'hp':       return b.stats.hp - a.stats.hp;
        case 'attack':   return b.stats.attack - a.stats.attack;
        case 'defense':  return b.stats.defense - a.stats.defense;
        case 'speed':    return b.stats.speed - a.stats.speed;
        case 'name':     return a.name.localeCompare(b.name);
        case 'total':
        default:         return b.statTotal - a.statTotal;
      }
    });
  }

  // ---- Card Rendering ----
  function renderPalCard(pal) {
    const el = (pal.elements && pal.elements[0]) ? pal.elements[0].toLowerCase() : 'neutral';
    const tier = pal.tier || 'B';
    const attrs = [];
    if (pal.isFlyable) attrs.push('🕊️ Flyer');
    else if (pal.isRideable) attrs.push('🐎 Rideable');

    return `<div class="pal-card ${el}">
      <a href="/pals/${pal.slug}/" style="text-decoration:none;color:inherit">
        <img src="/images/pals/${pal.slug}.webp" alt="${escHTML(pal.name)}"
             class="pal-card-image" loading="lazy"
             onerror="this.src='/images/pals/${pal.slug}.png'">
        <div class="pal-card-name">${escHTML(pal.name)}</div>
        <div class="pal-card-number">#${pal.number}</div>
        <div class="pal-card-badges">
          <span class="badge badge-tier-${tier.toLowerCase()}">${tier}</span>
          <span class="badge badge-element ${el}">${pal.elements[0]}</span>
          <span class="badge badge-rarity-${(pal.rarity || 'common').toLowerCase()}">${pal.rarity}</span>
          ${attrs.map(a => `<span class="badge badge-work">${a}</span>`).join('')}
        </div>
        <div class="pal-card-stats" style="margin-top:12px">
          <div class="pal-card-stat"><span>HP</span><span class="pal-card-stat-value">${pal.stats.hp}</span></div>
          <div class="pal-card-stat"><span>ATK</span><span class="pal-card-stat-value">${pal.stats.attack}</span></div>
          <div class="pal-card-stat"><span>DEF</span><span class="pal-card-stat-value">${pal.stats.defense}</span></div>
          <div class="pal-card-stat"><span>SPD</span><span class="pal-card-stat-value">${pal.stats.speed}</span></div>
        </div>
      </a>
    </div>`;
  }

  function renderMoreCards() {
    const grid = document.getElementById('finder-grid');
    if (!grid) return;

    const next = filteredPals.slice(displayedCount, displayedCount + PAGE_SIZE);
    if (next.length === 0) return;

    grid.insertAdjacentHTML('beforeend', next.map(renderPalCard).join(''));
    displayedCount += next.length;

    updateLoadMoreButton();
  }

  function updateLoadMoreButton() {
    const btn = document.getElementById('finder-load-more');
    if (!btn) return;
    if (displayedCount >= filteredPals.length) {
      btn.style.display = 'none';
    } else {
      btn.style.display = '';
      const remaining = filteredPals.length - displayedCount;
      btn.textContent = `Load More (${remaining} remaining)`;
    }
  }

  // ---- Utility ----
  function escHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escAttr(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- Initialize on DOM ready ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
