/**
 * hero-home.js — Homepage Hero search pill autocomplete
 *
 * Enhances the search pill with live autocomplete:
 * - Dropdown with Pal avatar + name + number
 * - Keyboard navigation
 * - Redirect to /breeding-calculator/?target=slug on select
 * - Falls back to form GET if JS fails
 */
(function () {
  'use strict';

  let palList = [];
  const input = document.getElementById('hero-search-input');
  const select = document.getElementById('hero-search-select');
  const form = document.getElementById('hero-search-form');
  if (!input || !select) return;

  let dropdown = null;
  let selectedIndex = -1;

  // Build dropdown element
  function ensureDropdown() {
    if (dropdown) return;
    dropdown = document.createElement('div');
    dropdown.className = 'hero-search-dropdown';
    dropdown.style.cssText = 'display:none;position:absolute;top:100%;left:0;right:0;z-index:50;max-height:280px;overflow-y:auto;background:var(--color-bg-elevated, #141820);border:1px solid var(--color-border);border-radius:14px;margin-top:6px;box-shadow:0 8px 32px rgba(0,0,0,0.5)';
    const wrapper = input.parentNode;
    wrapper.style.position = 'relative';
    wrapper.appendChild(dropdown);
  }

  async function loadData() {
    try {
      const resp = await fetch('/data/pal-stats.json');
      if (resp.ok) palList = await resp.json();
    } catch (e) {
      // Fallback: extract from hidden select
      const opts = select.querySelectorAll('option');
      palList = Array.from(opts).filter(o => o.value).map(o => ({ slug: o.value, name: o.textContent }));
    }
  }

  function filterResults(query) {
    const q = query.toLowerCase().trim();
    if (!q) return palList.slice(0, 12);
    return palList.filter(p =>
      p.name.toLowerCase().includes(q) ||
      String(p.number).includes(q)
    ).slice(0, 12);
  }

  function renderDropdown(matches) {
    ensureDropdown();
    if (matches.length === 0) {
      dropdown.innerHTML = '<div style="padding:10px 16px;font-size:0.8125rem;color:var(--color-text-muted)">No Pals found</div>';
    } else {
      dropdown.innerHTML = matches.map((p, i) => {
        const el = (p.elements && p.elements[0]) ? p.elements[0].toLowerCase() : 'neutral';
        return `<div class="hero-search-option" data-slug="${p.slug}" data-index="${i}"
          style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;font-size:0.8125rem;transition:background var(--transition-fast);border-bottom:1px solid rgba(255,255,255,0.04)">
          <img src="/images/pals/${p.slug}.webp" alt="${esc(p.name)}"
               style="width:32px;height:32px;border-radius:50%;object-fit:cover;object-position:center 25%;background:var(--color-bg);flex-shrink:0"
               onerror="this.src='/images/pals/${p.slug}.png'">
          <span style="flex:1">${esc(p.name)}</span>
          <span style="font-size:0.6875rem;color:var(--color-text-muted)">#${p.number}</span>
        </div>`;
      }).join('');
    }
    dropdown.style.display = 'block';
    selectedIndex = -1;

    // Bind click handlers
    dropdown.querySelectorAll('.hero-search-option').forEach(opt => {
      opt.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const slug = opt.dataset.slug;
        selectOption(slug);
      });
      opt.addEventListener('mouseenter', function() {
        dropdown.querySelectorAll('.hero-search-option').forEach(o => o.style.background = '');
        this.style.background = 'var(--color-surface-hover)';
        selectedIndex = parseInt(this.dataset.index);
      });
      opt.addEventListener('mouseleave', function() {
        this.style.background = '';
      });
    });
  }

  function selectOption(slug) {
    input.value = '';
    select.value = slug;
    if (dropdown) dropdown.style.display = 'none';
    // Redirect to Calculator with the selected target
    window.location.href = '/breeding-calculator/?target=' + encodeURIComponent(slug);
  }

  // Event listeners
  input.addEventListener('focus', () => {
    if (palList.length === 0) loadData().then(() => renderDropdown(filterResults(input.value)));
    else renderDropdown(filterResults(input.value));
  });

  input.addEventListener('input', () => {
    if (palList.length === 0) loadData().then(() => renderDropdown(filterResults(input.value)));
    else renderDropdown(filterResults(input.value));
  });

  input.addEventListener('blur', () => {
    setTimeout(() => { if (dropdown) dropdown.style.display = 'none'; }, 200);
  });

  input.addEventListener('keydown', (e) => {
    if (!dropdown || dropdown.style.display === 'none') return;
    const opts = dropdown.querySelectorAll('.hero-search-option');
    if (!opts.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, opts.length - 1);
      highlightOpt(opts, selectedIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      highlightOpt(opts, selectedIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && opts[selectedIndex]) {
        selectOption(opts[selectedIndex].dataset.slug);
      } else {
        // Try to match first result
        const firstMatch = opts[0];
        if (firstMatch) selectOption(firstMatch.dataset.slug);
      }
    } else if (e.key === 'Escape') {
      dropdown.style.display = 'none';
    }
  });

  // Intercept form submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;

    // Try exact match first
    const exact = palList.find(p => p.name.toLowerCase() === q.toLowerCase());
    if (exact) { selectOption(exact.slug); return; }

    // Try prefix match
    const prefix = palList.filter(p => p.name.toLowerCase().startsWith(q.toLowerCase()));
    if (prefix.length === 1) { selectOption(prefix[0].slug); return; }
    if (prefix.length > 1) {
      // Multiple matches — show dropdown
      renderDropdown(prefix);
      return;
    }

    // Fallback: try contains match
    const contains = palList.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
    if (contains.length > 0) {
      renderDropdown(contains);
      return;
    }

    // No match — redirect to Pal Finder with search query
    window.location.href = '/pal-finder/?q=' + encodeURIComponent(q);
  });

  function highlightOpt(opts, idx) {
    opts.forEach((o, i) => o.style.background = i === idx ? 'var(--color-surface-hover)' : '');
    if (opts[idx]) opts[idx].scrollIntoView({ block: 'nearest' });
  }

  function esc(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // Preload data on idle
  if (window.requestIdleCallback) {
    requestIdleCallback(() => loadData());
  } else {
    setTimeout(() => loadData(), 1000);
  }
})();
