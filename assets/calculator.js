/**
 * calculator.js v2 — Palworld Breeding Calculator
 *
 * Hybrid SEO: static HTML skeleton for Google + JS enhancement for users.
 *
 * Modes:
 *   "target"  (default) — I want X, show me the best path
 *   "forward" — Two parents → child + what else they can make
 *
 * Features: Best Path (BFS chain), Alternative Routes, Palbox, URL params
 */
(function () {
  'use strict';

  // ---- State ----
  let palBP = {}, bpSlugs = [], bpValues = [];
  let specialCombos = [], palList = [], palByName = {};
  let reverseIndex = {};       // { childSlug: [{parent1, parent2, parent1BP, parent2BP, isSpecial}] }
  let bestPathCache = {};      // { slug: { steps, chain } }
  let palbox = new Set();      // Owned Pal slugs

  const MAX_ALT_ROUTES = 5;
  const MAX_STEPS = 4;
  const STARTER_BP = 1000;

  // ---- Data Loading ----
  async function init() {
    try {
      const [calcResp, statsResp] = await Promise.all([
        fetch('/data/calculator-data.json'),
        fetch('/data/pal-stats.json'),
      ]);

      if (!calcResp.ok || !statsResp.ok) throw new Error('Data fetch failed');

      const calcData = await calcResp.json();
      const statsData = await statsResp.json();

      palBP = calcData.palBP;
      bpSlugs = calcData.bpSorted;
      bpValues = bpSlugs.map(s => palBP[s] || 0);
      specialCombos = calcData.specialCombos;
      palList = statsData;

      for (const p of palList) {
        palByName[p.slug] = p;
      }

      console.log('[Calculator] ' + palList.length + ' Pals, precomputing breeding paths...');

      // Build reverse index on the fly
      buildReverseIndex();

      // Precompute Best Path for all Pals (BFS from starters)
      precomputeBestPaths();

      // Load Palbox from localStorage
      loadPalbox();

      console.log('[Calculator] Ready. Palbox: ' + palbox.size + ' Pals.');

      // Init UI
      setupModeSwitch();
      hideStaticSelects();
      setupSearchInputs();
      setupForms();
      setupPalboxPanel();
      handleURLParams();

    } catch (err) {
      console.error('[Calculator] Init failed:', err);
      const res = document.getElementById('calc-results');
      if (res) res.innerHTML = '<div class="glass-panel" style="text-align:center;color:var(--color-danger);padding:var(--space-6)">Failed to load data. Please refresh.</div>';
    }
  }

  // ---- Build Reverse Index (on the fly from all possible pairs) ----
  function buildReverseIndex() {
    reverseIndex = {};
    const slugs = Object.keys(palBP);

    for (let i = 0; i < slugs.length; i++) {
      for (let j = i; j < slugs.length; j++) {
        const a = slugs[i], b = slugs[j];
        const bpA = palBP[a], bpB = palBP[b];
        if (bpA === undefined || bpB === undefined) continue;

        let childSlug = null, isSpecial = false;

        // Check special combos first
        for (const sc of specialCombos) {
          if ((sc.a === a && sc.b === b) || (sc.a === b && sc.b === a)) {
            childSlug = sc.c; isSpecial = true; break;
          }
        }

        // Standard formula
        if (!childSlug) {
          const avgBP = Math.floor((bpA + bpB) / 2);
          childSlug = findClosestBPSlug(avgBP);
        }

        if (!reverseIndex[childSlug]) reverseIndex[childSlug] = [];
        reverseIndex[childSlug].push({
          parent1: a, parent2: b,
          parent1BP: bpA, parent2BP: bpB,
          isSpecial,
        });
      }
    }

    // Trim each list: keep specials + top 30 by combined BP
    for (const slug of Object.keys(reverseIndex)) {
      const pairs = reverseIndex[slug];
      pairs.sort((x, y) => {
        if (x.isSpecial !== y.isSpecial) return x.isSpecial ? -1 : 1;
        return (y.parent1BP + y.parent2BP) - (x.parent1BP + x.parent2BP);
      });
      reverseIndex[slug] = pairs.slice(0, 30);
    }
  }

  // ---- BFS Precomputation: shortest path from starter Pals to every Pal ----
  function precomputeBestPaths() {
    bestPathCache = {};
    const visited = new Set();
    const queue = [];

    // Seed: all starter Pals at distance 0
    for (const slug of Object.keys(palBP)) {
      const bp = palBP[slug];
      if (bp >= STARTER_BP || slug === 'chikipi' || slug === 'lamball' || slug === 'cattiva' || slug === 'teafant') {
        bestPathCache[slug] = { steps: 0, chain: [], isStarter: true };
        visited.add(slug);
        queue.push(slug);
      }
    }

    // BFS outward: for each visited Pal, find children from (pal + anything)
    let head = 0;
    while (head < queue.length) {
      const parent = queue[head++];
      const parentDist = bestPathCache[parent].steps;

      if (parentDist >= MAX_STEPS) continue;

      // Compute all children of (parent + any other Pal)
      const bpP = palBP[parent];
      if (bpP === undefined) continue;

      for (const other of Object.keys(palBP)) {
        if (other === parent) continue;
        const bpO = palBP[other];
        if (bpO === undefined) continue;

        // Check special combos
        let child = null, isSpec = false;
        for (const sc of specialCombos) {
          if ((sc.a === parent && sc.b === other) || (sc.a === other && sc.b === parent)) {
            child = sc.c; isSpec = true; break;
          }
        }
        if (!child) {
          const avg = Math.floor((bpP + bpO) / 2);
          child = findClosestBPSlug(avg);
        }

        if (visited.has(child)) continue;

        const newDist = parentDist + 1;
        bestPathCache[child] = {
          steps: newDist,
          chain: [{
            parent1: parent,
            parent2: other,
            child,
            isSpecial: isSpec,
            parent1BP: bpP,
            parent2BP: bpO,
          }],
          isStarter: false,
        };
        visited.add(child);
        queue.push(child);
      }
    }

    console.log('[Calculator] BFS: ' + Object.keys(bestPathCache).length + ' Pals reachable from starters.');
  }

  // ---- Binary search for closest BP ----
  function findClosestBPSlug(targetBP) {
    let lo = 0, hi = bpSlugs.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (bpValues[mid] < targetBP) lo = mid + 1; else hi = mid; }
    let best = lo, bestDist = Math.abs(bpValues[lo] - targetBP);
    if (lo > 0 && Math.abs(bpValues[lo - 1] - targetBP) < bestDist) best = lo - 1;
    return bpSlugs[best];
  }

  // ---- Full Best Path (reconstruct chain from BFS + reverse data) ----
  function getBestPath(targetSlug) {
    const cached = bestPathCache[targetSlug];
    if (!cached) return null;
    if (cached.isStarter) return { steps: 0, chain: [], isStarter: true };

    // Build full chain by walking backwards through reverse index
    const fullChain = [];
    let current = targetSlug;
    const seen = new Set();

    for (let step = 0; step < MAX_STEPS && !seen.has(current); step++) {
      seen.add(current);
      const cp = bestPathCache[current];
      if (!cp || cp.isStarter) break;

      // Find the best pair that produces `current` giving us the shortest path
      const pairs = reverseIndex[current] || [];
      let bestPair = null, bestScore = Infinity;

      for (const p of pairs) {
        const d1 = bestPathCache[p.parent1];
        const d2 = bestPathCache[p.parent2];
        const dist1 = d1 ? d1.steps : 99;
        const dist2 = d2 ? d2.steps : 99;
        // Prefer: special combo, then shorter steps, then higher combined BP
        const score = (p.isSpecial ? -1000 : 0) + (dist1 + dist2) * 100 - (p.parent1BP + p.parent2BP);
        if (score < bestScore) {
          bestScore = score;
          bestPair = p;
        }
      }

      if (!bestPair) break;

      fullChain.push({
        parent1: bestPair.parent1,
        parent2: bestPair.parent2,
        child: current,
        isSpecial: bestPair.isSpecial,
        parent1BP: bestPair.parent1BP,
        parent2BP: bestPair.parent2BP,
      });

      // Continue with the harder parent (lower BP = harder to catch)
      const d1 = bestPathCache[bestPair.parent1];
      const d2 = bestPathCache[bestPair.parent2];
      const next = (!d1 || d1.isStarter) ? bestPair.parent2 :
                   (!d2 || d2.isStarter) ? bestPair.parent1 :
                   (palBP[bestPair.parent1] <= palBP[bestPair.parent2]) ? bestPair.parent1 : bestPair.parent2;
      current = next;
    }

    return { steps: fullChain.length, chain: fullChain.reverse(), isStarter: false };
  }

  // ---- Alternative Routes ----
  function getAlternativeRoutes(targetSlug) {
    const pairs = reverseIndex[targetSlug] || [];
    if (pairs.length <= 1) return [];

    // Score each pair: prefer specials, lower parent steps, higher BP
    const scored = pairs.map(p => {
      const d1 = bestPathCache[p.parent1];
      const d2 = bestPathCache[p.parent2];
      const totalSteps = (d1 ? d1.steps : 99) + (d2 ? d2.steps : 99) + 1;
      const score = (p.isSpecial ? 1000 : 0) + (p.parent1BP + p.parent2BP) - totalSteps * 50;
      return { ...p, totalSteps, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(1, MAX_ALT_ROUTES + 1); // Skip first (it's the best path)
  }

  // ---- Difficulty ----
  function getDifficulty(bp) {
    if (!bp && bp !== 0) return { label: 'Unknown', emoji: '❓', cls: '' };
    if (bp >= 1000) return { label: 'Starter', emoji: '🟢', cls: 'easy' };
    if (bp >= 500)  return { label: 'Easy', emoji: '🟢', cls: 'easy' };
    if (bp >= 200)  return { label: 'Medium', emoji: '🟡', cls: 'medium' };
    if (bp >= 100)  return { label: 'Hard', emoji: '🟠', cls: 'hard' };
    if (bp >= 10)   return { label: 'Endgame', emoji: '🔴', cls: 'endgame' };
    return { label: 'Legendary', emoji: '⚡', cls: 'legendary' };
  }

  // ---- Palbox ----
  function loadPalbox() {
    try {
      const raw = localStorage.getItem('palworld_palbox');
      if (raw) {
        const arr = JSON.parse(raw);
        palbox = new Set(arr);
        updatePalboxUI();
      }
    } catch (e) { palbox = new Set(); }
  }

  function savePalbox() {
    localStorage.setItem('palworld_palbox', JSON.stringify([...palbox]));
    updatePalboxUI();
  }

  function togglePalbox(slug) {
    if (palbox.has(slug)) palbox.delete(slug);
    else palbox.add(slug);
    savePalbox();
  }

  function updatePalboxUI() {
    const count = document.getElementById('palbox-count');
    const list = document.getElementById('palbox-list');
    if (count) count.textContent = palbox.size;
    if (list) {
      if (palbox.size === 0) {
        list.innerHTML = '<span style="font-size:0.75rem;color:var(--color-text-muted)">No Pals added yet. Click the bookmark icon on any Pal to add it.</span>';
      } else {
        list.innerHTML = [...palbox].map(slug => {
          const p = palByName[slug];
          if (!p) return '';
          return `<span class="palbox-chip" data-slug="${slug}" title="Click to remove">
            ${esc(p.name)} <span style="cursor:pointer;margin-left:2px" class="palbox-remove" data-slug="${slug}">×</span>
          </span>`;
        }).join('');
        // Bind remove handlers
        list.querySelectorAll('.palbox-remove').forEach(el => {
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePalbox(el.dataset.slug);
            updatePalboxUI();
            // Re-run if there's an active result
            if (document.getElementById('calc-mode-target').classList.contains('active')) {
              const slug = document.getElementById('search-target').dataset.slug;
              if (slug) renderTargetResult(slug);
            }
          });
        });
      }
    }
  }

  // ---- UI Mode Switch ----
  function setupModeSwitch() {
    const btnTarget = document.getElementById('calc-mode-target');
    const btnForward = document.getElementById('calc-mode-forward');
    const panelTarget = document.getElementById('calc-panel-target');
    const panelForward = document.getElementById('calc-panel-forward');

    if (!btnTarget || !btnForward) return;

    function switchTo(mode) {
      if (mode === 'target') {
        btnTarget.classList.add('active');
        btnForward.classList.remove('active');
        if (panelTarget) panelTarget.style.display = '';
        if (panelForward) panelForward.style.display = 'none';
      } else {
        btnForward.classList.add('active');
        btnTarget.classList.remove('active');
        if (panelForward) panelForward.style.display = '';
        if (panelTarget) panelTarget.style.display = 'none';
      }
      // Update URL
      const url = new URL(window.location);
      url.searchParams.delete('parentA');
      url.searchParams.delete('parentB');
      url.searchParams.delete('target');
      window.history.replaceState({}, '', url.pathname);
      document.getElementById('calc-results').innerHTML = '';
    }

    btnTarget.addEventListener('click', () => switchTo('target'));
    btnForward.addEventListener('click', () => switchTo('forward'));
  }

  // ---- Hide Static Selects, Inject Search Inputs ----
  function hideStaticSelects() {
    // Hide original <select> elements (they're kept in DOM for SEO)
    ['calc-select-a', 'calc-select-b', 'calc-select-target', 'calc-select-target-2'].forEach(id => {
      const sel = document.getElementById(id);
      if (sel) sel.style.display = 'none';
    });
  }

  function setupSearchInputs() {
    makeSearchable('search-target', 'calc-select-target');
    makeSearchable('search-parent-a', 'calc-select-a');
    makeSearchable('search-parent-b', 'calc-select-b');
    makeSearchable('search-target-2', 'calc-select-target-2');
  }

  function makeSearchable(inputId, selectId) {
    const input = document.getElementById(inputId);
    const select = document.getElementById(selectId);
    if (!input || !select) return;

    const dropdown = document.createElement('div');
    dropdown.className = 'calc-search-dropdown';
    dropdown.style.cssText = 'display:none;position:absolute;top:100%;left:0;right:0;z-index:50;max-height:240px;overflow-y:auto;background:var(--color-bg-elevated);border:1px solid var(--color-border);border-radius:var(--radius-md);margin-top:4px;box-shadow:var(--shadow-lg)';

    const wrapper = input.parentNode;
    wrapper.style.position = 'relative';
    wrapper.appendChild(dropdown);

    input.addEventListener('focus', () => filterSearch(input, dropdown, select, ''));
    input.addEventListener('input', () => filterSearch(input, dropdown, select, input.value));
    input.addEventListener('blur', () => setTimeout(() => dropdown.style.display = 'none', 200));
    input.addEventListener('keydown', (e) => handleSearchKey(e, input, dropdown, select));
  }

  function filterSearch(input, dropdown, select, query) {
    const q = query.toLowerCase().trim();
    let matches = palList;
    if (q) {
      matches = palList.filter(p =>
        p.name.toLowerCase().includes(q) ||
        String(p.number).includes(q) ||
        (p.elements && p.elements.some(el => el.toLowerCase().includes(q)))
      );
    }
    matches = matches.slice(0, 30);

    if (matches.length === 0) {
      dropdown.innerHTML = '<div style="padding:8px 12px;font-size:0.8125rem;color:var(--color-text-muted)">No Pals found</div>';
    } else {
      dropdown.innerHTML = matches.map(p => {
        const el = (p.elements && p.elements[0]) ? p.elements[0].toLowerCase() : 'neutral';
        const inBox = palbox.has(p.slug) ? ' 📦' : '';
        return `<div class="calc-search-option" data-slug="${p.slug}"
          style="padding:8px 12px;cursor:pointer;font-size:0.8125rem;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--color-border);transition:background var(--transition-fast)">
          <span>${esc(p.name)} <span class="badge badge-element ${el}" style="font-size:0.625rem">${p.elements[0]}</span>${inBox}</span>
          <span style="color:var(--color-text-muted);font-size:0.6875rem">#${p.number}</span>
        </div>`;
      }).join('');
    }

    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.calc-search-option').forEach(opt => {
      opt.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const slug = opt.dataset.slug;
        select.value = slug;
        input.value = palByName[slug] ? palByName[slug].name : slug;
        input.dataset.slug = slug;
        dropdown.style.display = 'none';

        // Auto-submit for target mode
        if (select.id === 'calc-select-target' || select.id === 'calc-select-target-2') {
          renderTargetResult(slug);
        }
        // Auto-submit forward mode if both parents filled
        if ((select.id === 'calc-select-a' || select.id === 'calc-select-b')) {
          const otherId = select.id === 'calc-select-a' ? 'calc-select-b' : 'calc-select-a';
          const otherSelect = document.getElementById(otherId);
          const otherInput = document.getElementById(otherId === 'calc-select-a' ? 'search-parent-a' : 'search-parent-b');
          if (otherSelect && otherSelect.value) {
            renderForwardResult(
              select.id === 'calc-select-a' ? slug : otherSelect.value,
              select.id === 'calc-select-b' ? slug : otherSelect.value
            );
          }
        }
      });
      opt.addEventListener('mouseenter', function() { this.style.background = 'var(--color-surface-hover)'; });
      opt.addEventListener('mouseleave', function() { this.style.background = 'transparent'; });
    });
  }

  function handleSearchKey(e, input, dropdown, select) {
    const opts = dropdown.querySelectorAll('.calc-search-option');
    if (!opts.length) return;
    let idx = Array.from(opts).findIndex(o => {
      const bg = o.style.background;
      return bg && bg !== 'transparent' && bg !== '';
    });
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, opts.length - 1); highlightSearchOpt(opts, idx); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); highlightSearchOpt(opts, idx); }
    else if (e.key === 'Enter') { e.preventDefault(); if (idx >= 0 && opts[idx]) opts[idx].dispatchEvent(new MouseEvent('mousedown')); }
    else if (e.key === 'Escape') { dropdown.style.display = 'none'; }
  }

  function highlightSearchOpt(opts, idx) {
    opts.forEach((o, i) => o.style.background = i === idx ? 'var(--color-surface-hover)' : 'transparent');
    if (opts[idx]) opts[idx].scrollIntoView({ block: 'nearest' });
  }

  // ---- Quick Tags (hot Pals) ----
  function setupForms() {
    // Quick tags
    document.querySelectorAll('.calc-quick-tag').forEach(tag => {
      tag.addEventListener('click', (e) => {
        e.preventDefault();
        const slug = tag.dataset.slug;
        if (!slug) return;

        // Switch to target mode
        document.getElementById('calc-mode-target').click();

        // Fill search
        const input = document.getElementById('search-target');
        const select = document.getElementById('calc-select-target');
        if (input && select && palByName[slug]) {
          input.value = palByName[slug].name;
          input.dataset.slug = slug;
          select.value = slug;
        }

        renderTargetResult(slug);
        document.getElementById('calc-results').scrollIntoView({ behavior: 'smooth' });
      });
    });

    // Forward form
    const btn = document.getElementById('calc-forward-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        const a = document.getElementById('calc-select-a').value;
        const b = document.getElementById('calc-select-b').value;
        if (!a || !b) { showError('Select both parents.'); return; }
        renderForwardResult(a, b);
        document.getElementById('calc-results').scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Reverse form (bottom)
    const revBtn = document.getElementById('calc-reverse-btn');
    if (revBtn) {
      revBtn.addEventListener('click', () => {
        const t = document.getElementById('calc-select-target-2').value;
        if (!t) { showError('Select a target Pal.'); return; }
        renderTargetResult(t);
        document.getElementById('calc-results').scrollIntoView({ behavior: 'smooth' });
      });
    }
  }

  // ---- Palbox Panel ----
  function setupPalboxPanel() {
    const toggle = document.getElementById('palbox-toggle');
    const panel = document.getElementById('palbox-panel');
    if (!toggle || !panel) return;

    toggle.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? '' : 'none';
    });

    // Init: show if has Pals
    if (palbox.size > 0 && panel) panel.style.display = '';
  }

  // ---- URL Params ----
  function handleURLParams() {
    const params = new URLSearchParams(window.location.search);
    const target = params.get('target');
    const parentA = params.get('parentA');
    const parentB = params.get('parentB');

    if (target) {
      const input = document.getElementById('search-target');
      const select = document.getElementById('calc-select-target');
      if (palByName[target]) {
        if (input) { input.value = palByName[target].name; input.dataset.slug = target; }
        if (select) select.value = target;
        document.getElementById('calc-mode-target').click();
        renderTargetResult(target);
      }
    } else if (parentA && parentB) {
      document.getElementById('calc-mode-forward').click();
      const selA = document.getElementById('calc-select-a');
      const selB = document.getElementById('calc-select-b');
      const inpA = document.getElementById('search-parent-a');
      const inpB = document.getElementById('search-parent-b');
      if (selA) selA.value = parentA;
      if (selB) selB.value = parentB;
      if (inpA && palByName[parentA]) { inpA.value = palByName[parentA].name; inpA.dataset.slug = parentA; }
      if (inpB && palByName[parentB]) { inpB.value = palByName[parentB].name; inpB.dataset.slug = parentB; }
      renderForwardResult(parentA, parentB);
    }
  }

  // ---- RENDER: Target Mode ----
  function renderTargetResult(slug) {
    const target = palByName[slug];
    if (!target) return;

    const path = getBestPath(slug);
    const routes = getAlternativeRoutes(slug);
    const el = (target.elements && target.elements[0]) ? target.elements[0].toLowerCase() : 'neutral';

    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('target', slug);
    url.searchParams.delete('parentA');
    url.searchParams.delete('parentB');
    window.history.replaceState({}, '', url);

    let html = '';

    // Best Path
    html += `<div class="glass-panel glass-panel-accent" style="margin-bottom:var(--space-4)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4);flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:12px">
          <img src="/images/pals/${slug}.webp" alt="${esc(target.name)}"
               style="width:48px;height:48px;object-fit:contain;border-radius:var(--radius-md);background:var(--color-bg)"
               onerror="this.src='/images/pals/${slug}.png'">
          <div>
            <span style="font-family:var(--font-display);font-size:1rem;color:var(--color-accent)">🏆 Best Path to </span>
            <a href="/pals/${slug}/" style="font-weight:700;font-size:1.0625rem">${esc(target.name)}</a>
            <div style="display:flex;gap:6px;margin-top:2px">
              <span class="badge badge-element ${el}">${target.elements[0]}</span>
              <span class="badge badge-tier-${(target.tier||'B').toLowerCase()}">${target.tier || 'B'}</span>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="cta-button cta-button-secondary" onclick="navigator.clipboard.writeText(window.location.href)" style="font-size:0.75rem;padding:4px 12px">📋 Copy Link</button>
          <button class="cta-button cta-button-secondary palbox-btn" data-slug="${slug}" style="font-size:0.75rem;padding:4px 12px">
            ${palbox.has(slug) ? '📦 Owned' : '📦 Add to Palbox'}
          </button>
        </div>
      </div>`;

    if (!path || path.isStarter) {
      html += `<p style="font-size:0.9375rem;color:var(--color-text-secondary);margin-bottom:0">
        🟢 <strong>${esc(target.name)}</strong> is a starter Pal — catch it in the wild! BP ${palBP[slug]} makes it easy to find.</p>`;
    } else {
      // Chain visualization
      html += `<div class="breeding-chain">`;

      // Step 1: Parents
      const firstStep = path.chain[0];
      html += renderChainStep(firstStep, 1);

      // Intermediate steps
      for (let i = 1; i < path.chain.length; i++) {
        html += `<div class="chain-arrow">↓ Breed → Hatch</div>`;
        html += renderChainStep(path.chain[i], i + 1);
      }

      // Final step: → target
      html += `<div class="chain-arrow">↓ Breed → Hatch</div>`;
      html += `<div class="chain-target" style="display:flex;align-items:center;gap:10px;padding:12px;background:rgba(0,212,255,0.08);border-radius:var(--radius-md);border:2px solid var(--color-accent)">
        <img src="/images/pals/${slug}.webp" alt="${esc(target.name)}"
             style="width:40px;height:40px;object-fit:contain;border-radius:var(--radius-sm);background:var(--color-bg)"
             onerror="this.src='/images/pals/${slug}.png'">
        <span style="font-weight:700;font-size:1.0625rem">⭐ ${esc(target.name)}</span>
        <span style="font-size:0.75rem;color:var(--color-accent)">${path.steps} step${path.steps>1?'s':''} total</span>
      </div>`;
      html += `</div>`;
    }

    html += `</div>`;

    // Alternative Routes
    if (routes.length > 0) {
      html += `<details class="alt-routes" style="margin-bottom:var(--space-4)">
        <summary style="cursor:pointer;font-weight:600;padding:8px 0;font-size:0.9375rem">
          🔀 ${routes.length} Alternative Routes
        </summary>
        <div style="padding-top:8px">`;

      for (const r of routes) {
        const a = palByName[r.parent1], b = palByName[r.parent2];
        if (!a || !b) continue;
        html += `<div class="alt-route-card" style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:8px;flex-wrap:wrap">
          <a href="/pals/${r.parent1}/" style="display:flex;align-items:center;gap:4px">
            <img src="/images/pals/${r.parent1}.webp" alt="${esc(a.name)}" style="width:32px;height:32px;object-fit:contain;border-radius:var(--radius-sm);background:var(--color-bg)" onerror="this.src='/images/pals/${r.parent1}.png'">
            <span style="font-size:0.8125rem">${esc(a.name)}</span>
          </a>
          <span style="font-size:0.75rem;color:var(--color-text-muted)">+</span>
          <a href="/pals/${r.parent2}/" style="display:flex;align-items:center;gap:4px">
            <img src="/images/pals/${r.parent2}.webp" alt="${esc(b.name)}" style="width:32px;height:32px;object-fit:contain;border-radius:var(--radius-sm);background:var(--color-bg)" onerror="this.src='/images/pals/${r.parent2}.png'">
            <span style="font-size:0.8125rem">${esc(b.name)}</span>
          </a>
          ${r.isSpecial ? '<span class="badge badge-tier-s" style="font-size:0.625rem">⭐ Special</span>' : ''}
          <span style="font-size:0.6875rem;color:var(--color-text-muted);margin-left:auto">~${r.totalSteps} step${r.totalSteps>1?'s':''}</span>
        </div>`;
      }

      html += `</div></details>`;
    }

    document.getElementById('calc-results').innerHTML = html;

    // Bind Palbox buttons
    document.querySelectorAll('.palbox-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        togglePalbox(this.dataset.slug);
        renderTargetResult(slug); // Re-render
      });
    });
  }

  function renderChainStep(step, num) {
    const a = palByName[step.parent1], b = palByName[step.parent2];
    if (!a || !b) return '';
    const child = palByName[step.child];
    const childName = child ? child.name : step.child;

    return `<div class="chain-step" style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--color-bg);border-radius:var(--radius-md);border:1px solid var(--color-border);flex-wrap:wrap">
      <span style="font-size:0.75rem;color:var(--color-text-muted);min-width:24px">Step ${num}</span>
      <a href="/pals/${step.parent1}/" style="display:flex;align-items:center;gap:4px">
        <img src="/images/pals/${step.parent1}.webp" alt="${esc(a.name)}" style="width:36px;height:36px;object-fit:contain;border-radius:var(--radius-sm);background:var(--color-bg)" onerror="this.src='/images/pals/${step.parent1}.png'">
        <span style="font-size:0.8125rem">${esc(a.name)}</span>
        <span style="font-size:0.6875rem;color:var(--color-text-muted)">${getDifficulty(step.parent1BP).emoji}</span>
      </a>
      <span style="color:var(--color-accent)">+</span>
      <a href="/pals/${step.parent2}/" style="display:flex;align-items:center;gap:4px">
        <img src="/images/pals/${step.parent2}.webp" alt="${esc(b.name)}" style="width:36px;height:36px;object-fit:contain;border-radius:var(--radius-sm);background:var(--color-bg)" onerror="this.src='/images/pals/${step.parent2}.png'">
        <span style="font-size:0.8125rem">${esc(b.name)}</span>
        <span style="font-size:0.6875rem;color:var(--color-text-muted)">${getDifficulty(step.parent2BP).emoji}</span>
      </a>
      <span style="font-size:0.75rem;color:var(--color-text-muted)">→</span>
      <span style="font-weight:600;font-size:0.875rem">${esc(childName)}</span>
      ${step.isSpecial ? '<span class="badge badge-tier-s" style="font-size:0.625rem">⭐ Special</span>' : ''}
    </div>`;
  }

  // ---- RENDER: Forward Mode ----
  function renderForwardResult(slugA, slugB) {
    const a = palByName[slugA], b = palByName[slugB];
    if (!a || !b) return;

    const bpA = palBP[slugA], bpB = palBP[slugB];
    if (bpA === undefined || bpB === undefined) { showError('Breeding data missing for one or both parents.'); return; }

    // Check special combos
    let childSlug = null, isSpecial = false;
    for (const sc of specialCombos) {
      if ((sc.a === slugA && sc.b === slugB) || (sc.a === slugB && sc.b === slugA)) {
        childSlug = sc.c; isSpecial = true; break;
      }
    }
    if (!childSlug) {
      const avgBP = Math.floor((bpA + bpB) / 2);
      childSlug = findClosestBPSlug(avgBP);
    }

    const child = palByName[childSlug];
    if (!child) { showError('Could not determine child.'); return; }

    const el = (child.elements && child.elements[0]) ? child.elements[0].toLowerCase() : 'neutral';

    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('parentA', slugA);
    url.searchParams.set('parentB', slugB);
    url.searchParams.delete('target');
    window.history.replaceState({}, '', url);

    // Also find "what else can these parents make" (top ~5 valuable Pals)
    const otherChildren = findOtherChildren(slugA, slugB, childSlug);

    let html = `<div class="glass-panel glass-panel-accent" style="text-align:center;margin-bottom:var(--space-4)">
      <div style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:var(--space-4)">
        <a href="/pals/${slugA}/" style="color:var(--color-accent)">${esc(a.name)}</a> (BP ${bpA})
        <span style="margin:0 8px">+</span>
        <a href="/pals/${slugB}/" style="color:var(--color-accent)">${esc(b.name)}</a> (BP ${bpB})
      </div>

      <div style="display:flex;align-items:center;justify-content:center;gap:var(--space-4);flex-wrap:wrap">
        <img src="/images/pals/${childSlug}.webp" alt="${esc(child.name)}"
             style="width:80px;height:80px;object-fit:contain;background:var(--color-bg);border-radius:var(--radius-md);border:1px solid var(--color-border)"
             onerror="this.src='/images/pals/${childSlug}.png'">
        <div style="text-align:left">
          <div style="font-size:1.125rem;font-weight:700;margin-bottom:4px">
            <a href="/pals/${childSlug}/" style="color:var(--color-text)">Result: ${esc(child.name)}</a>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            <span class="badge badge-element ${el}">${child.elements[0]}</span>
            <span class="badge badge-rarity-${(child.rarity||'common').toLowerCase()}">${child.rarity}</span>
            ${isSpecial ? '<span class="badge badge-tier-s">⭐ Special Combo</span>' : ''}
          </div>
          <div style="font-size:0.75rem;color:var(--color-text-secondary)">
            HP ${child.stats.hp} · ATK ${child.stats.attack} · DEF ${child.stats.defense} · SPD ${child.stats.speed} · BP ${palBP[childSlug] || '?'}
          </div>
        </div>
      </div>

      <div style="margin-top:var(--space-4);display:flex;gap:8px;justify-content:center">
        <a href="/pals/${childSlug}/" class="cta-button">View ${esc(child.name)} Details →</a>
        <button class="cta-button cta-button-secondary" onclick="navigator.clipboard.writeText(window.location.href)" style="font-size:0.8125rem">📋 Copy Link</button>
      </div>
    </div>`;

    // Other children
    if (otherChildren.length > 0) {
      html += `<div class="glass-panel" style="margin-bottom:var(--space-4)">
        <p style="font-weight:600;margin-bottom:var(--space-3);font-size:0.9375rem">💡 What else can these parents produce?</p>
        <p style="font-size:0.8125rem;color:var(--color-text-muted);margin-bottom:var(--space-3)">
          By substituting one parent with a similar-BP Pal, you can target different children:
        </p>
        <div style="display:flex;flex-wrap:wrap;gap:8px">`;
      for (const oc of otherChildren) {
        const p = palByName[oc.slug];
        if (!p) continue;
        html += `<a href="/pals/${oc.slug}/" class="alt-route-card" style="display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--color-border);border-radius:var(--radius-md);text-decoration:none;color:inherit;font-size:0.8125rem">
          <img src="/images/pals/${oc.slug}.webp" alt="${esc(p.name)}" style="width:28px;height:28px;object-fit:contain;border-radius:var(--radius-sm);background:var(--color-bg)" onerror="this.src='/images/pals/${oc.slug}.png'">
          ${esc(p.name)}
          ${oc.isSpecial ? '<span class="badge badge-tier-s" style="font-size:0.5625rem">⭐</span>' : ''}
        </a>`;
      }
      html += `</div></div>`;
    }

    document.getElementById('calc-results').innerHTML = html;
  }

  function findOtherChildren(slugA, slugB, excludeSlug) {
    const bpA = palBP[slugA], bpB = palBP[slugB];
    if (!bpA || !bpB) return [];

    const results = [];
    // Find Pals with BP close to bpB (to substitute parent A)
    const similarToB = bpSlugs
      .filter(s => s !== slugB && Math.abs((palBP[s] || 0) - bpB) <= 5)
      .slice(0, 5);
    for (const s of similarToB) {
      let childSlug = null, isSpec = false;
      for (const sc of specialCombos) {
        if ((sc.a === slugA && sc.b === s) || (sc.a === s && sc.b === slugA)) { childSlug = sc.c; isSpec = true; break; }
      }
      if (!childSlug) childSlug = findClosestBPSlug(Math.floor((bpA + (palBP[s] || 0)) / 2));
      if (childSlug !== excludeSlug && childSlug !== slugA && childSlug !== s && palByName[childSlug]) {
        results.push({ slug: childSlug, isSpecial: isSpec });
      }
    }

    return results.slice(0, 10);
  }

  function showError(msg) {
    document.getElementById('calc-results').innerHTML =
      `<div class="glass-panel" style="text-align:center;color:var(--color-danger);padding:var(--space-6)">${esc(msg)}</div>`;
  }

  function esc(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ---- Init ----
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
