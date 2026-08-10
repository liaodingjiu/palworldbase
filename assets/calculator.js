/**
 * calculator.js v5 — Click-Grid Breeding Calculator
 *
 * Unified interaction: Left panel = select, Right panel = result.
 * No mode switching. 1 Pal = breeding path, 2 Pals = child.
 */
(function () {
  'use strict';

  // ---- State ----
  var palBP = {}, bpSlugs = [], bpValues = [];
  var specialCombos = [], palByName = {};
  var reverseIndex = {};
  var bestPathCache = {};
  var palbox = new Set();
  var bpMode = 'simple';
  var gridData = [];

  var state = {
    slotA: null, slotB: null,
    mode: 'idle',
    resultType: null,
    activeFilter: 'all',
    searchQuery: '',
    currentTab: 'tab1',
  };

  var MAX_STEPS = 4, STARTER_BP = 1000;

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function imgFallback(slug) {
    return " onerror=\"this.src='/images/pals/" + slug + ".png'\"";
  }

  // ---- Data Loading ----
  async function init() {
    try {
      var gridScript = document.getElementById('calc-grid-data');
      if (gridScript) gridData = JSON.parse(gridScript.textContent);

      var results = await Promise.all([
        fetch('/data/calculator-data.json'),
        fetch('/data/pal-stats.json'),
      ]);
      var calcResp = results[0], statsResp = results[1];
      if (!calcResp.ok || !statsResp.ok) throw new Error('Data fetch failed');

      var calcData = await calcResp.json();
      var statsData = await statsResp.json();

      palBP = calcData.palBP;
      bpSlugs = calcData.bpSorted;
      bpValues = bpSlugs.map(function(s) { return palBP[s] || 0; });
      specialCombos = calcData.specialCombos;

      for (var i = 0; i < statsData.length; i++) {
        palByName[statsData[i].slug] = statsData[i];
      }
      for (var j = 0; j < gridData.length; j++) {
        var gp = palByName[gridData[j].slug];
        if (gp) { gridData[j].name = gp.name; gridData[j].tier = gp.tier || 'B'; }
      }


      // Filter out Pals without BP data (e.g. unreleased variants like faleris_noct, boltmane)
      var beforeFilter = gridData.length;
      gridData = gridData.filter(function(p) { return palBP[p.slug] !== undefined; });
      if (beforeFilter !== gridData.length) {
        console.warn('[v5] Filtered ' + (beforeFilter - gridData.length) + ' Pals without BP data');
      }
      console.log('[v5] ' + gridData.length + ' Pals, building index...');
      buildReverseIndex();
      precomputeBestPaths();
      loadPalbox();
      bpMode = getBPMode();

      console.log('[v5] Ready. Palbox: ' + palbox.size);
      setupDualState();
      renderGrid();
      updateEqStepGuide();
      setupEventListeners();
      updatePalboxUI();
      handleURLParams();
    } catch (err) {
      console.error('[v5] Init failed:', err);
      var res = document.getElementById('calc-result-primary');
      if (res) res.innerHTML = '<div style="text-align:center;color:var(--color-danger);padding:var(--space-6)">Failed to load data. Please refresh.</div>';
    }
  }

  // ---- Build Reverse Index ----
  function buildReverseIndex() {
    reverseIndex = {};
    var slugs = Object.keys(palBP);
    for (var i = 0; i < slugs.length; i++) {
      for (var j = i; j < slugs.length; j++) {
        var a = slugs[i], b = slugs[j];
        var bpA = palBP[a], bpB = palBP[b];
        if (bpA === undefined || bpB === undefined) continue;
        var childSlug = null, isSpecial = false;
        for (var k = 0; k < specialCombos.length; k++) {
          var sc = specialCombos[k];
          if ((sc.a === a && sc.b === b) || (sc.a === b && sc.b === a)) {
            childSlug = sc.c; isSpecial = true; break;
          }
        }
        if (!childSlug) childSlug = findClosestBPSlug(Math.floor((bpA + bpB) / 2));
        if (!reverseIndex[childSlug]) reverseIndex[childSlug] = [];
        reverseIndex[childSlug].push({
          parent1: a, parent2: b, parent1BP: bpA, parent2BP: bpB, isSpecial: isSpecial
        });
      }
    }
    var riKeys = Object.keys(reverseIndex);
    for (var ri = 0; ri < riKeys.length; ri++) {
      var pairs = reverseIndex[riKeys[ri]];
      pairs.sort(function(x, y) {
        if (x.isSpecial !== y.isSpecial) return x.isSpecial ? -1 : 1;
        return (y.parent1BP + y.parent2BP) - (x.parent1BP + x.parent2BP);
      });
      reverseIndex[riKeys[ri]] = pairs.slice(0, 30);
    }
  }

  // ---- BFS ----
  function precomputeBestPaths() {
    bestPathCache = {};
    var visited = {}, queue = [];
    var bpKeys = Object.keys(palBP);
    for (var i = 0; i < bpKeys.length; i++) {
      var slug = bpKeys[i], bp = palBP[slug];
      if (bp >= STARTER_BP || slug === 'chikipi' || slug === 'lamball' || slug === 'cattiva' || slug === 'teafant') {
        bestPathCache[slug] = { steps: 0, chain: [], isStarter: true };
        visited[slug] = true;
        queue.push(slug);
      }
    }
    var head = 0;
    while (head < queue.length) {
      var parent = queue[head++];
      var parentDist = bestPathCache[parent].steps;
      if (parentDist >= MAX_STEPS) continue;
      var bpP = palBP[parent];
      if (bpP === undefined) continue;
      var otherKeys = Object.keys(palBP);
      for (var oi = 0; oi < otherKeys.length; oi++) {
        var other = otherKeys[oi];
        if (other === parent) continue;
        var bpO = palBP[other];
        if (bpO === undefined) continue;
        var child = null, isSpec = false;
        for (var si = 0; si < specialCombos.length; si++) {
          var sc = specialCombos[si];
          if ((sc.a === parent && sc.b === other) || (sc.a === other && sc.b === parent)) {
            child = sc.c; isSpec = true; break;
          }
        }
        if (!child) child = findClosestBPSlug(Math.floor((bpP + bpO) / 2));
        if (visited[child]) continue;
        bestPathCache[child] = {
          steps: parentDist + 1,
          chain: [{ parent1: parent, parent2: other, child: child, isSpecial: isSpec, parent1BP: bpP, parent2BP: bpO }],
          isStarter: false,
        };
        visited[child] = true;
        queue.push(child);
      }
    }
    console.log('[v5] BFS: ' + Object.keys(bestPathCache).length + ' reachable.');
  }

  function findClosestBPSlug(targetBP) {
    var lo = 0, hi = bpSlugs.length - 1;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (bpValues[mid] < targetBP) lo = mid + 1; else hi = mid; }
    var best = lo, bestDist = Math.abs(bpValues[lo] - targetBP);
    if (lo > 0 && Math.abs(bpValues[lo - 1] - targetBP) < bestDist) best = lo - 1;
    return bpSlugs[best];
  }

  function getBestPath(targetSlug) {
    var cached = bestPathCache[targetSlug];
    if (!cached) return null;
    if (cached.isStarter) return { steps: 0, chain: [], isStarter: true };
    var fullChain = [], current = targetSlug, seen = {};
    for (var step = 0; step < MAX_STEPS && !seen[current]; step++) {
      seen[current] = true;
      var cp = bestPathCache[current];
      if (!cp || cp.isStarter) break;
      var pairs = reverseIndex[current] || [];
      var bestPair = null, bestScore = Infinity;
      for (var i = 0; i < pairs.length; i++) {
        var p = pairs[i];
        var d1 = bestPathCache[p.parent1], d2 = bestPathCache[p.parent2];
        var score = (p.isSpecial ? -1000 : 0) + ((d1 ? d1.steps : 99) + (d2 ? d2.steps : 99)) * 100 - (p.parent1BP + p.parent2BP);
        if (score < bestScore) { bestScore = score; bestPair = p; }
      }
      if (!bestPair) break;
      fullChain.push({
        parent1: bestPair.parent1, parent2: bestPair.parent2,
        child: current, isSpecial: bestPair.isSpecial,
        parent1BP: bestPair.parent1BP, parent2BP: bestPair.parent2BP,
      });
      var bd1 = bestPathCache[bestPair.parent1], bd2 = bestPathCache[bestPair.parent2];
      current = (!bd1 || bd1.isStarter) ? bestPair.parent2 :
                (!bd2 || bd2.isStarter) ? bestPair.parent1 :
                (palBP[bestPair.parent1] <= palBP[bestPair.parent2]) ? bestPair.parent1 : bestPair.parent2;
    }
    return { steps: fullChain.length, chain: fullChain.reverse(), isStarter: false };
  }

  // ---- Visit Count ----
  function getVisitCount() {
    try { return parseInt(localStorage.getItem('pb_visit_count'), 10) || 0; } catch (e) { return 0; }
  }
  function incrementVisit() {
    var c = getVisitCount() + 1;
    try { localStorage.setItem('pb_visit_count', c.toString()); } catch (e) {}
    return c;
  }

  // ---- Palbox ----
  function loadPalbox() {
    try { var r = localStorage.getItem('palworld_palbox'); if (r) palbox = new Set(JSON.parse(r)); }
    catch (e) { palbox = new Set(); }
  }
  function savePalbox() {
    try { localStorage.setItem('palworld_palbox', JSON.stringify(Array.from(palbox))); } catch (e) {}
    updatePalboxUI();
  }
  function togglePalbox(slug) {
    if (palbox.has(slug)) palbox.delete(slug); else palbox.add(slug);
    savePalbox();
    if (state.activeFilter === 'palbox') renderGrid();
  }
  function updatePalboxUI() {
    var countEls = document.querySelectorAll('#calc-filter-palbox-count, #calc-palbox-count-float');
    for (var i = 0; i < countEls.length; i++) countEls[i].textContent = palbox.size;
    var pf = document.getElementById('calc-filter-palbox');
    if (pf) pf.style.display = palbox.size > 0 ? '' : 'none';
    var list = document.getElementById('calc-palbox-list');
    if (list) {
      if (palbox.size === 0) {
        list.innerHTML = '<span style="font-size:0.75rem;color:var(--color-text-muted)">No Pals added yet.</span>';
      } else {
        var slugs = Array.from(palbox);
        list.innerHTML = '';
        for (var j = 0; j < slugs.length; j++) {
          (function(slug) {
            var p = palByName[slug]; if (!p) return;
            var chip = document.createElement('span');
            chip.className = 'palbox-chip';
            chip.setAttribute('data-slug', slug);
            chip.innerHTML = esc(p.name) + ' <span class="palbox-remove" data-slug="' + slug + '">×</span>';
            chip.querySelector('.palbox-remove').addEventListener('click', function(e) {
              e.stopPropagation();
              togglePalbox(slug);
              rerenderCurrentResult();
            });
            list.appendChild(chip);
          })(slugs[j]);
        }
      }
    }
    var breedBtn = document.getElementById('calc-palbox-what-can-breed');
    if (breedBtn) {
      if (palbox.size >= 2) { breedBtn.disabled = false; breedBtn.textContent = '🧬 See what I can breed from my Palbox'; }
      else { breedBtn.disabled = true; breedBtn.textContent = '🔒 Add 2+ Pals to see what you can breed'; }
    }
  }

  function rerenderCurrentResult() {
    if (state.mode === 'showing-result') {
      if (state.resultType === 'path' && state.slotA) renderPathResult(state.slotA);
      else if (state.resultType === 'child' && state.slotA && state.slotB) renderChildResult(state.slotA, state.slotB);
    }
  }

  // ---- BP Mode ----
  function getBPMode() { try { return localStorage.getItem('pb_bp_mode') || 'simple'; } catch (e) { return 'simple'; } }
  function setBPMode(mode) {
    bpMode = mode;
    try { localStorage.setItem('pb_bp_mode', mode); } catch (e) {}
    rerenderCurrentResult();
  }
  function getBPRowText(step, mode) {
    var bpA = step.parent1BP || palBP[step.parent1] || '?';
    var bpB = step.parent2BP || palBP[step.parent2] || '?';
    if (bpA === '?' || bpB === '?') return 'BP data unavailable';
    var avg = Math.floor((bpA + bpB) / 2);
    var childBP = palBP[step.child] || '?';
    if (mode === 'formula') {
      return '⌊(' + bpA + ' + ' + bpB + ') ÷ 2⌋ = ' + avg + ' → nearest: ' + step.child + ' (BP ' + childBP + ')';
    }
    var a = palByName[step.parent1], b = palByName[step.parent2];
    return (a ? a.name : step.parent1) + ' (BP ' + bpA + ') + ' + (b ? b.name : step.parent2) + ' (BP ' + bpB + ') → avg = ' + avg + ' → nearest ' + childBP + ' → ' + step.child;
  }

  // ---- Pair Difficulty ----
  function getPairDifficulty(slugA, slugB) {
    if (palbox.has(slugA) && palbox.has(slugB)) return 'owned';
    if (palbox.has(slugA) || palbox.has(slugB)) return 'easy';
    var a = palByName[slugA], b = palByName[slugB];
    function isWild(pal) {
      if (!pal) return true;
      var h = (pal.acquisition && pal.acquisition.habitats) ? pal.acquisition.habitats : [];
      var c = pal.acquisition && pal.acquisition.isCatchable !== undefined ? pal.acquisition.isCatchable : true;
      return c && h.length > 0;
    }
    var aW = isWild(a), bW = isWild(b);
    if (aW && bW) return 'easy';
    if (aW || bW) return 'medium';
    return 'hard';
  }
  function getDifficultyLabel(d) {
    switch (d) { case 'owned': return '👑 Owned'; case 'easy': return '⭐ Easy'; case 'medium': return '⚡ Medium'; case 'hard': return '🔥 Hard'; default: return ''; }
  }

  // ---- Search History ----
  function getSearchHistory() {
    try { return JSON.parse(localStorage.getItem('pb_search_history') || '[]'); } catch (e) { return []; }
  }
  function addSearchHistory(slug) {
    var h = getSearchHistory().filter(function(s) { return s !== slug; });
    h.unshift(slug);
    try { localStorage.setItem('pb_search_history', JSON.stringify(h.slice(0, 8))); } catch (e) {}
  }

  // ---- Find Child ----
  function findChild(slugA, slugB) {
    for (var i = 0; i < specialCombos.length; i++) {
      var sc = specialCombos[i];
      if ((sc.a === slugA && sc.b === slugB) || (sc.a === slugB && sc.b === slugA)) {
        return { child: sc.c, isSpecial: true };
      }
    }
    var bpA = palBP[slugA], bpB = palBP[slugB];
    if (bpA === undefined || bpB === undefined) return null;
    return { child: findClosestBPSlug(Math.floor((bpA + bpB) / 2)), isSpecial: false };
  }

  function isWildCatchable(slug) {
    var p = palByName[slug]; if (!p) return true;
    var h = (p.acquisition && p.acquisition.habitats) ? p.acquisition.habitats : [];
    var c = p.acquisition && p.acquisition.isCatchable !== undefined ? p.acquisition.isCatchable : true;
    return c && h.length > 0;
  }

  function computePalboxChildren() {
    var slugs = Array.from(palbox), results = [], seen = {};
    for (var i = 0; i < slugs.length; i++) {
      for (var j = i; j < slugs.length; j++) {
        var r = findChild(slugs[i], slugs[j]);
        if (r && !seen[r.child]) {
          seen[r.child] = true;
          var pal = palByName[r.child];
          results.push({ slug: r.child, name: pal ? pal.name : r.child, tier: pal ? (pal.tier || 'B') : 'B', isSpecial: r.isSpecial });
        }
      }
    }
    results.sort(function(a, b) { var o = { S: 0, A: 1, B: 2 }; return (o[a.tier] || 2) - (o[b.tier] || 2); });
    return results;
  }

  // ================================================================
  //  DUAL-STATE
  // ================================================================
  function setupDualState() {
    var count = incrementVisit();
    var isFirst = count <= 2;
    var emptyText = document.getElementById('calc-empty-text');
    if (isFirst) {
      state.activeFilter = 'all';
      if (emptyText) emptyText.innerHTML = '<strong>Pick a Pal</strong> from the grid to see its breeding path,<br>or <strong>pick two</strong> to see what they produce.';
    } else {
      state.activeFilter = palbox.size >= 2 ? 'palbox' : 'all';
      if (emptyText) emptyText.innerHTML = 'Select a Pal to see its breeding path,<br>or select two to see what they produce.';
    }
    updateFilterChips();
  }

  // ================================================================
  //  GRID
  // ================================================================
  function renderGrid() {
    var grid = document.getElementById('calc-grid');
    if (!grid) return;
    var pals = gridData.slice();

    if (state.activeFilter === 'palbox') {
      pals = pals.filter(function(p) { return palbox.has(p.slug); });
    } else if (state.activeFilter !== 'all') {
      pals = pals.filter(function(p) { return p.elements.indexOf(state.activeFilter) !== -1; });
    }
    if (state.searchQuery) {
      var q = state.searchQuery.toLowerCase();
      pals = pals.filter(function(p) {
        return p.name.toLowerCase().indexOf(q) !== -1 || String(p.number).indexOf(q) !== -1 || p.slug.indexOf(q) !== -1;
      });
    }

    pals.sort(function(a, b) {
      var aSel = (a.slug === state.slotA || a.slug === state.slotB) ? -1 : 1;
      var bSel = (b.slug === state.slotA || b.slug === state.slotB) ? -1 : 1;
      return aSel - bSel || a.number - b.number;
    });

    var html = '';
    for (var i = 0; i < pals.length; i++) {
      var p = pals[i];
      var selClass = '';
      if (p.slug === state.slotA) selClass = ' selected-a';
      else if (p.slug === state.slotB) selClass = ' selected-b';
      html += '<div class="calc-grid-card ' + p.element + selClass + '" data-slug="' + p.slug + '" role="button" tabindex="0" title="' + esc(p.name) + ' #' + p.number + '">' +
        '<img src="/images/pals/' + p.slug + '.webp" alt="' + esc(p.name) + '" class="calc-grid-card-img" loading="lazy"' + imgFallback(p.slug) + '>' +
        '<span class="calc-grid-card-name">' + esc(p.name) + '</span>' +
        '<span class="calc-grid-card-bp">#' + p.number + ' · BP' + (p.bp || '?') + '</span>' +
        '</div>';
    }
    if (pals.length === 0) {
      html = '<div style="grid-column:1/-1;text-align:center;padding:var(--space-6);color:var(--color-text-muted);font-size:0.875rem">No Pals match. Try a different filter.</div>';
    }
    grid.innerHTML = html;
  }

  // ================================================================
  //  SLOTS
  // ================================================================
  function selectPal(slug) {
    if (state.mode === 'showing-result') { state.mode = 'idle'; state.resultType = null; hideResult(); }
    if (state.slotA === slug) { state.slotA = null; }
    else if (state.slotB === slug) { state.slotB = null; }
    else if (!state.slotA) { state.slotA = slug; addSearchHistory(slug); }
    else if (!state.slotB && slug !== state.slotA) { state.slotB = slug; addSearchHistory(slug); }
    else if (slug !== state.slotA && slug !== state.slotB) { state.slotB = slug; addSearchHistory(slug); }

    if (state.slotA && state.slotB) state.mode = 'two-selected';
    else if (state.slotA) state.mode = 'one-selected';
    else state.mode = 'idle';

    updateEquation(); updateEqStepGuide(); renderGrid();

    // Auto-trigger result
    if (state.slotA && state.slotB) {
      breedThem();
    } else if (state.slotA) {
      showBreedingPath();
    } else {
      hideResult(); updateRightPanel();
    }
  }

  function clearSlot(key) {
    if (key === 'a') { state.slotA = state.slotB; state.slotB = null; }
    else { state.slotB = null; }
    state.mode = state.slotA ? (state.slotB ? 'two-selected' : 'one-selected') : 'idle';
    state.resultType = null;
    updateEquation(); updateEqStepGuide(); renderGrid();

    // Auto-update result
    if (state.slotA && state.slotB) {
      breedThem();
    } else if (state.slotA) {
      showBreedingPath();
    } else {
      hideResult(); updateRightPanel();
    }
  }

  function updateEquation() {
    updateEqCard('a', state.slotA);
    updateEqCard('b', state.slotB);
    // Card C updated by renderChildResult / renderPathResult
    if (!state.slotA && !state.slotB) updateEqCard('c', null);
  }

  function updateEqCard(key, slug) {
    var card = document.getElementById('calc-eq-card-' + key);
    if (!card) return;
    var ph = card.querySelector('.calc-eq-placeholder');
    var fl = card.querySelector('.calc-eq-filled');
    card.classList.remove('active-step');
    if (slug) {
      var p = findGridPal(slug);
      card.classList.add('filled');
      if (ph) ph.style.display = 'none';
      if (fl) {
        fl.style.display = '';
        fl.querySelector('.calc-eq-img').src = '/images/pals/' + slug + '.webp';
        fl.querySelector('.calc-eq-img').alt = p ? p.name : slug;
        fl.querySelector('.calc-eq-name').textContent = p ? p.name : slug;
        fl.querySelector('.calc-eq-meta').textContent = p ? ('#' + p.number + ' \u00b7 BP' + (p.bp || '?')) : '';
      }
      // Update label
      var lbl = card.querySelector('.calc-eq-label');
      if (lbl) lbl.textContent = key === 'a' ? '\u2713 Parent A' : (key === 'b' ? '\u2713 Parent B' : '\ud83c\udf89 Child');
    } else {
      card.classList.remove('filled');
      if (ph) ph.style.display = '';
      if (fl) fl.style.display = 'none';
      var lbl2 = card.querySelector('.calc-eq-label');
      if (lbl2) lbl2.textContent = key === 'a' ? 'Parent A' : (key === 'b' ? 'Parent B' : 'Child');
    }
  }

  function updateEqStepGuide() {
    var cardA = document.getElementById('calc-eq-card-a');
    var cardB = document.getElementById('calc-eq-card-b');
    var swapBtn = document.getElementById('calc-eq-swap');
    if (!cardA || !cardB) return;

    cardA.classList.remove('active-step');
    cardB.classList.remove('active-step');
    if (swapBtn) swapBtn.style.display = 'none';

    function setHint(card, text) {
      if (!card) return;
      var h = card.querySelector('.calc-eq-hint');
      if (h) h.textContent = text;
    }
    function setLabel(card, text) {
      if (!card) return;
      var l = card.querySelector('.calc-eq-label');
      if (l) l.textContent = text;
    }

    if (!state.slotA && !state.slotB) {
      cardA.classList.add('active-step');
      setHint(cardA, 'Click a Pal \u2193');
      setLabel(cardA, 'Step 1 \u2014 Pick a Pal');
      setLabel(cardB, 'Step 2');
    } else if (state.slotA && !state.slotB) {
      cardB.classList.add('active-step');
      setHint(cardB, 'Click another \u2193');
      setLabel(cardB, 'Step 2 \u2014 Pick another');
      // A is already filled (updateEqCard sets label)
    } else {
      // Both filled — swap button
      if (swapBtn) swapBtn.style.display = '';
    }
  }

  function findGridPal(slug) {
    for (var i = 0; i < gridData.length; i++) { if (gridData[i].slug === slug) return gridData[i]; }
    return null;
  }

  // ================================================================
  //  ACTIONS
  // ================================================================
  function swapSlots() {
    if (!state.slotA || !state.slotB) return;
    var tmp = state.slotA; state.slotA = state.slotB; state.slotB = tmp;
    updateEquation(); updateEqStepGuide(); renderGrid();
    breedThem();
  }

  function showBreedingPath() {
    if (!state.slotA) return;
    state.mode = 'showing-result'; state.resultType = 'path'; state.currentTab = 'tab1';
    renderPathResult(state.slotA); updateRightPanel(); updateEqCard('c', state.slotA); updateEqStepGuide();
  }
  function breedThem() {
    if (!state.slotA || !state.slotB) return;
    state.mode = 'showing-result'; state.resultType = 'child'; state.currentTab = 'tab1';
    // Update child in equation bar
    var result = findChild(state.slotA, state.slotB);
    if (result) updateEqCard('c', result.child);
    renderChildResult(state.slotA, state.slotB); updateRightPanel(); updateEqStepGuide();
  }

  // ================================================================
  //  RIGHT PANEL
  // ================================================================
  function updateRightPanel() {
    var empty = document.getElementById('calc-empty');
    var result = document.getElementById('calc-result');
    if (state.mode === 'showing-result') { if (empty) empty.style.display = 'none'; if (result) result.style.display = ''; }
    else { if (empty) empty.style.display = ''; if (result) result.style.display = 'none'; }
  }
  function hideResult() {
    var empty = document.getElementById('calc-empty'), result = document.getElementById('calc-result');
    if (empty) empty.style.display = '';
    if (result) result.style.display = 'none';
    updateEqCard('c', null);
  }

  // ================================================================
  //  PATH RESULT
  // ================================================================
  function renderPathResult(slug) {
    var header = document.getElementById('calc-result-header');
    var primary = document.getElementById('calc-result-primary');
    var tabs = document.getElementById('calc-result-tabs');
    var secondary = document.getElementById('calc-result-secondary');

    var p = palByName[slug], bp = palBP[slug];
    var el = (p && p.elements && p.elements[0]) ? p.elements[0].toLowerCase() : 'neutral';
    var inBox = palbox.has(slug);

    if (header) {
      header.innerHTML = '<div style="display:flex;align-items:center;gap:var(--space-3)">' +
        '<img src="/images/pals/' + slug + '.webp" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--color-element-' + el + ')"' + imgFallback(slug) + '>' +
        '<div style="flex:1"><div style="font-family:var(--font-display);font-size:1.125rem;font-weight:700">' + esc(p ? p.name : slug) + '</div>' +
        '<div style="font-size:0.75rem;color:var(--color-text-muted)">#' + (p ? p.number : '?') + ' · ' + el.charAt(0).toUpperCase() + el.slice(1) + ' · BP ' + (bp || '?') + '</div></div>' +
        '<button class="calc-filter-chip" id="calc-palbox-toggle-header" style="font-size:0.75rem">' + (inBox ? '📦 Remove from Box' : '📦 Add to Box') + '</button></div>';
      setTimeout(function() {
        var btn = document.getElementById('calc-palbox-toggle-header');
        if (btn) btn.addEventListener('click', function() { togglePalbox(slug); renderPathResult(slug); renderGrid(); });
      }, 0);
    }

    var path = getBestPath(slug);
    if (primary) {
      if (!path || path.isStarter) {
        primary.innerHTML = '<div class="calc-timeline"><div class="calc-timeline-target" style="padding:var(--space-4);background:var(--color-bg-glass);border:1px solid var(--color-border);border-radius:var(--radius-md);text-align:center">' +
          '<img src="/images/pals/' + slug + '.webp" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid var(--color-accent);box-shadow:0 0 20px rgba(0,212,255,0.3)"' + imgFallback(slug) + '>' +
          '<div style="font-family:var(--font-display);font-size:1.125rem;font-weight:700;margin-top:var(--space-2)">' + esc(p ? p.name : slug) + '</div>' +
          '<div style="font-size:0.8125rem;color:var(--color-text-muted)">🎉 This is a starter Pal — catch it in the wild!</div></div></div>';
      } else if (path.chain.length === 0) {
        primary.innerHTML = '<div class="calc-timeline"><div class="calc-timeline-target" style="padding:var(--space-4);background:var(--color-bg-glass);border:1px solid var(--color-border);border-radius:var(--radius-md);text-align:center">' +
          '<img src="/images/pals/' + slug + '.webp" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid var(--color-accent);box-shadow:0 0 20px rgba(0,212,255,0.3)"' + imgFallback(slug) + '>' +
          '<div style="font-family:var(--font-display);font-size:1.125rem;font-weight:700;margin-top:var(--space-2)">' + esc(p ? p.name : slug) + '</div>' +
          '<div style="font-size:0.8125rem;color:var(--color-text-muted)">⚠ No breeding path found within ' + MAX_STEPS + ' steps.</div></div></div>';
      } else {
        var html = '<div class="calc-timeline">';
        for (var i = 0; i < path.chain.length; i++) {
          html += renderTimelineStep(path.chain[i], i + 1);
        }
        html += '<div class="calc-timeline-step calc-timeline-target" style="--step-accent: var(--color-element-' + el + ')">' +
          '<span class="calc-timeline-step-num" style="background:var(--color-accent)">⭐</span>' +
          '<div style="display:flex;align-items:center;gap:var(--space-3)">' +
          '<img src="/images/pals/' + slug + '.webp" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--color-accent)"' + imgFallback(slug) + '>' +
          '<div><div style="font-family:var(--font-display);font-size:1rem;font-weight:700;color:var(--color-accent)">🎯 ' + esc(p ? p.name : slug) + '</div>' +
          '<div style="font-size:0.6875rem;color:var(--color-text-muted)">#' + (p ? p.number : '?') + ' · ' + el.charAt(0).toUpperCase() + el.slice(1) + ' · BP ' + (bp || '?') + '</div></div></div></div>';
        html += '</div>';
        primary.innerHTML = html;
        setTimeout(bindBPToggleEvents, 0);
      }
    }

    if (tabs && secondary) {
      var allPairs = reverseIndex[slug] || [];
      tabs.style.display = '';
      tabs.innerHTML = '<button class="calc-result-tab active" data-tab="tab1">📋 All ' + allPairs.length + ' Parent Pairs</button>' +
        '<button class="calc-result-tab" data-tab="tab2">🔮 What\'s Next?</button>';
      secondary.innerHTML = renderAllPairsContent(slug, allPairs);
      setTimeout(function() { bindTabEvents(slug); }, 0);
    }
  }

  function renderTimelineStep(step, num) {
    var a = palByName[step.parent1], b = palByName[step.parent2];
    var child = palByName[step.child];
    var el = (a && a.elements && a.elements[0]) ? a.elements[0].toLowerCase() : 'neutral';
    var aOwned = palbox.has(step.parent1), bOwned = palbox.has(step.parent2);
    var aWild = isWildCatchable(step.parent1), bWild = isWildCatchable(step.parent2);

    return '<div class="calc-timeline-step" style="--step-accent: var(--color-element-' + el + ')">' +
      '<span class="calc-timeline-step-num">' + num + '</span>' +
      '<div class="calc-step-parents">' +
      '<a href="/pals/' + step.parent1 + '/"><img src="/images/pals/' + step.parent1 + '.webp" class="calc-step-parent-img" alt=""' + imgFallback(step.parent1) + '></a>' +
      '<div><a href="/pals/' + step.parent1 + '/">' + esc(a ? a.name : step.parent1) + '</a>' +
      '<span class="calc-ownership-tag ' + (aOwned ? 'owned' : (aWild ? 'wild' : 'needs-breed')) + '">' + (aOwned ? '✅ Owned' : (aWild ? '🌿 Wild' : '⚠ Needs breed')) + '</span></div>' +
      '<span style="color:var(--color-accent);font-weight:700;margin:0 4px">+</span>' +
      '<a href="/pals/' + step.parent2 + '/"><img src="/images/pals/' + step.parent2 + '.webp" class="calc-step-parent-img" alt=""' + imgFallback(step.parent2) + '></a>' +
      '<div><a href="/pals/' + step.parent2 + '/">' + esc(b ? b.name : step.parent2) + '</a>' +
      '<span class="calc-ownership-tag ' + (bOwned ? 'owned' : (bWild ? 'wild' : 'needs-breed')) + '">' + (bOwned ? '✅ Owned' : (bWild ? '🌿 Wild' : '⚠ Needs breed')) + '</span></div>' +
      '</div>' +
      '<div class="calc-step-arrow">┃ ▼ Breed → Hatch</div>' +
      '<div class="calc-bp-row">' + getBPRowText(step, bpMode) +
      '<span class="calc-bp-toggle"><button class="' + (bpMode === 'simple' ? 'active' : '') + '" data-bp-mode="simple">🐣 Simple</button>' +
      '<button class="' + (bpMode === 'formula' ? 'active' : '') + '" data-bp-mode="formula">🧮 Formula</button></span></div>' +
      '<div class="calc-step-child">' +
      '<img src="/images/pals/' + step.child + '.webp" class="calc-step-parent-img" alt=""' + imgFallback(step.child) + '>' +
      '<span style="font-weight:600">' + esc(child ? child.name : step.child) + '</span>' +
      (step.isSpecial ? '<span style="font-size:0.6875rem;color:var(--color-accent);background:rgba(0,212,255,0.1);padding:1px 6px;border-radius:999px">⭐ Special</span>' : '') +
      '</div></div>';
  }

  function renderAllPairsContent(slug, pairs) {
    if (!pairs || pairs.length === 0) return '<div style="text-align:center;padding:var(--space-4);color:var(--color-text-muted)">No parent pairs found.</div>';
    var sorted = pairs.slice().sort(function(a, b) {
      var o = { owned: 0, easy: 1, medium: 2, hard: 3 };
      return (o[getPairDifficulty(a.parent1, a.parent2)] || 4) - (o[getPairDifficulty(b.parent1, b.parent2)] || 4);
    });
    var html = '<div class="calc-pairs-list">';
    for (var i = 0; i < Math.min(sorted.length, 50); i++) {
      var pair = sorted[i], diff = getPairDifficulty(pair.parent1, pair.parent2);
      var aN = palByName[pair.parent1], bN = palByName[pair.parent2];
      html += '<div class="calc-pair-row">' +
        '<img src="/images/pals/' + pair.parent1 + '.webp" class="calc-pair-img" alt=""' + imgFallback(pair.parent1) + '>' +
        '<span>' + esc(aN ? aN.name : pair.parent1) + '</span><span class="calc-pair-arrow">+</span>' +
        '<img src="/images/pals/' + pair.parent2 + '.webp" class="calc-pair-img" alt=""' + imgFallback(pair.parent2) + '>' +
        '<span>' + esc(bN ? bN.name : pair.parent2) + '</span>' +
        '<span class="calc-difficulty-tag ' + diff + '">' + getDifficultyLabel(diff) + '</span>' +
        (pair.isSpecial ? '<span style="font-size:0.625rem;color:var(--color-accent)">⭐ Special</span>' : '') + '</div>';
    }
    return html + '</div>';
  }

  function renderWhatsNextContent(slug) {
    var children = [], riKeys = Object.keys(reverseIndex);
    for (var i = 0; i < riKeys.length; i++) {
      var pairs = reverseIndex[riKeys[i]];
      for (var j = 0; j < pairs.length; j++) {
        if (pairs[j].parent1 === slug || pairs[j].parent2 === slug) {
          children.push({
            child: riKeys[i],
            otherParent: pairs[j].parent1 === slug ? pairs[j].parent2 : pairs[j].parent1,
            isSpecial: pairs[j].isSpecial,
          });
        }
      }
    }
    var seen = {}, unique = [];
    for (var k = 0; k < children.length; k++) {
      if (!seen[children[k].child]) { seen[children[k].child] = true; unique.push(children[k]); }
    }
    unique = unique.slice(0, 12);
    if (unique.length === 0) return '<div style="text-align:center;padding:var(--space-4);color:var(--color-text-muted)">No breeding options found.</div>';

    var html = '<div class="calc-pairs-list">';
    for (var u = 0; u < unique.length; u++) {
      var item = unique[u], cP = palByName[item.child], oP = palByName[item.otherParent];
      html += '<div class="calc-pair-row" style="cursor:pointer" data-child="' + item.child + '" data-other="' + item.otherParent + '">' +
        '<span style="font-size:0.75rem;color:var(--color-text-muted)">+</span>' +
        '<img src="/images/pals/' + item.otherParent + '.webp" class="calc-pair-img" alt=""' + imgFallback(item.otherParent) + '>' +
        '<span>' + esc(oP ? oP.name : item.otherParent) + '</span><span class="calc-pair-arrow">→</span>' +
        '<img src="/images/pals/' + item.child + '.webp" class="calc-pair-img" alt=""' + imgFallback(item.child) + '>' +
        '<span style="font-weight:600">' + esc(cP ? cP.name : item.child) + '</span>' +
        (item.isSpecial ? '<span style="font-size:0.625rem;color:var(--color-accent)">⭐ Special</span>' : '') + '</div>';
    }
    html += '</div>';

    setTimeout(function() {
      var rows = document.querySelectorAll('.calc-pair-row[data-child]');
      for (var r = 0; r < rows.length; r++) {
        (function(row) {
          row.addEventListener('click', function() {
            state.slotA = state.slotA || slug;
            state.slotB = row.getAttribute('data-other');
            updateEquation(); updateEqStepGuide(); renderGrid();
            breedThem();
          });
        })(rows[r]);
      }
    }, 0);
    return html;
  }

  function bindTabEvents(slug) {
    var btns = document.querySelectorAll('.calc-result-tab');
    for (var i = 0; i < btns.length; i++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          var all = document.querySelectorAll('.calc-result-tab');
          for (var j = 0; j < all.length; j++) all[j].classList.remove('active');
          btn.classList.add('active');
          state.currentTab = btn.getAttribute('data-tab');
          var sec = document.getElementById('calc-result-secondary');
          if (state.currentTab === 'tab1') {
            if (sec) sec.innerHTML = renderAllPairsContent(slug, reverseIndex[slug] || []);
          } else if (state.currentTab === 'tab2') {
            if (sec) sec.innerHTML = renderWhatsNextContent(slug);
          }
        });
      })(btns[i]);
    }
  }

  function bindBPToggleEvents() {
    var btns = document.querySelectorAll('.calc-bp-toggle button');
    for (var i = 0; i < btns.length; i++) {
      (function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var mode = btn.getAttribute('data-bp-mode');
          if (mode) setBPMode(mode);
        });
      })(btns[i]);
    }
  }

  // ================================================================
  //  CHILD RESULT
  // ================================================================
  function renderChildResult(slugA, slugB) {
    var header = document.getElementById('calc-result-header');
    var primary = document.getElementById('calc-result-primary');
    var tabs = document.getElementById('calc-result-tabs');
    var secondary = document.getElementById('calc-result-secondary');

    var result = findChild(slugA, slugB);
    if (!result) { if (primary) primary.innerHTML = '<div style="text-align:center;padding:var(--space-4);color:var(--color-danger)">Could not determine child.</div>'; return; }

    var childPal = palByName[result.child], childBP = palBP[result.child];
    var childEl = (childPal && childPal.elements && childPal.elements[0]) ? childPal.elements[0].toLowerCase() : 'neutral';
    var aPal = palByName[slugA], bPal = palByName[slugB];
    var aName = aPal ? aPal.name : slugA, bName = bPal ? bPal.name : slugB;
    var bpA = palBP[slugA] || '?', bpB = palBP[slugB] || '?';
    var avgBP = (bpA !== '?' && bpB !== '?') ? Math.floor((bpA + bpB) / 2) : '?';

    if (header) {
      header.innerHTML = '<div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;font-size:0.875rem">' +
        '<img src="/images/pals/' + slugA + '.webp" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid var(--color-accent)"' + imgFallback(slugA) + '>' +
        '<span style="font-weight:600">' + esc(aName) + '</span>' +
        '<span style="color:var(--color-accent);font-weight:700">✕</span>' +
        '<img src="/images/pals/' + slugB + '.webp" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid #34d399"' + imgFallback(slugB) + '>' +
        '<span style="font-weight:600">' + esc(bName) + '</span></div>';
    }

    if (primary) {
      primary.innerHTML = '<div class="calc-child-card">' +
        '<img src="/images/pals/' + result.child + '.webp" alt="" class="calc-child-card-img"' + imgFallback(result.child) + '>' +
        '<div class="calc-child-card-name">' + esc(childPal ? childPal.name : result.child) + '</div>' +
        '<div class="calc-child-card-meta">#' + (childPal ? childPal.number : '?') + ' · ' + childEl.charAt(0).toUpperCase() + childEl.slice(1) + ' · BP ' + (childBP || '?') + '</div>' +
        (result.isSpecial ? '<div style="display:inline-block;font-size:0.75rem;color:var(--color-accent);background:rgba(0,212,255,0.1);padding:2px 10px;border-radius:999px;margin-bottom:var(--space-2)">⭐ Special Combo</div>' : '') +
        '<div class="calc-child-card-parents">⌊(' + esc(aName) + ' BP ' + bpA + ' + ' + esc(bName) + ' BP ' + bpB + ') ÷ 2⌋ = ' + avgBP + ' → nearest: ' + esc(childPal ? childPal.name : result.child) + '</div>' +
        '</div>';
    }

    if (tabs && secondary) {
      tabs.style.display = '';
      tabs.innerHTML = '<button class="calc-result-tab active" data-tab="tab1">🔀 Alternative Children</button>' +
        '<button class="calc-result-tab" data-tab="tab2">📋 How to breed ' + esc(childPal ? childPal.name : result.child) + '?</button>';
      secondary.innerHTML = renderAltChildrenContent(slugA, slugB, result.child);

      setTimeout(function() {
        var tabBtns = document.querySelectorAll('.calc-result-tab');
        for (var i = 0; i < tabBtns.length; i++) {
          (function(btn) {
            btn.addEventListener('click', function() {
              var all = document.querySelectorAll('.calc-result-tab');
              for (var j = 0; j < all.length; j++) all[j].classList.remove('active');
              btn.classList.add('active');
              state.currentTab = btn.getAttribute('data-tab');
              if (state.currentTab === 'tab1') {
                if (secondary) secondary.innerHTML = renderAltChildrenContent(slugA, slugB, result.child);
              } else if (state.currentTab === 'tab2') {
                state.slotA = result.child; state.slotB = null;
                state.mode = 'one-selected'; state.resultType = 'path';
                updateEquation(); updateEqStepGuide(); renderGrid();
                renderPathResult(result.child); updateRightPanel(); updateEqCard('c', result.child);
              }
            });
          })(tabBtns[i]);
        }
      }, 0);
    }
  }

  function renderAltChildrenContent(slugA, slugB, currentChild) {
    var alternatives = [], allSlugs = Object.keys(palBP);

    for (var i = 0; i < allSlugs.length; i++) {
      if (allSlugs[i] === slugA || allSlugs[i] === slugB) continue;
      var r = findChild(slugA, allSlugs[i]);
      if (r && r.child !== currentChild) alternatives.push({ parentA: slugA, parentB: allSlugs[i], child: r.child, isSpecial: r.isSpecial });
      var r2 = findChild(allSlugs[i], slugB);
      if (r2 && r2.child !== currentChild) alternatives.push({ parentA: allSlugs[i], parentB: slugB, child: r2.child, isSpecial: r2.isSpecial });
    }

    var seen = {}, unique = [];
    for (var k = 0; k < alternatives.length; k++) {
      if (!seen[alternatives[k].child]) { seen[alternatives[k].child] = true; unique.push(alternatives[k]); }
    }
    unique.sort(function(a, b) { return (b.isSpecial ? 1 : 0) - (a.isSpecial ? 1 : 0); });
    unique = unique.slice(0, 20);

    if (unique.length === 0) return '<div style="text-align:center;padding:var(--space-4);color:var(--color-text-muted)">No alternative children found.</div>';

    var html = '<div class="calc-pairs-list">';
    for (var u = 0; u < unique.length; u++) {
      var alt = unique[u], cP = palByName[alt.child];
      html += '<div class="calc-pair-row" style="cursor:pointer" data-a="' + alt.parentA + '" data-b="' + alt.parentB + '">' +
        '<img src="/images/pals/' + alt.parentA + '.webp" class="calc-pair-img" alt=""' + imgFallback(alt.parentA) + '>' +
        '<span>' + esc(palByName[alt.parentA] ? palByName[alt.parentA].name : alt.parentA) + '</span>' +
        '<span class="calc-pair-arrow">+</span>' +
        '<img src="/images/pals/' + alt.parentB + '.webp" class="calc-pair-img" alt=""' + imgFallback(alt.parentB) + '>' +
        '<span>' + esc(palByName[alt.parentB] ? palByName[alt.parentB].name : alt.parentB) + '</span>' +
        '<span class="calc-pair-arrow">→</span>' +
        '<img src="/images/pals/' + alt.child + '.webp" class="calc-pair-img" alt=""' + imgFallback(alt.child) + '>' +
        '<span style="font-weight:600">' + esc(cP ? cP.name : alt.child) + '</span>' +
        (alt.isSpecial ? '<span style="font-size:0.625rem;color:var(--color-accent)">⭐ Special</span>' : '') + '</div>';
    }
    html += '</div>';

    setTimeout(function() {
      var rows = document.querySelectorAll('.calc-pair-row[data-a]');
      for (var r = 0; r < rows.length; r++) {
        (function(row) {
          row.addEventListener('click', function() {
            state.slotA = row.getAttribute('data-a');
            state.slotB = row.getAttribute('data-b');
            updateEquation(); updateEqStepGuide(); renderGrid(); breedThem();
          });
        })(rows[r]);
      }
    }, 0);
    return html;
  }

  // ================================================================
  //  FILTERS
  // ================================================================
  function setFilter(filter) { state.activeFilter = filter; updateFilterChips(); renderGrid(); }
  function updateFilterChips() {
    var chips = document.querySelectorAll('.calc-filter-chip');
    for (var i = 0; i < chips.length; i++) {
      var c = chips[i];
      if (c.getAttribute('data-filter') === state.activeFilter) c.classList.add('active');
      else c.classList.remove('active');
    }
  }

  // ================================================================
  //  EVENT LISTENERS
  // ================================================================
  function setupEventListeners() {
    var searchInput = document.getElementById('calc-search');
    if (searchInput) {
      searchInput.addEventListener('input', function() { state.searchQuery = this.value; renderGrid(); });
      searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') { this.value = ''; state.searchQuery = ''; renderGrid(); this.blur(); }
      });
    }

    var grid = document.getElementById('calc-grid');
    if (grid) {
      grid.addEventListener('click', function(e) {
        var card = e.target.closest('.calc-grid-card');
        if (!card) return;
        var slug = card.getAttribute('data-slug');
        if (slug) selectPal(slug);
      });
    }

    var cardA = document.getElementById('calc-eq-card-a');
    if (cardA) cardA.addEventListener('click', function(e) { if (e.target.closest('.calc-eq-remove')) clearSlot('a'); });
    var cardB = document.getElementById('calc-eq-card-b');
    if (cardB) cardB.addEventListener('click', function(e) { if (e.target.closest('.calc-eq-remove')) clearSlot('b'); });

    // Swap button in equation bar
    var swapBtn = document.getElementById('calc-eq-swap');
    if (swapBtn) swapBtn.addEventListener('click', function(e) { e.stopPropagation(); swapSlots(); });

    var filterChips = document.querySelectorAll('#calc-filters .calc-filter-chip');
    for (var i = 0; i < filterChips.length; i++) {
      (function(chip) {
        chip.addEventListener('click', function() { setFilter(chip.getAttribute('data-filter')); });
      })(filterChips[i]);
    }

    var palboxBadge = document.getElementById('calc-empty-palbox');
    if (palboxBadge) palboxBadge.addEventListener('click', function() { setFilter('palbox'); });

    var palboxAddBtn = document.getElementById('calc-palbox-add-btn');
    if (palboxAddBtn) {
      palboxAddBtn.addEventListener('click', function() {
        if (state.slotA && !palbox.has(state.slotA)) togglePalbox(state.slotA);
        if (state.slotB && !palbox.has(state.slotB)) togglePalbox(state.slotB);
        updateEquation(); updateEqStepGuide(); renderGrid(); rerenderCurrentResult();
      });
    }

    var breedBtn = document.getElementById('calc-palbox-what-can-breed');
    if (breedBtn) {
      breedBtn.addEventListener('click', function() {
        if (palbox.size < 2) return;
        var children = computePalboxChildren();
        if (children.length > 0) {
          state.slotA = children[0].slug; state.slotB = null;
          state.mode = 'one-selected';
          updateEquation(); updateEqStepGuide(); renderGrid(); showBreedingPath();
        }
        var float = document.getElementById('calc-palbox-float');
        if (float) float.style.display = 'none';
      });
    }

    document.addEventListener('click', function(e) {
      var float = document.getElementById('calc-palbox-float');
      if (!float || float.style.display === 'none') return;
      if (!float.contains(e.target) && !e.target.closest('#calc-empty-palbox') && !e.target.closest('#calc-palbox-add-btn')) {
        float.style.display = 'none';
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && (state.slotA || state.slotB)) {
        state.slotA = null; state.slotB = null; state.mode = 'idle'; state.resultType = null;
        updateEquation(); updateEqStepGuide(); renderGrid(); hideResult(); updateRightPanel();
      }
    });
  }

  // ================================================================
  //  URL PARAMS
  // ================================================================
  function handleURLParams() {
    var params = new URLSearchParams(window.location.search);
    var target = params.get('target'), a = params.get('a'), b = params.get('b');
    if (a && b) { state.slotA = a; state.slotB = b; updateEquation(); updateEqStepGuide(); renderGrid(); breedThem(); }
    else if (target) { state.slotA = target; updateEquation(); updateEqStepGuide(); renderGrid(); showBreedingPath(); }
  }

  // ---- Start ----
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
