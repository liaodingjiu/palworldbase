/**
 * breeding-tree.js v2 — Pair-Panel Breeding Tree
 *
 * Groups parent pairs by acquisition difficulty:
 *   ⭐ Direct Catch  — both parents must be caught (no breeding pairs)
 *   ⚡ Short Chain   — one parent can be bred, one must be caught
 *   🔴 Full Chain    — both parents can be bred further
 *
 * Click "🔗 Trace" on any pair to see the full breeding chain.
 * "Switch Path →" cycles through alternative pairs at each step.
 */
(function() {
  'use strict';

  // ---- State ----
  var state = {
    rootSlug: null,
    reverseIndex: {},
    palBP: {},
    gridData: [],
    sortMode: 'recommended',
    groupStates: {},     // 'recommended'|'needs-breed'|'both-breed' → 'open'|'show-more'|'show-all'
    traceData: {},       // pairKey → {pathIndex: N, paths: [[step, ...], ...]}
    expandedTraces: {},  // pairKey → true
    dataLoaded: false,
  };

  var MAX_CHAIN_DEPTH = 5;

  // ---- DOM Helpers ----
  function $(id) { return document.getElementById(id); }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getPalInfo(slug) {
    return state.gridData.find(function(p) { return p.slug === slug; }) ||
      { slug: slug, name: slug, number: 0, element: 'neutral', elements: ['neutral'] };
  }

  function getPalImg(slug) {
    return '/images/pals/' + slug + '.webp';
  }

  // A pal is "catch-only" if it has NO breeding pairs — you must catch it
  function isCatchOnly(slug) {
    return !(state.reverseIndex[slug] && state.reverseIndex[slug].length > 0);
  }

  // A pal is breedable if it has breeding pairs in the reverse index
  function isBreedable(slug) {
    return state.reverseIndex[slug] && state.reverseIndex[slug].length > 0;
  }

  function getPairKey(pair) {
    return pair.parent1 + '_' + pair.parent2;
  }

  // ---- Init ----
  async function init() {
    // Parse embedded data
    var gridEl = document.getElementById('tree-grid-data');
    var bpEl = document.getElementById('tree-palbp-data');
    if (gridEl) {
      try { state.gridData = JSON.parse(gridEl.textContent); } catch(e) {}
    }
    if (bpEl) {
      try { state.palBP = JSON.parse(bpEl.textContent); } catch(e) {}
    }

    // Fetch reverse breeding data
    try {
      var resp = await fetch('/data/reverse-breeding.json');
      if (resp.ok) {
        state.reverseIndex = await resp.json();
        state.dataLoaded = true;
      }
    } catch(e) {}

    // Hide SEO fallback
    var seoFallback = document.querySelector('.tree-seo-fallback');
    if (seoFallback) seoFallback.style.display = 'none';

    setupSearch();
    setupSortButtons();

    // Check URL param
    var params = new URLSearchParams(window.location.search);
    var palParam = params.get('pal');
    if (palParam) {
      var match = findPalMatch(palParam);
      if (match) {
        setRoot(match.slug);
        $('tree-search').value = match.name;
      }
    }
  }

  // ---- Search ----
  function setupSearch() {
    var input = $('tree-search');
    var results = $('tree-search-results');
    var debounceTimer;

    input.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      var query = input.value.trim().toLowerCase();
      debounceTimer = setTimeout(function() {
        if (query.length < 1) {
          results.style.display = 'none';
          return;
        }
        var matches = state.gridData.filter(function(p) {
          return p.name.toLowerCase().indexOf(query) !== -1 ||
            p.number.toString().indexOf(query) !== -1 ||
            p.slug.indexOf(query) !== -1;
        }).slice(0, 8);

        if (matches.length === 0) {
          results.innerHTML = '<div class="tree-search-empty">No Pals found</div>';
        } else {
          results.innerHTML = matches.map(function(p) {
            return '<div class="tree-search-item" data-slug="' + p.slug + '">' +
              '<img src="' + getPalImg(p.slug) + '" alt="' + esc(p.name) + '" class="tree-search-item-img"' +
              ' onerror="this.src=\'/images/pals/' + p.slug + '.png\';this.onerror=null;this.src=\'/images/pals/_placeholder.png\'">' +
              '<div class="tree-search-item-text">' +
              '<span class="tree-search-item-name">' + esc(p.name) + '</span>' +
              '<span class="tree-search-item-meta">#' + p.number + ' · BP ' + (state.palBP[p.slug] || '?') + '</span>' +
              '</div></div>';
          }).join('');
        }
        results.style.display = 'block';
      }, 150);
    });

    results.addEventListener('click', function(e) {
      var item = e.target.closest('.tree-search-item');
      if (!item || !item.dataset.slug) return;
      var slug = item.dataset.slug;
      var info = getPalInfo(slug);
      input.value = info.name;
      results.style.display = 'none';
      setRoot(slug);
    });

    input.addEventListener('blur', function() {
      setTimeout(function() { results.style.display = 'none'; }, 200);
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        results.style.display = 'none';
        input.blur();
      } else if (e.key === 'Enter') {
        var first = results.querySelector('.tree-search-item[data-slug]');
        if (first) {
          first.click();
        } else if (input.value.trim()) {
          var match = findPalMatch(input.value.trim());
          if (match) {
            input.value = match.name;
            setRoot(match.slug);
          }
        }
      }
    });
  }

  function findPalMatch(query) {
    var q = query.toLowerCase();
    var match = state.gridData.find(function(p) { return p.slug === q; });
    if (match) return match;
    match = state.gridData.find(function(p) { return p.name.toLowerCase() === q; });
    if (match) return match;
    match = state.gridData.find(function(p) { return p.name.toLowerCase().indexOf(q) !== -1; });
    if (match) return match;
    match = state.gridData.find(function(p) { return p.number.toString() === q; });
    return match;
  }

  // ---- Sort Buttons ----
  function setupSortButtons() {
    var bar = $('tree-sort-bar');
    if (!bar) return;
    bar.addEventListener('click', function(e) {
      var pill = e.target.closest('.tree-sort-pill');
      if (!pill) return;
      state.sortMode = pill.dataset.sort;
      bar.querySelectorAll('.tree-sort-pill').forEach(function(p) { p.classList.remove('active'); });
      pill.classList.add('active');
      if (state.rootSlug) renderPairList();
    });
  }

  // ---- setRoot ----
  function setRoot(slug) {
    state.rootSlug = slug;
    state.traceData = {};
    state.expandedTraces = {};
    state.groupStates = {
      'recommended': 'open',
      'needs-breed': 'show-more',
      'both-breed': 'collapsed'
    };

    var empty = $('tree-empty');
    var header = $('tree-target-header');
    if (empty) empty.style.display = 'none';
    if (header) header.style.display = '';

    renderTargetHeader();
    renderPairList();

    // Update URL
    var url = new URL(window.location);
    url.searchParams.set('pal', slug);
    window.history.replaceState({}, '', url);

    // Update calculator link
    var calcBtn = $('tree-btn-calculator');
    if (calcBtn) calcBtn.href = '/breeding-calculator/?target=' + slug;

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- Target Header ----
  function renderTargetHeader() {
    var card = $('tree-target-card');
    if (!card) return;

    var info = getPalInfo(state.rootSlug);
    var pairs = state.reverseIndex[state.rootSlug] || [];

    card.innerHTML =
      '<img src="' + getPalImg(state.rootSlug) + '" alt="' + esc(info.name) + '" class="tree-target-img"' +
      ' onerror="this.src=\'/images/pals/' + state.rootSlug + '.png\';this.onerror=null;this.src=\'/images/pals/_placeholder.png\'">' +
      '<div class="tree-target-info">' +
        '<div class="tree-target-name">' + esc(info.name) + '</div>' +
        '<div class="tree-target-meta">#' + info.number + ' · BP ' + (state.palBP[state.rootSlug] || '?') +
        ' · ' + (info.element || info.elements[0] || 'neutral') +
        (isCatchOnly(state.rootSlug) ? ' · 🌿 Catch Only' : '') + '</div>' +
      '</div>' +
      '<div class="tree-target-pair-count">' +
        '<strong>' + pairs.length + '</strong>' +
        '<span>parent pairs</span>' +
      '</div>';
  }

  // ---- Pair List Rendering ----
  function renderPairList() {
    var list = $('tree-pair-list');
    if (!list) return;

    var pairs = state.reverseIndex[state.rootSlug] || [];
    if (pairs.length === 0) {
      list.innerHTML = '<div class="tree-empty-state"><div class="tree-empty-icon">🔍</div>' +
        '<p class="tree-empty-text">No breeding pairs found for this Pal.</p></div>';
      return;
    }

    var groups = groupPairs(pairs);

    sortPairsInPlace(groups.recommended, state.sortMode);
    sortPairsInPlace(groups.needsBreed, state.sortMode);
    sortPairsInPlace(groups.bothBreed, state.sortMode);

    var html = '';

    // ⭐ Direct Catch — both parents must be caught (no breeding pairs)
    html += renderGroup('recommended', groups.recommended,
      '⭐', 'Direct Catch — both parents must be caught', 'recommended');

    // ⚡ Short Chain — one parent needs breeding
    html += renderGroup('needs-breed', groups.needsBreed,
      '⚡', 'Short Chain — one parent needs breeding', 'needs-breed');

    // 🔴 Full Chain — both parents need breeding
    html += renderGroup('both-breed', groups.bothBreed,
      '🔴', 'Full Chain — both parents need breeding', 'both-breed');

    list.innerHTML = html;

    // Re-bind events (delegation on list)
    list.removeEventListener('click', handlePairListClick);
    list.addEventListener('click', handlePairListClick);
  }

  function groupPairs(pairs) {
    var recommended = [];
    var needsBreed = [];
    var bothBreed = [];

    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i];
      var p1Catch = isCatchOnly(pair.parent1);
      var p2Catch = isCatchOnly(pair.parent2);
      if (p1Catch && p2Catch) {
        recommended.push(pair);
      } else if (p1Catch || p2Catch) {
        needsBreed.push(pair);
      } else {
        bothBreed.push(pair);
      }
    }

    return { recommended: recommended, needsBreed: needsBreed, bothBreed: bothBreed };
  }

  function sortPairsInPlace(pairs, mode) {
    if (mode === 'recommended') {
      // Best pairs: lowest avgBP (closest match = more reliable breed)
      pairs.sort(function(a, b) { return a.avgBP - b.avgBP; });
    } else if (mode === 'wild') {
      // "Wild First" = prefer catch-only parents
      pairs.sort(function(a, b) {
        var aCatch = (isCatchOnly(a.parent1) ? 1 : 0) + (isCatchOnly(a.parent2) ? 1 : 0);
        var bCatch = (isCatchOnly(b.parent1) ? 1 : 0) + (isCatchOnly(b.parent2) ? 1 : 0);
        if (aCatch !== bCatch) return bCatch - aCatch;
        return a.avgBP - b.avgBP;
      });
    } else if (mode === 'bp') {
      pairs.sort(function(a, b) { return a.avgBP - b.avgBP; });
    } else if (mode === 'steps') {
      pairs.sort(function(a, b) {
        var aSteps = estimateSteps(a);
        var bSteps = estimateSteps(b);
        if (aSteps !== bSteps) return aSteps - bSteps;
        return a.avgBP - b.avgBP;
      });
    }
  }

  function estimateSteps(pair) {
    var steps = 0;
    if (isBreedable(pair.parent1)) steps += estimateMinSteps(pair.parent1, new Set(), 3);
    if (isBreedable(pair.parent2)) steps += estimateMinSteps(pair.parent2, new Set(), 3);
    return steps;
  }

  function estimateMinSteps(slug, visited, maxDepth) {
    if (visited.has(slug) || maxDepth <= 0) return 3;
    if (isCatchOnly(slug)) return 0;
    visited.add(slug);
    var pairs = state.reverseIndex[slug];
    if (!pairs || pairs.length === 0) return 3;
    var best = 3;
    for (var i = 0; i < pairs.length; i++) {
      var p = pairs[i];
      var s = 1 + estimateMinSteps(p.parent1, new Set(visited), maxDepth - 1) +
        estimateMinSteps(p.parent2, new Set(visited), maxDepth - 1);
      if (s < best) best = s;
    }
    return best;
  }

  function renderGroup(key, pairs, icon, label, colorClass) {
    // Don't render empty groups
    if (pairs.length === 0) return '';

    var groupState = state.groupStates[key] || 'open';
    var isCollapsed = groupState === 'collapsed';
    var isShowMore = groupState === 'show-more';
    var isShowAll = groupState === 'show-all';

    var cls = 'tree-diff-group ' + colorClass;
    if (isCollapsed) cls += ' collapsed';
    if (isShowMore) cls += ' show-more';
    if (isShowAll) cls += ' show-all';
    if (!isCollapsed && !isShowMore && !isShowAll) cls += ' open';

    var pairCount = pairs.length;

    var html = '<div class="' + cls + '" data-group="' + key + '">';
    html += '<div class="tree-diff-group-header">';
    html += '<span class="tree-diff-group-icon">' + icon + '</span>';
    html += '<span class="tree-diff-group-label">' + esc(label) + '</span>';
    html += '<span class="tree-diff-group-count">' + pairCount + ' pair' + (pairCount !== 1 ? 's' : '') + '</span>';
    html += '<span class="tree-diff-group-chevron">▾</span>';
    html += '</div>';
    html += '<div class="tree-diff-group-body">';

    for (var i = 0; i < pairs.length; i++) {
      html += renderPairRow(pairs[i], i);
    }

    html += '</div>'; // group-body

    // Show more button (only when show-more and more than 3)
    if (isShowMore && pairCount > 3) {
      html += '<div class="tree-show-more">';
      html += '<button class="tree-show-more-btn" data-action="show-all" data-group="' + key + '">Show all ' + pairCount + ' pairs ▾</button>';
      html += '</div>';
    }

    html += '</div>'; // group
    return html;
  }

  function renderPairRow(pair, index) {
    var p1 = getPalInfo(pair.parent1);
    var p2 = getPalInfo(pair.parent2);
    var p1Catch = isCatchOnly(pair.parent1);
    var p2Catch = isCatchOnly(pair.parent2);
    var pairKey = getPairKey(pair);
    var isTraced = state.expandedTraces[pairKey];

    var cls = 'tree-pair-row-item';

    var html = '<div class="' + cls + '" data-pair-key="' + pairKey + '" data-parent1="' + pair.parent1 + '" data-parent2="' + pair.parent2 + '">';

    // Parent 1
    html += '<a href="/pals/' + pair.parent1 + '/" class="tree-pair-parent-thumb" title="' + esc(p1.name) + '">';
    html += '<img src="' + getPalImg(pair.parent1) + '" alt="' + esc(p1.name) + '" loading="lazy"' +
      ' onerror="this.src=\'/images/pals/' + pair.parent1 + '.png\';this.onerror=null;this.src=\'/images/pals/_placeholder.png\'">';
    html += '<span class="tree-pair-thumb-name">' + esc(p1.name) + '</span>';
    html += '<span class="' + (p1Catch ? 'wild-indicator' : 'breed-indicator') + '">' +
      (p1Catch ? '🌿 Catch' : '🥚 Breed') + '</span>';
    html += '</a>';

    html += '<span class="tree-pair-op">+</span>';

    // Parent 2
    html += '<a href="/pals/' + pair.parent2 + '/" class="tree-pair-parent-thumb" title="' + esc(p2.name) + '">';
    html += '<img src="' + getPalImg(pair.parent2) + '" alt="' + esc(p2.name) + '" loading="lazy"' +
      ' onerror="this.src=\'/images/pals/' + pair.parent2 + '.png\';this.onerror=null;this.src=\'/images/pals/_placeholder.png\'">';
    html += '<span class="tree-pair-thumb-name">' + esc(p2.name) + '</span>';
    html += '<span class="' + (p2Catch ? 'wild-indicator' : 'breed-indicator') + '">' +
      (p2Catch ? '🌿 Catch' : '🥚 Breed') + '</span>';
    html += '</a>';

    html += '<span class="tree-pair-eq">→</span>';

    // Target
    var targetInfo = getPalInfo(state.rootSlug);
    html += '<a href="/pals/' + state.rootSlug + '/" class="tree-pair-parent-thumb" title="' + esc(targetInfo.name) + '">';
    html += '<img src="' + getPalImg(state.rootSlug) + '" alt="' + esc(targetInfo.name) + '" loading="lazy"' +
      ' onerror="this.src=\'/images/pals/' + state.rootSlug + '.png\';this.onerror=null;this.src=\'/images/pals/_placeholder.png\'">';
    html += '<span class="tree-pair-thumb-name" style="color:var(--color-accent)">🎯 Target</span>';
    html += '</a>';

    // BP info
    html += '<span class="tree-pair-bp-info">';
    html += '<span>BP ' + pair.parent1BP + ' + ' + pair.parent2BP + '</span>';
    html += '<span>Avg ' + pair.avgBP + ' → ' + pair.childBP + '</span>';
    if (pair.isSpecial) html += '<span style="color:#f0c040">★ Special</span>';
    html += '</span>';

    // Trace button — show if at least one parent is breedable
    if (isBreedable(pair.parent1) || isBreedable(pair.parent2)) {
      html += '<button class="tree-trace-btn' + (isTraced ? ' active' : '') + '" data-action="trace" data-pair-key="' + pairKey + '" data-parent1="' + pair.parent1 + '" data-parent2="' + pair.parent2 + '">' +
        (isTraced ? '🔗 Hide Trace' : '🔗 Trace') + '</button>';
    }

    html += '</div>'; // pair-row-item

    // Chain trace panel
    if (isTraced) {
      html += renderChainTrace(pair);
    }

    return html;
  }

  // ---- Chain Trace ----
  function renderChainTrace(pair) {
    var pairKey = getPairKey(pair);
    var traceState = state.traceData[pairKey];

    if (!traceState) {
      traceState = computeTracePaths(pair);
      state.traceData[pairKey] = traceState;
    }

    var pathIndex = traceState.pathIndex;
    var path = traceState.paths[pathIndex] || [];
    var totalPaths = traceState.paths.length;

    var html = '<div class="tree-chain-panel">';
    html += '<div class="tree-chain-header">';
    html += '<span class="tree-chain-header-label">🔗 Breeding Chain (' + (path.length + 1) + ' step' + (path.length > 0 ? 's' : '') + ')</span>';
    if (totalPaths > 1) {
      html += '<button class="tree-chain-switch-btn" data-action="switch-path" data-pair-key="' + pairKey + '">Switch Path → (' + (pathIndex + 1) + '/' + totalPaths + ')</button>';
    }
    html += '<button class="tree-chain-switch-btn" data-action="close-trace" data-pair-key="' + pairKey + '" style="margin-left:4px">✕ Close</button>';
    html += '</div>';

    html += '<div class="tree-chain-steps">';

    // Step 1: the selected pair produces the target
    html += renderChainStep(
      [pair.parent1, pair.parent2],
      state.rootSlug,
      'Step 1 — This pair → target'
    );

    // Subsequent steps
    for (var i = 0; i < path.length; i++) {
      var step = path[i];
      html += renderChainStep(
        [step.p1, step.p2],
        step.child,
        'Step ' + (i + 2)
      );
    }

    html += '</div></div>';
    return html;
  }

  function renderChainStep(parents, childSlug, label) {
    var p1 = getPalInfo(parents[0]);
    var p2 = getPalInfo(parents[1]);
    var child = getPalInfo(childSlug);

    var html = '<div class="tree-chain-step">';
    html += '<span class="tree-chain-step-num">' + label + '</span>';

    html += '<a href="/pals/' + parents[0] + '/">';
    html += '<img src="' + getPalImg(parents[0]) + '" alt="' + esc(p1.name) + '" loading="lazy"' +
      ' onerror="this.src=\'/images/pals/' + parents[0] + '.png\'">';
    html += '<span style="font-weight:600;margin:0 2px">' + esc(p1.name) + '</span>';
    html += '</a>';

    html += '<span class="tree-chain-step-arrow">+</span>';

    html += '<a href="/pals/' + parents[1] + '/">';
    html += '<img src="' + getPalImg(parents[1]) + '" alt="' + esc(p2.name) + '" loading="lazy"' +
      ' onerror="this.src=\'/images/pals/' + parents[1] + '.png\'">';
    html += '<span style="font-weight:600;margin:0 2px">' + esc(p2.name) + '</span>';
    html += '</a>';

    html += '<span class="tree-chain-step-arrow">→</span>';

    html += '<a href="/pals/' + childSlug + '/">';
    html += '<img src="' + getPalImg(childSlug) + '" alt="' + esc(child.name) + '" loading="lazy"' +
      ' onerror="this.src=\'/images/pals/' + childSlug + '.png\'">';
    html += '<span class="tree-chain-step-target">' + esc(child.name) + '</span>';
    html += '</a>';

    html += '</div>';
    return html;
  }

  function computeTracePaths(pair) {
    var paths = [];
    var primaryPath = [];

    // Find breedable parents that need tracing
    var toResolve = [];
    if (isBreedable(pair.parent1)) toResolve.push(pair.parent1);
    if (isBreedable(pair.parent2)) toResolve.push(pair.parent2);

    // Build primary path
    var visited = new Set();
    visited.add(state.rootSlug);

    for (var i = 0; i < toResolve.length; i++) {
      var steps = resolveChain(toResolve[i], visited, MAX_CHAIN_DEPTH);
      for (var j = 0; j < steps.length; j++) {
        primaryPath.push(steps[j]);
      }
    }

    if (primaryPath.length > 0) {
      paths.push(primaryPath);
    }

    // Generate alternatives by varying the first breedable parent's pair
    if (toResolve.length > 0) {
      var firstSlug = toResolve[0];
      var allPairs = state.reverseIndex[firstSlug] || [];
      var seenPairs = {};

      for (var k = 0; k < allPairs.length; k++) {
        var altPair = allPairs[k];
        var kk = altPair.parent1 + '_' + altPair.parent2;
        if (seenPairs[kk]) continue;
        seenPairs[kk] = true;

        var altVisited = new Set(visited);
        var altPath = [];
        var altSteps = resolveChainFromPair(altPair, firstSlug, altVisited, MAX_CHAIN_DEPTH);
        for (var m = 0; m < altSteps.length; m++) altPath.push(altSteps[m]);

        for (var n = 1; n < toResolve.length; n++) {
          var remaining = resolveChain(toResolve[n], altVisited, MAX_CHAIN_DEPTH);
          for (var p = 0; p < remaining.length; p++) altPath.push(remaining[p]);
        }

        if (altPath.length > 0 && !pathsEqual(altPath, primaryPath)) {
          paths.push(altPath);
        }
      }
    }

    return { pathIndex: 0, paths: paths.length > 0 ? paths : [[]] };
  }

  function resolveChain(slug, visited, maxDepth) {
    var steps = [];
    if (maxDepth <= 0 || visited.has(slug)) return steps;
    if (isCatchOnly(slug)) return steps; // terminal — must catch

    visited.add(slug);
    var pairs = state.reverseIndex[slug];
    if (!pairs || pairs.length === 0) return steps;

    // Best pair: prefer catch-only parents (fewest further steps)
    var bestPair = null;
    for (var i = 0; i < pairs.length; i++) {
      var p = pairs[i];
      if (!bestPair) { bestPair = p; continue; }
      var pCatch = (isCatchOnly(p.parent1) ? 1 : 0) + (isCatchOnly(p.parent2) ? 1 : 0);
      var bCatch = (isCatchOnly(bestPair.parent1) ? 1 : 0) + (isCatchOnly(bestPair.parent2) ? 1 : 0);
      if (pCatch > bCatch) { bestPair = p; }
      else if (pCatch === bCatch && p.avgBP < bestPair.avgBP) { bestPair = p; }
    }

    if (!bestPair) return steps;

    steps.push({
      p1: bestPair.parent1,
      p2: bestPair.parent2,
      child: slug
    });

    if (isBreedable(bestPair.parent1)) {
      var sub = resolveChain(bestPair.parent1, visited, maxDepth - 1);
      for (var j = 0; j < sub.length; j++) steps.push(sub[j]);
    }
    if (isBreedable(bestPair.parent2)) {
      var sub2 = resolveChain(bestPair.parent2, visited, maxDepth - 1);
      for (var k = 0; k < sub2.length; k++) steps.push(sub2[k]);
    }

    return steps;
  }

  function resolveChainFromPair(pair, childSlug, visited, maxDepth) {
    var steps = [];
    if (maxDepth <= 0 || visited.has(childSlug)) return steps;

    visited.add(childSlug);
    steps.push({ p1: pair.parent1, p2: pair.parent2, child: childSlug });

    if (isBreedable(pair.parent1)) {
      var sub = resolveChain(pair.parent1, visited, maxDepth - 1);
      for (var i = 0; i < sub.length; i++) steps.push(sub[i]);
    }
    if (isBreedable(pair.parent2)) {
      var sub2 = resolveChain(pair.parent2, visited, maxDepth - 1);
      for (var j = 0; j < sub2.length; j++) steps.push(sub2[j]);
    }

    return steps;
  }

  function pathsEqual(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i].p1 !== b[i].p1 || a[i].p2 !== b[i].p2 || a[i].child !== b[i].child) return false;
    }
    return true;
  }

  // ---- Event Handling ----
  function handlePairListClick(e) {
    // Group header toggle
    var header = e.target.closest('.tree-diff-group-header');
    if (header && !e.target.closest('[data-action]')) {
      var group = header.closest('.tree-diff-group');
      if (group) {
        toggleGroup(group.dataset.group);
      }
      return;
    }

    // Show all button
    var showAllBtn = e.target.closest('[data-action="show-all"]');
    if (showAllBtn) {
      state.groupStates[showAllBtn.dataset.group] = 'show-all';
      renderPairList();
      return;
    }

    // Trace button
    var traceBtn = e.target.closest('[data-action="trace"]');
    if (traceBtn) {
      toggleTrace(traceBtn.dataset.pairKey);
      return;
    }

    // Switch path
    var switchBtn = e.target.closest('[data-action="switch-path"]');
    if (switchBtn) {
      switchPath(switchBtn.dataset.pairKey);
      return;
    }

    // Close trace
    var closeBtn = e.target.closest('[data-action="close-trace"]');
    if (closeBtn) {
      closeTrace(closeBtn.dataset.pairKey);
      return;
    }
  }

  function toggleGroup(groupKey) {
    var current = state.groupStates[groupKey] || 'open';
    var next = {
      'open': 'collapsed',
      'collapsed': 'open',
      'show-more': 'collapsed',
      'show-all': 'collapsed'
    };
    state.groupStates[groupKey] = next[current] || 'open';
    renderPairList();
  }

  function toggleTrace(pairKey) {
    if (state.expandedTraces[pairKey]) {
      delete state.expandedTraces[pairKey];
      delete state.traceData[pairKey];
    } else {
      state.expandedTraces[pairKey] = true;
    }
    renderPairList();
  }

  function closeTrace(pairKey) {
    delete state.expandedTraces[pairKey];
    delete state.traceData[pairKey];
    renderPairList();
  }

  function switchPath(pairKey) {
    var traceState = state.traceData[pairKey];
    if (!traceState) return;
    traceState.pathIndex = (traceState.pathIndex + 1) % traceState.paths.length;
    renderPairList();
  }

  // ---- Start ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
