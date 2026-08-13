#!/usr/bin/env node
/**
 * build.js — PalworldBase static site generator
 *
 * Generates ~330 static HTML pages from Pal JSON data.
 * Zero npm dependencies — pure Node.js.
 *
 * Usage: node scripts/build.js
 * Output: dist/ (deployed to Cloudflare Pages)
 */

const fs = require('fs');
const path = require('path');

const config = require('./config');
const { DOMAIN, SITE_NAME, BUILD_DATE, BUILD_YEAR,
  ELEMENT_COLORS, WORK_COLORS, WORK_LABELS,
  RARITY_ORDER, RARITY_BONUS, RARITY_BREEDING,
  TITLE_TEMPLATES, DESC_TEMPLATES,
  SECTION_HEADINGS, ALT_TEMPLATES, CTA_TEMPLATES,
  getUniqueSellingPoint, NAV, FOOTER
} = config;

const { renderTemplate, renderString, renderPage, clearCache } = require('./render-engine');
const { renderHead, palSchema, breadcrumbSchema, websiteSchema, getAltText, esc } = require('./render-head');
const { findBestPath, findWhatsNext, getParentPairs, getBreedingDifficulty } = require('./algorithm-breeding');
const { computeAllBuilds } = require('./algorithm-skills');
const { computeZScores, rankAmongPeers, generateComparisonSentences } = require('./algorithm-comparison');
const { extractFacts } = require('./seed-facts');

// ---- Paths ----
const DATA_DIR = path.join(__dirname, '..', 'data');
const PALS_DIR = path.join(DATA_DIR, 'pals');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

// ---- Data loading ----
console.log('═══ PalworldBase Static Site Generator ═══');
console.log(`Build date: ${BUILD_DATE}\n`);

console.log('Loading data...');
const allPals = [];
const palFiles = fs.readdirSync(PALS_DIR).filter(f => f.endsWith('.json'));
for (const f of palFiles) {
  const pal = JSON.parse(fs.readFileSync(path.join(PALS_DIR, f), 'utf8'));
  if (pal.number === 0 && !pal.name.en) continue;
  allPals.push(pal);
}
allPals.sort((a, b) => a.number - b.number);
console.log(`  ${allPals.length} Pals`);

const palTiers = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'pal-tiers.json'), 'utf8'));
const elementPeers = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'element-peers.json'), 'utf8'));
const reverseIndex = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'reverse-breeding.json'), 'utf8'));
const calculatorData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'calculator-data.json'), 'utf8'));
const palStats = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'pal-stats.json'), 'utf8'));
console.log(`  ${Object.keys(reverseIndex).length} breeding targets`);

// Build slug→Pal lookup
const palBySlug = {};
for (const pal of allPals) palBySlug[pal.slug] = pal;

// Build stat lookup
const statsBySlug = {};
for (const ps of palStats) statsBySlug[ps.slug] = ps;

// Pre-compute stat distributions for percentile bars
const STAT_KEYS = ['hp', 'attack', 'defense', 'speed', 'stamina'];
const STAT_LABELS = { hp: 'HP', attack: 'Melee ATK', defense: 'Defense', speed: 'Speed', stamina: 'Stamina' };
const statMaxes = {};
const statAllValues = {};
for (const key of STAT_KEYS) {
  statMaxes[key] = 0;
  statAllValues[key] = [];
}
for (const pal of allPals) {
  for (const key of STAT_KEYS) {
    const val = pal.stats[key] || 0;
    if (val > statMaxes[key]) statMaxes[key] = val;
    statAllValues[key].push(val);
  }
}
for (const key of STAT_KEYS) {
  statAllValues[key].sort((a, b) => a - b);
}
// Pre-compute all stat totals for percentile
const statAllTotalValues = allPals.map(p => STAT_KEYS.reduce((s, k) => s + (p.stats[k] || 0), 0)).sort((a, b) => a - b);
const statTotalMax = STAT_KEYS.reduce((s, k) => s + statMaxes[k], 0);

function getStatPct(slug, key) {
  const pal = palBySlug[slug];
  if (!pal || !pal.stats) return 0;
  const val = pal.stats[key] || 0;
  const all = statAllValues[key];
  let lower = 0;
  for (let i = 0; i < all.length; i++) {
    if (all[i] <= val) lower++;
  }
  return Math.round((lower / all.length) * 100);
}

function getStatBarClass(pct) {
  if (pct >= 70) return 'high';
  if (pct >= 30) return 'mid';
  return 'low';
}

function renderStatBars(slug) {
  const pal = palBySlug[slug];
  if (!pal || !pal.stats) return '';
  const statTotal = STAT_KEYS.reduce((s, k) => s + (pal.stats[k] || 0), 0);

  // Stat Total: percentile among all Pals (not vs sum-of-maxes, which is skewed by mounts)
  const allTotals = statAllTotalValues;
  let totalLower = 0;
  for (let i = 0; i < allTotals.length; i++) {
    if (allTotals[i] <= statTotal) totalLower++;
  }
  const totalPct = Math.round((totalLower / allTotals.length) * 100);

  const bars = STAT_KEYS.map(key => {
    const val = pal.stats[key] || 0;
    const pct = getStatPct(slug, key);
    const cls = getStatBarClass(pct);
    return `<div class="pal-stat-bar">
      <span class="pal-stat-bar-label">${STAT_LABELS[key]}</span>
      <span class="pal-stat-bar-value">${val}</span>
      <div class="pal-stat-bar-track">
        <div class="pal-stat-bar-fill ${cls}" style="width:${pct}%"></div>
      </div>
      <span class="pal-stat-bar-pct ${cls}">${pct}%</span>
    </div>`;
  }).join('\n');

  return `<div class="pal-stat-bars">
    ${bars}
    <div class="pal-stat-total">
      <span class="pal-stat-total-label">Total</span>
      <span class="pal-stat-total-value">${statTotal}</span>
      <div class="pal-stat-bar-track">
        <div class="pal-stat-bar-fill ${getStatBarClass(totalPct)}" style="width:${totalPct}%"></div>
      </div>
      <span class="pal-stat-bar-pct ${getStatBarClass(totalPct)}">${totalPct}%</span>
    </div>
  </div>`;
}

// ---- Directory setup ----
console.log('\nSetting up dist/...');
const dirs = [
  'dist', 'dist/pals', 'dist/css', 'dist/images/pals',
  'dist/breeding-calculator', 'dist/breeding-tree', 'dist/pal-finder', 'dist/guides',
  'dist/about', 'dist/privacy', 'dist/terms', 'dist/cookie-policy',
  'dist/assets', 'dist/data',
];
for (const d of dirs) {
  fs.mkdirSync(path.join(__dirname, '..', d), { recursive: true });
}

// Copy static assets
console.log('Copying static assets...');
copyDir('css', 'dist/css');
copyDir('images', 'dist/images');
copyDir('assets', 'dist/assets');
// Copy client-side data files
fs.copyFileSync(path.join(DATA_DIR, 'calculator-data.json'), path.join(DIST_DIR, 'data', 'calculator-data.json'));
fs.copyFileSync(path.join(DATA_DIR, 'pal-stats.json'), path.join(DIST_DIR, 'data', 'pal-stats.json'));
fs.copyFileSync(path.join(DATA_DIR, 'reverse-breeding.json'), path.join(DIST_DIR, 'data', 'reverse-breeding.json'));
console.log('  data/calculator-data.json → dist/data/');
console.log('  data/pal-stats.json → dist/data/');
console.log('  data/reverse-breeding.json → dist/data/');
function copyDir(src, dest) {
  const srcPath = path.join(__dirname, '..', src);
  const destPath = path.join(__dirname, '..', dest);
  if (!fs.existsSync(srcPath)) return;
  fs.cpSync(srcPath, destPath, { recursive: true });
  const count = fs.readdirSync(destPath, { recursive: true }).length;
  console.log(`  ${src}/ → ${dest}/ (${count} files)`);
}

// ---- Page rendering helpers ----

/**
 * Full page wrapper: <!DOCTYPE html> + <head> + <body> + header + content + footer
 */
function wrapPage(headHTML, bodyHTML, includeCookieBanner = true) {
  const cookieScript = includeCookieBanner
    ? renderTemplate(path.join(TEMPLATES_DIR, 'components', 'cookie-banner.html'), { config })
    : '';

  const headerHTML = buildHeader('');
  const footerHTML = buildFooter();

  return `<!DOCTYPE html>
<html lang="en">
<head>
${headHTML}
</head>
<body>
${headerHTML}
<main>
${bodyHTML}
</main>
${footerHTML}
${cookieScript}
</body>
</html>`;
}

function buildHeader(activeNav) {
  const items = NAV.map(item => {
    const key = item.label.toLowerCase().replace(/\s+/g, '-');
    const navMap = { 'breeding-calculator': 'calculator', 'breeding-tree': 'tree', 'pal-finder': 'finder', 'all-pals': 'pals', 'guides': 'guides', 'about': 'about' };
    const isActive = navMap[key] === activeNav;
    const strongStyle = item.strong ? ' style="font-weight:700"' : '';
    return `<a href="${item.href}"${isActive ? ' class="active" aria-current="page"' : ''}${strongStyle}>${item.label}</a>`;
  }).join('\n      ');

  return `<header class="site-header">
  <div class="container">
    <a href="/" class="header-logo" aria-label="${SITE_NAME} Home">
      <img src="/assets/logo-48.png" alt="" width="24" height="24" class="header-logo-img" aria-hidden="true">
      PALWORLDBASE
    </a>
    <nav class="header-nav" aria-label="Main navigation">
      ${items}
    </nav>
  </div>
</header>`;
}

function buildFooter() {
  const year = BUILD_YEAR;
  return `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="footer-brand-name">⚡ PALWORLDBASE</div>
        <p>PalworldBase.com is an independent Palworld database — peer-ranked Pal stats, skill builds, and breeding paths. Updated for ${BUILD_DATE}.</p>
      </div>
      <div class="footer-menu">
        <div class="footer-menu-label">TOOLS</div>
        <a href="/breeding-calculator/">Breeding Calculator</a>
        <a href="/breeding-tree/">Breeding Tree</a>
        <a href="/pal-finder/">Pal Finder</a>
        <a href="/pals/">All Pals</a>
        <a href="/guides/">Guides</a>
      </div>
      <div class="footer-menu">
        <div class="footer-menu-label">INFO</div>
        <a href="/about/">About</a>
        <a href="/privacy/">Privacy</a>
        <a href="/terms/">Terms</a>
        <a href="/cookie-policy/">Cookie Policy</a>
        <a href="/sitemap.xml">Sitemap</a>
      </div>
    </div>
    <div class="footer-bottom">
      &copy; ${year} PalworldBase. Not affiliated with Pocketpair. Palworld is a trademark of Pocketpair, Inc.
    </div>
  </div>
</footer>`;
}

// ---- Render Pal detail pages ----
console.log('\n⏳ Rendering Pal detail pages...');
const SITEMAP_ENTRIES = [];
let palPagesRendered = 0;

for (const pal of allPals) {
  const tier = palTiers[pal.slug] || 'B';
  const html = renderPalPage(pal, tier);
  const outDir = path.join(DIST_DIR, 'pals', pal.slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  palPagesRendered++;

  SITEMAP_ENTRIES.push({
    url: `${DOMAIN}/pals/${pal.slug}/`,
    tier,
    lastmod: BUILD_DATE,
  });
}
console.log(`  ${palPagesRendered} Pal pages (S: ${countTier('S')}, A: ${countTier('A')}, B: ${countTier('B')})`);

function countTier(t) {
  return allPals.filter(p => palTiers[p.slug] === t).length;
}

/**
 * Render a single Pal detail page.
 */
function renderPalPage(pal, tier) {
  const element = pal.classification.elements[0];
  // Use prime multipliers to spread variants — avoids clustering from similar Pal numbers
  const seed = typeof pal.number === 'number' ? pal.number : parseInt(pal.number, 10) || 0;
  const variant = seed % 4;          // 0-3: for sections with 3-4 variants
  const variantWide = (seed * 7) % 10; // 0-9: for title/description with 8-10 variants
  const variantAny = (seed * 13) % 12; // 0-11: for sections with many variants
  const peers = elementPeers[element] || [];

  // Title & Description (with rotation — variantWide gives 0-9 range for 8-10 templates)
  const title = tier === 'S' ? TITLE_TEMPLATES.palS(pal) :
                tier === 'A' ? TITLE_TEMPLATES.palA(pal) :
                TITLE_TEMPLATES.palB(pal, variantWide);

  const comboCount = (reverseIndex[pal.slug] || []).length;
  const description = generateDescription(pal, tier, variantWide, peers, comboCount);

  // Canonical URL
  const canonical = `${DOMAIN}/pals/${pal.slug}/`;

  // Head
  const headHTML = renderHead(config, {
    title,
    description,
    canonical,
    ogType: 'website',
    schema: palSchema(pal, canonical),
  });

  // Body sections
  const sections = [];

  // 1. Hero section
  sections.push(renderPalHero(pal, tier, variant, peers));

  // 2. Data-driven facts
  const palFacts = extractFacts(pal, elementPeers, variantAny);
  sections.push(renderFactsSection(pal, palFacts));

  // 2.5 Partner Skill — unique per Pal, 91% have unique names
  sections.push(renderPartnerSkill(pal));

  // 3. Stats comparison (S/A tier)
  if (tier !== 'B' && peers.length > 0) {
    const zResults = computeZScores(pal, peers);
    const rankResult = rankAmongPeers(pal, peers);
    sections.push(renderComparison(pal, tier, zResults, rankResult, variantAny, peers));
  }

  // 4. Skill builds (all tiers — variantAny seed for text diversity)
  const builds = computeAllBuilds(pal, variantAny);
  if (builds.length > 0) {
    sections.push(renderSkillBuilds(pal, tier, builds, variantAny));
  }

  // 4.5 Full active skills list — 59 unique skill set combinations across 323 Pals
  sections.push(renderAllSkills(pal));

  // 5. How to Breed
  sections.push(renderBreedingSection(pal, tier, variantAny));

  // 6. Work suitability
  sections.push(renderWorkSection(pal, tier, variantAny));

  // 7. Acquisition (B tier only — simpler location info)
  if (tier === 'B') {
    sections.push(renderAcquisition(pal, variantAny));
  }

  // 8. Drops (all tiers)
  if (pal.drops && pal.drops.length > 0) {
    sections.push(renderDrops(pal, tier, variantAny));
  }

  // 9. What's Next (all tiers)
  const bp = pal.breeding && pal.breeding.breedingPower;
  if (bp !== undefined) {
    const whatsNext = findWhatsNext(pal.slug, calculatorData.bpSorted.map((s, i) => ({
      slug: s,
      bp: calculatorData.palBP[s] || 0
    })), calculatorData.palBP, calculatorData.specialCombos, statsBySlug);
    if (whatsNext.length > 0) {
      sections.push(renderWhatsNext(pal, whatsNext, variantAny));
    }
  }

  // 10. Content Upgrade CTA
  sections.push(renderContentUpgradeCTA(pal, comboCount, variant));

  // Breadcrumb
  const breadcrumb = `<nav class="breadcrumb" aria-label="Breadcrumb">
  <a href="/">Home</a> <span class="separator">/</span>
  <a href="/pals/">All Pals</a> <span class="separator">/</span>
  <span class="current">${esc(pal.name.en)}</span>
</nav>`;

  const bodyHTML = `<div class="container container-narrow">
${breadcrumb}
${sections.join('\n')}
</div>`;

  return wrapPage(headHTML, bodyHTML);
}

// ---- Section rendering functions ----

function renderPalHero(pal, tier, variant, peers) {
  const element = pal.classification.elements[0];
  const elColor = ELEMENT_COLORS[element] ? element.toLowerCase() : 'neutral';
  const altText = getAltText(pal, variant);
  const rankResult = peers.length > 0 ? rankAmongPeers(pal, peers) : null;

  const rankingHTML = rankResult
    ? `<p class="pal-hero-ranking">#${rankResult.rank} of ${rankResult.total} ${element} Pals by total stats</p>`
    : '';

  return `<section class="pal-hero">
  <img src="/images/pals/${pal.slug}.webp"
       alt="${esc(altText)}"
       class="pal-hero-image"
       loading="eager"
       width="240" height="240"
       onerror="this.src='/images/pals/${pal.slug}.png'">
  <div class="pal-hero-info">
    <div class="pal-hero-meta">
      <span class="badge badge-tier-${tier.toLowerCase()}">Tier ${tier}</span>
      <span class="badge badge-element ${elColor}">${element}</span>
      <span class="badge badge-rarity-${pal.classification.rarity.toLowerCase()}">${pal.classification.rarity}</span>
      <span>Paldeck #${pal.number}</span>
    </div>
    <h1>${esc(pal.name.en)}</h1>
    ${rankingHTML}
    ${renderStatBars(pal.slug)}
  </div>
</section>`;
}

function renderFactsSection(pal, facts) {
  if (!facts || facts.length === 0) return '';
  return `<section class="section">
  <h2>About ${esc(pal.name.en)}</h2>
  <div class="glass-panel">
    ${facts.map(f => `<p>${esc(f)}</p>`).join('\n    ')}
  </div>
</section>`;
}

function renderPartnerSkill(pal) {
  const ps = pal.partnerSkill;
  if (!ps || !ps.name) return '';

  const hasDesc = ps.descriptionEn && ps.descriptionEn.length > 0;

  // Only show if we have meaningful data
  if (!hasDesc && ps.name.length < 2) return '';

  const descHTML = hasDesc
    ? `<p style="font-size:0.9375rem;color:var(--color-text);margin-bottom:12px">${esc(ps.descriptionEn)}</p>`
    : '';

  return `<section class="section">
  <h2>Partner Skill — ${esc(ps.name)}</h2>
  <div class="glass-panel">
    ${descHTML}
    <p style="font-size:0.8125rem;color:var(--color-text-muted)">
      🔧 Unlock by crafting ${esc(pal.name.en)}'s harness in the Technology menu.
    </p>
  </div>
</section>`;
}

function renderAllSkills(pal) {
  const skills = pal.skills || [];
  if (skills.length === 0) return '';

  // Build a full skill table
  const rows = skills.map((s, i) => {
    const el = (s.element || 'Neutral').toLowerCase();
    return `<tr>
      <td class="num">${s.level || '?'}</td>
      <td>${esc(s.name)}</td>
      <td><span class="badge badge-element ${el}">${s.element || 'Neutral'}</span></td>
      <td class="num">⚡${s.power || 0}</td>
      <td class="num">⏱${s.cooldown || 0}s</td>
    </tr>`;
  }).join('\n');

  return `<section class="section">
  <h2>All ${esc(pal.name.en)}'s Skills</h2>
  <div style="overflow-x:auto">
  <table class="data-table">
    <thead>
      <tr><th class="num">Lv</th><th>Skill</th><th>Element</th><th class="num">Power</th><th class="num">Cooldown</th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  </div>
  <p style="font-size:0.8125rem;color:var(--color-text-muted);margin-top:8px">
    ${skills.length} skill${skills.length > 1 ? 's' : ''} total — see the Skill Builds section above for optimal loadouts.
  </p>
</section>`;
}

function renderComparison(pal, tier, zResults, rankResult, variant, peers) {
  if (!zResults || !rankResult) return '';
  const heading = SECTION_HEADINGS.peerComparison[tier]
    ? SECTION_HEADINGS.peerComparison[tier](pal)
    : `${esc(pal.name.en)} Stats Compared`;

  const sentences = generateComparisonSentences(pal, zResults, rankResult, variant);

  // Build comparison table (top 5 + this Pal)
  const element = pal.classification.elements[0];
  const topPeers = peers.slice(0, 5);
  // Ensure this Pal is in the list
  const inList = topPeers.find(p => p.slug === pal.slug);
  const displayPeers = inList ? topPeers : [...topPeers.slice(0, 4), { slug: pal.slug, name: pal.name.en, statTotal: rankResult.statTotal, stats: pal.stats }];

  const rows = displayPeers.map((p, i) => {
    const isCurrent = p.slug === pal.slug;
    return `<tr${isCurrent ? ' class="current-row"' : ''}>
      <td>${i + 1}</td>
      <td>${isCurrent ? `<strong>${esc(p.name)}</strong>` : `<a href="/pals/${p.slug}/">${esc(p.name)}</a>`}</td>
      <td class="num">${p.stats.hp}</td>
      <td class="num">${p.stats.attack}</td>
      <td class="num">${p.stats.defense}</td>
      <td class="num">${p.stats.speed}</td>
      <td class="num highlight">${p.stats.hp + p.stats.attack + p.stats.defense + p.stats.speed}</td>
    </tr>`;
  }).join('\n');

  return `<section class="section">
  <h2>${heading}</h2>
  ${sentences.map(s => `<p>${esc(s)}</p>`).join('\n  ')}
  <div style="overflow-x:auto">
  <table class="data-table">
    <thead>
      <tr><th>#</th><th>Pal</th><th class="num">HP</th><th class="num">ATK</th><th class="num">DEF</th><th class="num">SPD</th><th class="num">Total</th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  </div>
</section>`;
}

function renderSkillBuilds(pal, tier, builds, variant) {
  const heading = SECTION_HEADINGS.skillBuilds[tier]
    ? SECTION_HEADINGS.skillBuilds[tier](pal)
    : `Skill Builds for ${esc(pal.name.en)}`;

  const buildCards = builds.map(build => {
    const skillsHTML = build.skills.map(s => {
      const adjPower = s.adjustedPower ? ` <small style="color:var(--color-accent)">→ ${s.adjustedPower}</small>` : '';
      return `<div class="skill-build-skill">
        <span>${esc(s.name)} <span class="badge badge-element ${(s.element||'neutral').toLowerCase()}">${s.element}</span></span>
        <span>⚡${s.power}${adjPower} · ⏱${s.cooldown}s · Lv${s.level}</span>
      </div>`;
    }).join('\n        ');

    const insightHTML = build.insight
      ? `<p class="skill-build-insight" style="font-size:0.75rem;color:var(--color-accent);margin-top:6px;padding-top:6px;border-top:1px solid var(--color-border);font-style:italic">💡 ${esc(build.insight)}</p>`
      : '';

    return `<div class="skill-build">
      <div class="skill-build-header">${build.name}</div>
      <p style="font-size:0.8125rem;color:var(--color-text-secondary);margin-bottom:12px">${build.description}</p>
      ${skillsHTML}
      <div class="skill-build-dps">
        Total Power: <strong>${build.totalPower}</strong> ·
        Rotation: <strong>${build.rotationCooldown}s</strong> ·
        DPS: <strong>${build.dps}</strong>
      </div>
      <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:8px">${build.strategy}</p>
      ${insightHTML}
    </div>`;
  }).join('\n      ');

  return `<section class="section">
  <h2>${heading}</h2>
  <div class="skill-builds">
    ${buildCards}
  </div>
</section>`;
}

function renderBreedingSection(pal, tier, variant) {
  const heading = SECTION_HEADINGS.breedingPath[tier]
    ? SECTION_HEADINGS.breedingPath[tier](pal)
    : `How to Breed ${esc(pal.name.en)}`;

  const pairs = getParentPairs(pal.slug, reverseIndex, tier === 'B' ? 10 : 8);

  if (pairs.length === 0) {
    return `<section class="section">
  <h2>${heading}</h2>
  <p>${esc(pal.name.en)} cannot be obtained through standard breeding. It must be captured in the wild or through special encounters.</p>
</section>`;
  }

  const pairHTML = pairs.map(p => {
    const diff1 = getBreedingDifficulty(p.parent1BP);
    const diff2 = getBreedingDifficulty(p.parent2BP);
    return `<div class="breeding-pair">
      <a href="/pals/${p.parent1}/" class="breeding-pair-parent">${esc(nameFromSlug(p.parent1))}</a>
      <span style="color:var(--color-text-muted);font-size:0.6875rem">${diff1.emoji} ${diff1.label}</span>
      <span class="breeding-pair-arrow">+</span>
      <a href="/pals/${p.parent2}/" class="breeding-pair-parent">${esc(nameFromSlug(p.parent2))}</a>
      <span style="color:var(--color-text-muted);font-size:0.6875rem">${diff2.emoji} ${diff2.label}</span>
      <span class="breeding-pair-arrow">→</span>
      <strong>${esc(pal.name.en)}</strong>
      ${p.isSpecial ? '<span class="badge badge-tier-s breeding-pair-badge">⭐ Special</span>' : ''}
    </div>`;
  }).join('\n');

  const totalPairs = (reverseIndex[pal.slug] || []).length;

  // Variant breeding intro — 6 phrasings rotated by variant
  const breedingIntros = [
    `${totalPairs} parent pairs can produce ${esc(pal.name.en)}. Here are the easiest combinations:`,
    totalPairs > 5
      ? `Want to breed ${esc(pal.name.en)}? Pick from ${totalPairs} possible parent combos — these are the simplest:`
      : `Only ${totalPairs} pairs can breed ${esc(pal.name.en)} — here ${totalPairs === 1 ? 'it is' : 'they are'}:`,
    `${esc(pal.name.en)} has ${totalPairs} breeding combinations. Start with these low-effort pairs:`,
    `${totalPairs} ways to get ${esc(pal.name.en)} through breeding. The easiest paths:`,
    `Breeding ${esc(pal.name.en)}: choose from ${totalPairs} parent pairs. These require the least setup:`,
    `Looking for ${esc(pal.name.en)}? ${totalPairs} breeding combos exist — try these first:`,
  ];

  return `<section class="section">
  <h2>${heading}</h2>
  <p>${breedingIntros[variant % breedingIntros.length]}</p>
  <div class="glass-panel">
    ${pairHTML}
  </div>
</section>`;
}

function nameFromSlug(slug) {
  const pal = palBySlug[slug];
  return pal ? pal.name.en : slug;
}

function renderWorkSection(pal, tier, variant) {
  const heading = SECTION_HEADINGS.workEfficiency[tier]
    ? (typeof SECTION_HEADINGS.workEfficiency[tier] === 'function'
        ? SECTION_HEADINGS.workEfficiency[tier](pal)
        : SECTION_HEADINGS.workEfficiency[tier])
    : 'Work Suitability';

  const works = Object.entries(pal.workSuitability || {})
    .filter(([, lv]) => lv > 0)
    .sort((a, b) => b[1] - a[1]);

  if (works.length === 0) {
    return `<section class="section">
  <h2>${heading}</h2>
  <p>${esc(pal.name.en)} has no base work suitability.</p>
</section>`;
  }

  const maxLevel = Math.max(...works.map(([, lv]) => lv));
  const workHTML = works.map(([work, level]) => {
    const label = WORK_LABELS[work] || work;
    const pct = Math.round((level / 4) * 100);
    const barClass = level >= 4 ? 'accent' : 'neutral';
    return `<div class="stat-bar">
      <span class="stat-bar-label">${label}</span>
      <div class="stat-bar-track">
        <div class="stat-bar-fill ${barClass}" style="width:${pct}%"></div>
      </div>
      <span class="stat-bar-value">Lv ${level}</span>
    </div>`;
  }).join('\n');

  // Natural-language work summary — unique per Pal
  const workTypes = works.map(([w, lv]) => `${WORK_LABELS[w] || w} (Lv ${lv})`);
  const bestWork = workTypes[0];
  const stageHint = (pal.decision && pal.decision.gameStage)
    ? (pal.decision.gameStage.early ? 'early-game' : pal.decision.gameStage.mid ? 'mid-game' : pal.decision.gameStage.late ? 'late-game' : '')
    : '';
  const stageNote = stageHint ? ` Best used in ${stageHint} bases.` : '';

  const workSummaryVariants = [
    `${esc(pal.name.en)} handles ${workTypes.length} work type${workTypes.length > 1 ? 's' : ''}: ${workTypes.join(', ')}.${stageNote}`,
    `Assign ${esc(pal.name.en)} to your base for ${bestWork}.${stageNote}`,
    works.length >= 3
      ? `${esc(pal.name.en)} is a versatile base Pal — covering ${workTypes.slice(0, 3).join(', ')}.${stageNote}`
      : `${esc(pal.name.en)} specializes in ${bestWork}.${stageNote}`,
    `${esc(pal.name.en)}'s best base role: ${bestWork}.${stageNote}`,
  ];

  const workSummary = `<p style="margin-top:12px;font-size:0.875rem;color:var(--color-text-secondary)">${workSummaryVariants[variant % workSummaryVariants.length]}</p>`;

  return `<section class="section">
  <h2>${heading}</h2>
  <div class="glass-panel">
    ${workHTML}
  </div>
  ${workSummary}
</section>`;
}

function renderAcquisition(pal, variant) {
  const heading = SECTION_HEADINGS.acquisition.B(pal);
  const acq = pal.acquisition || {};
  const habitats = acq.habitats || [];

  let content = '';

  // Pretty-print habitat names
  function formatHabitat(h) {
    return h.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  if (habitats.length > 0) {
    const prettyHabs = habitats.map(formatHabitat);
    const habIntroVariants = [
      `Found in: ${prettyHabs.join(', ')}.`,
      `Spawns in ${prettyHabs.slice(0, 3).join(', ')}${habitats.length > 3 ? ', and more' : ''}.`,
      `Look for ${esc(pal.name.en)} in ${prettyHabs.join(', ')}.`,
      `Habitat: ${prettyHabs.join(', ')}.`,
    ];
    content += `<p>${habIntroVariants[variant % habIntroVariants.length]}</p>`;
  }

  if (acq.isBossEncounter) {
    content += `<p>⚠️ Boss encounter — prepare for a challenging fight before attempting to capture.</p>`;
  }
  if (acq.isNocturnal) {
    content += `<p>🌙 Nocturnal — only appears at night.</p>`;
  }
  if (!acq.isCatchable && acq.isBreedable) {
    content += `<p>🔬 Not catchable in the wild — must be obtained through breeding.</p>`;
  }
  if (!content) {
    content = `<p>${esc(pal.name.en)} can be found in various locations across Palworld. Check your Paldeck for specific habitat markers.</p>`;
  }

  return `<section class="section">
  <h2>${heading}</h2>
  ${content}
</section>`;
}

function renderDrops(pal, tier, variant) {
  const heading = SECTION_HEADINGS.drops[tier]
    ? (typeof SECTION_HEADINGS.drops[tier] === 'function'
        ? SECTION_HEADINGS.drops[tier](pal)
        : SECTION_HEADINGS.drops[tier])
    : 'Drops & Materials';

  const rawDrops = pal.drops || [];
  const dropList = rawDrops.map(d =>
    typeof d === 'string' ? d : d.name || d.itemId || d.item
  ).filter(Boolean);

  if (dropList.length === 0) return '';

  // Natural-language drop intro — variant phrases
  const dropIntros = [
    `Defeating or capturing ${esc(pal.name.en)} yields:`,
    `${esc(pal.name.en)} drops the following materials:`,
    `You can farm these items from ${esc(pal.name.en)}:`,
    `Loot from ${esc(pal.name.en)}:`,
  ];

  return `<section class="section">
  <h2>${heading}</h2>
  <p>${dropIntros[variant % dropIntros.length]}</p>
  <div class="glass-panel">
    <ul style="list-style:disc;padding-left:20px">
      ${dropList.map(d => `<li>${esc(d)}</li>`).join('\n      ')}
    </ul>
  </div>
</section>`;
}

function renderWhatsNext(pal, children, variant) {
  const heading = SECTION_HEADINGS.whatsNext(pal);
  const childCards = children.map(c => `<div class="pal-card ${(c.childTier||'B').toLowerCase()}">
    <a href="/pals/${c.child}/" style="text-decoration:none;color:inherit">
      <div class="pal-card-name">${esc(c.childName)}</div>
      <div class="pal-card-badges">
        <span class="badge badge-tier-${(c.childTier||'b').toLowerCase()}">Tier ${c.childTier}</span>
        ${c.isSpecial ? '<span class="badge badge-element" style="background:var(--color-accent-dim);color:var(--color-accent)">⭐ Special</span>' : ''}
      </div>
      <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:8px">${c.reason}</div>
    </a>
  </div>`).join('\n');

  // Variant intro text for "What's Next"
  const whatsNextIntros = [
    `After you have ${esc(pal.name.en)}, breed it to produce these valuable Pals:`,
    `${esc(pal.name.en)} can be a stepping stone to stronger Pals. Breed it to get:`,
    `Use ${esc(pal.name.en)} as a breeding bridge to unlock these targets:`,
    `Got ${esc(pal.name.en)}? Pair it up to breed these higher-tier Pals:`,
  ];

  return `<section class="section">
  <h2>${heading}</h2>
  <p>${whatsNextIntros[variant % whatsNextIntros.length]}</p>
  <div class="pal-grid" style="grid-template-columns:repeat(3,1fr)">
    ${childCards}
  </div>
</section>`;
}

function renderContentUpgradeCTA(pal, comboCount, variant) {
  const ctaTemplate = CTA_TEMPLATES[variant % CTA_TEMPLATES.length];
  const ctaText = ctaTemplate(pal, comboCount);

  return `<section class="content-upgrade-cta">
  <p>${esc(ctaText)}</p>
  <a href="/breeding-calculator/?target=${pal.slug}" class="cta-button cta-button-lg">
    Open Breeding Calculator →
  </a>
</section>`;
}

function generateDescription(pal, tier, variant, peers, comboCount) {
  if (tier === 'S') {
    const rankResult = peers.length > 0 ? rankAmongPeers(pal, peers) : null;
    const topStat = rankResult ? 'total stats' : 'stats';
    const statVal = rankResult ? rankResult.rank : '?';
    if (variant % 2 === 0) {
      return DESC_TEMPLATES.sRanking(pal, statVal, topStat, statVal);
    } else {
      return DESC_TEMPLATES.sWork(pal, comboCount);
    }
  }

  if (tier === 'A') {
    const rankResult = peers.length > 0 ? rankAmongPeers(pal, peers) : null;
    const statVal = rankResult ? rankResult.rank : '?';
    const roles = pal.decision && pal.decision.bestFor ? pal.decision.bestFor.slice(0, 2) : ['combat'];

    const templates = [
      () => DESC_TEMPLATES.aRanking(pal, statVal, 'stats', comboCount),
      () => DESC_TEMPLATES.aVersatile(pal, roles, comboCount),
      () => DESC_TEMPLATES.aBreeding(pal, comboCount),
      () => DESC_TEMPLATES.aDefault(pal, comboCount),
    ];
    return templates[variant % 4]();
  }

  // B tier — 10 diverse description templates
  const bDescFns = [
    () => DESC_TEMPLATES.bBreeding(pal, comboCount),
    () => DESC_TEMPLATES.bAcquisition(pal),
    () => DESC_TEMPLATES.bData(pal, comboCount),
    () => DESC_TEMPLATES.bPartnerSkill(pal, comboCount),
    () => DESC_TEMPLATES.bWork(pal, comboCount),
    () => DESC_TEMPLATES.bMount(pal, comboCount),
    () => DESC_TEMPLATES.bGameStage(pal, comboCount),
    () => DESC_TEMPLATES.bDrops(pal, comboCount),
    () => DESC_TEMPLATES.bSize(pal, comboCount),
    () => DESC_TEMPLATES.bBreedingPower(pal, comboCount),
  ];
  return bDescFns[variant % bDescFns.length]();
}

// ---- Render Homepage ----
console.log('Rendering homepage...');
const homeHTML = renderHomepage();
fs.writeFileSync(path.join(DIST_DIR, 'index.html'), homeHTML);
SITEMAP_ENTRIES.push({ url: DOMAIN + '/', tier: 'S', lastmod: BUILD_DATE });
console.log('  dist/index.html');

function renderHomepage() {
  const title = TITLE_TEMPLATES.home;
  const description = 'Pal stats, skill builds, and breeding paths — peer-ranked, not raw stats. Breeding Calculator, Pal Finder, and guides for every Pal in Palworld.';
  const canonical = DOMAIN + '/';

  const headHTML = renderHead(config, {
    title,
    description,
    canonical,
    ogType: 'website',
    schema: websiteSchema(),
  });

  // Top 4 hot Pals (S-tier, sorted by stat total)
  const hotPals = allPals
    .filter(p => palTiers[p.slug] === 'S')
    .sort((a, b) => {
      const scoreA = statsBySlug[a.slug] ? statsBySlug[a.slug].statTotal : 0;
      const scoreB = statsBySlug[b.slug] ? statsBySlug[b.slug].statTotal : 0;
      return scoreB - scoreA;
    })
    .slice(0, 4);

  const hotCardsHTML = hotPals.map(pal => {
    const el = pal.classification.elements[0].toLowerCase();
    return `<div class="pal-card ${el}">
      <a href="/pals/${pal.slug}/" style="text-decoration:none;color:inherit">
        <img src="/images/pals/${pal.slug}.webp" alt="${esc(pal.name.en)}" class="pal-card-image" loading="lazy" onerror="this.src='/images/pals/${pal.slug}.png'">
        <div class="pal-card-name">${esc(pal.name.en)}</div>
        <div class="pal-card-number">#${pal.number} · ${pal.classification.elements[0]} · ${pal.classification.rarity}</div>
        <div class="pal-card-stats">
          <div class="pal-card-stat"><span>HP</span><span class="pal-card-stat-value">${pal.stats.hp}</span></div>
          <div class="pal-card-stat"><span>ATK</span><span class="pal-card-stat-value">${pal.stats.attack}</span></div>
          <div class="pal-card-stat"><span>DEF</span><span class="pal-card-stat-value">${pal.stats.defense}</span></div>
          <div class="pal-card-stat"><span>SPD</span><span class="pal-card-stat-value">${pal.stats.speed}</span></div>
        </div>
      </a>
    </div>`;
  }).join('\n        ');

  // Popular Pal chips (10 iconic Pals, no scroll)
  const popularSlugs = [
    'anubis', 'jormuntide_ignis', 'blazamut', 'jetragon', 'frostallion',
    'shadowbeak', 'orserk', 'bellanoir', 'lunaris', 'suzaku',
  ];
  const popularChipsHTML = popularSlugs.map(slug => {
    const p = palBySlug[slug];
    if (!p) return '';
    return `<a href="/breeding-calculator/?target=${slug}" class="hero-pal-chip">
      <div class="hero-pal-chip-circle">
        <img src="/images/pals/${slug}.webp" alt="${esc(p.name.en)}" loading="lazy" onerror="this.src='/images/pals/${slug}.png'">
      </div>
      <span class="hero-pal-chip-name">${esc(p.name.en)}</span>
    </a>`;
  }).join('\n          ');

  // Hidden select for SEO (Pal names stay in DOM, hidden visually)
  const palOptions = allPals
    .sort((a, b) => a.name.en.localeCompare(b.name.en))
    .map(p => `<option value="${p.slug}">${esc(p.name.en)}</option>`)
    .join('\n            ');

  const bodyHTML = `<section class="hero">
  <div class="container">
    <h1 class="hero-title">Your Complete Palworld Database — Stats, Breeding &amp; Guides</h1>
    <p class="hero-subtitle">Every Pal has a breeding path. Find yours.</p>
    <p class="hero-description">Built around what players actually look for: a breeding calculator with 51K+ combinations, peer-ranked Pal comparisons, skill builds, and strategy guides. Start with search, explore when you need detail.</p>

    <!-- Credibility Stats -->
    <div class="hero-stats">
      <div class="hero-stat">
        <div class="hero-stat-value">${allPals.length}</div>
        <div class="hero-stat-label">Pals</div>
      </div>
      <div class="hero-stat">
        <div class="hero-stat-value">51K+</div>
        <div class="hero-stat-label">Breeding Combos</div>
      </div>
      <div class="hero-stat">
        <div class="hero-stat-value">12</div>
        <div class="hero-stat-label">Work Types</div>
      </div>
      <div class="hero-stat">
        <div class="hero-stat-value">9</div>
        <div class="hero-stat-label">Elements</div>
      </div>
    </div>

    <!-- Search Pill (primary interaction) -->
    <div class="hero-search">
      <form action="/breeding-calculator/" method="GET" id="hero-search-form">
        <input type="text" id="hero-search-input" name="q"
               class="hero-search-pill" placeholder="Search any Pal by name or number…"
               autocomplete="off">
        <!-- Hidden select for SEO: all Pal name references stay in DOM -->
        <select id="hero-search-select" name="target" class="sr-only" aria-hidden="true">
          <option value="">Search all ${allPals.length} Pals…</option>
          ${palOptions}
        </select>
      </form>
    </div>

    <!-- Intent Pills (lightweight shortcuts, 6 across) -->
    <div class="hero-intents">
      <a href="/pal-finder/?work=mining,kindling,planting,gathering&sort=total" class="intent-pill">
        <span class="intent-pill-icon">🔨</span>
        <span class="intent-pill-label">Base</span>
      </a>
      <a href="/pal-finder/?sort=attack" class="intent-pill">
        <span class="intent-pill-icon">🛡️</span>
        <span class="intent-pill-label">Combat</span>
      </a>
      <a href="/breeding-calculator/" class="intent-pill">
        <span class="intent-pill-icon">🧬</span>
        <span class="intent-pill-label">Breed</span>
      </a>
      <a href="/guides/best-flying-mounts/" class="intent-pill">
        <span class="intent-pill-icon">⚡</span>
        <span class="intent-pill-label">Mounts</span>
      </a>
      <a href="/pal-finder/" class="intent-pill">
        <span class="intent-pill-icon">🔍</span>
        <span class="intent-pill-label">Browse</span>
      </a>
      <a href="/guides/" class="intent-pill">
        <span class="intent-pill-icon">📖</span>
        <span class="intent-pill-label">Guides</span>
      </a>
    </div>

    <!-- Popular Pal Chips (10, no scroll) -->
    <div class="hero-popular">
      <div class="hero-popular-label">Popular targets</div>
      <div class="hero-popular-row">
        ${popularChipsHTML}
      </div>
    </div>
  </div>
</section>

<section class="section section-showcase">
  <div class="container">
    <div class="section-intro">
      <div class="section-label">PAL SHOWCASE</div>
      <h2>Top-tier Pals</h2>
      <p class="section-desc">Highest-rated by peer comparison across all ${allPals.length} Pals.</p>
    </div>
    <div class="pal-grid">
      ${hotCardsHTML}
    </div>
    <div style="text-align:center;margin-top:var(--space-6)">
      <a href="/pals/" class="cta-button cta-button-secondary">Compare all ${allPals.length} Pals →</a>
    </div>
  </div>
</section>

<section class="section section-alt section-guides">
  <div class="container">
    <h2 style="text-align:center;margin-bottom:var(--space-2)">📖 Strategy Guides</h2>
    <p style="text-align:center;margin-bottom:var(--space-8);font-size:0.875rem;color:var(--color-text-secondary)">Not just stats — learn how to build, breed, and battle.</p>
    <div class="grid grid-2" style="gap:var(--space-4)">
      <a href="/guides/best-base-workers/" class="guide-card guide-card-accent" style="--guide-accent:var(--color-element-fire)">
        <div class="guide-card-icon">🏭</div>
        <h3>Best Base Workers</h3>
        <p>Mining, Kindling & every role — ranked by work level across all Pals.</p>
      </a>
      <a href="/guides/best-flying-mounts/" class="guide-card guide-card-accent" style="--guide-accent:var(--color-element-electric)">
        <div class="guide-card-icon">🦅</div>
        <h3>Fastest Flying Mounts</h3>
        <p>Speed ranking for every ridable flying Pal — with stamina comparison.</p>
      </a>
      <a href="/guides/best-combat-pals/" class="guide-card guide-card-accent" style="--guide-accent:var(--color-element-dragon)">
        <div class="guide-card-icon">⚔️</div>
        <h3>Best Combat Pals</h3>
        <p>DPS ranking by element — including skill builds and type matchups.</p>
      </a>
      <a href="/guides/breeding-explained/" class="guide-card guide-card-accent" style="--guide-accent:var(--color-accent)">
        <div class="guide-card-icon">🧬</div>
        <h3>Breeding Explained</h3>
        <p>BP formula, special combos, and how to plan chains with the Tree &amp; Calculator.</p>
      </a>
    </div>
  </div>
</section>

<section class="section section-about">
  <div class="container container-narrow">
    <div class="section-separator" aria-hidden="true">·  ·  ·</div>
    <h2>About PalworldBase.com</h2>
    <p>PalworldBase.com is an independent Palworld database — we don't just list raw stats. Every Pal is peer-ranked against others of the same element: you see not just its HP and Attack, but <em>how it compares</em> to every other Pal of its type.</p>
    <p>Our data comes from game files, verified against the Palworld community wiki, and cross-referenced for accuracy. We provide:</p>
    <ul style="list-style:disc;padding-left:20px;margin-bottom:var(--space-4);color:var(--color-text-secondary)">
      <li><strong>Breeding Calculator</strong> — 51K+ parent combinations, special combos, and best-path recommendations</li>
      <li><strong>Pal Finder</strong> — Filter ${allPals.length} Pals by element, work type, rarity, and mount capability</li>
      <li><strong>Skill Builds</strong> — Three builds per Pal: Burst (max damage), Sustain (best DPS), and STAB (same-type bonus)</li>
      <li><strong>Guides</strong> — Data-driven rankings for base workers, flying mounts, and combat Pals</li>
    </ul>
    <p>Updated for ${BUILD_DATE}. PalworldBase.com is not affiliated with Pocketpair, Inc. Palworld is a trademark of Pocketpair.</p>
  </div>
</section>

<script src="/assets/hero-home.js" defer></script>`;

  return wrapPage(headHTML, bodyHTML);
}

// ---- Render /pals/ overview ----
console.log('Rendering /pals/ overview...');
const palsIndexHTML = renderPalsIndex();
const palsIndexDir = path.join(DIST_DIR, 'pals');
fs.writeFileSync(path.join(palsIndexDir, 'index.html'), palsIndexHTML);
SITEMAP_ENTRIES.push({ url: DOMAIN + '/pals/', tier: 'A', lastmod: BUILD_DATE });
console.log('  dist/pals/index.html');

function renderPalsIndex() {
  const title = TITLE_TEMPLATES.palsIndex;
  const description = `Browse all ${allPals.length} Pals with images, element colors, and tier badges. Search by name, filter by element, sort by stats.`.substring(0, 155);
  const canonical = DOMAIN + '/pals/';
  const headHTML = renderHead(config, { title, description, canonical });

  // Element counts for filter chips
  const elIcons = { Fire:'🔥', Water:'💧', Grass:'🌿', Ground:'⛰', Electric:'⚡', Ice:'❄️', Dragon:'🐉', Dark:'🌑', Neutral:'⬜' };
  const elOrder = ['Fire','Water','Grass','Ground','Electric','Ice','Dragon','Dark','Neutral'];
  const elCounts = {};
  for (const p of allPals) {
    const el = p.classification.elements[0];
    elCounts[el] = (elCounts[el] || 0) + 1;
  }

  // Pre-compute stat totals for sorting
  const statTotals = {};
  for (const p of allPals) {
    statTotals[p.slug] = p.stats.hp + p.stats.attack + p.stats.defense + p.stats.speed;
  }

  // Static cards (no-JS fallback — all Pals, sorted by number)
  const staticCards = allPals.map(p => {
    const el = (p.classification.elements[0] || 'Neutral').toLowerCase();
    const tier = palTiers[p.slug] || 'B';
    const bp = calculatorData.palBP[p.slug];
    const bpDisplay = bp != null ? 'BP ' + bp : '';
    const total = statTotals[p.slug];
    return `<a href="/pals/${p.slug}/" class="pal-gallery-card ${el}" data-slug="${p.slug}"
              data-name="${esc(p.name.en).replace(/"/g, '&quot;')}" data-number="${p.number}"
              data-element="${el}" data-tier="${tier}" data-bp="${bp != null ? bp : ''}"
              data-total="${total}">
      <img src="/images/pals/${p.slug}.webp" alt="${esc(p.name.en)}" class="pal-gallery-card-img" loading="lazy"
           onerror="this.src='/images/pals/${p.slug}.png';this.onerror=null;this.src='/images/pals/_placeholder.png'">
      <span class="pal-gallery-card-name">${esc(p.name.en)}</span>
      <span class="pal-gallery-card-meta">#${p.number} · ${p.classification.elements[0]}</span>
      <span class="pal-gallery-card-badges">
        <span class="badge badge-tier-${tier.toLowerCase()}">${tier}</span>
        ${bpDisplay ? '<span class="pal-gallery-card-bp">' + bpDisplay + '</span>' : ''}
      </span>
    </a>`;
  }).join('\n');

  const bodyHTML = `<div class="container">
  <div class="page-header">
    <h1>📋 All ${allPals.length} Pals</h1>
    <p class="page-description">Browse every Pal — click for detailed stats, skill builds, and breeding paths.</p>
  </div>

  <div class="pal-gallery-toolbar">
    <div class="pal-gallery-search-wrap">
      <input type="text" id="pal-gallery-search" class="pal-gallery-search-input"
             placeholder="Search by name or number…" autocomplete="off">
    </div>
    <div class="pal-gallery-sort-wrap">
      <label for="pal-gallery-sort" class="pal-gallery-sort-label">Sort:</label>
      <select id="pal-gallery-sort" class="pal-gallery-sort-select">
        <option value="number">Number</option>
        <option value="name">Name</option>
        <option value="total">Stat Total ↓</option>
        <option value="bp">Breeding Power ↓</option>
      </select>
    </div>
  </div>

  <div class="pal-gallery-filters" id="pal-gallery-filters">
    <button class="pal-gallery-filter-chip active" data-filter="all">All (${allPals.length})</button>
    ${elOrder.map(el => {
      const count = elCounts[el] || 0;
      return '<button class="pal-gallery-filter-chip" data-filter="' + el.toLowerCase() + '">' + (elIcons[el] || '') + ' ' + el + ' (' + count + ')</button>';
    }).join('\n    ')}
  </div>

  <div class="pal-gallery-info" id="pal-gallery-info">
    Showing <strong id="pal-gallery-count">${allPals.length}</strong> Pals
  </div>

  <div class="pal-gallery-grid" id="pal-gallery-grid">
    ${staticCards}
  </div>
</div>

<script>
(function(){
  var grid = document.getElementById('pal-gallery-grid');
  var searchInput = document.getElementById('pal-gallery-search');
  var sortSelect = document.getElementById('pal-gallery-sort');
  var countEl = document.getElementById('pal-gallery-count');
  var filterChips = document.querySelectorAll('.pal-gallery-filter-chip');
  var activeFilter = 'all';

  if (!grid || !searchInput) return;

  // Get all cards
  var cards = Array.from(grid.querySelectorAll('.pal-gallery-card'));

  function filterAndSort() {
    var query = searchInput.value.trim().toLowerCase();

    cards.forEach(function(card) {
      var name = (card.dataset.name || '').toLowerCase();
      var number = card.dataset.number || '';
      var slug = card.dataset.slug || '';
      var el = card.dataset.element || '';

      var matchSearch = !query || name.indexOf(query) !== -1 || number.indexOf(query) !== -1 || slug.indexOf(query) !== -1;
      var matchFilter = activeFilter === 'all' || el === activeFilter;

      if (matchSearch && matchFilter) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });

    // Sort visible cards
    var sortBy = sortSelect.value;
    var visible = cards.filter(function(c) { return c.style.display !== 'none'; });

    if (sortBy === 'name') {
      visible.sort(function(a, b) { return (a.dataset.name || '').localeCompare(b.dataset.name || ''); });
    } else if (sortBy === 'number') {
      visible.sort(function(a, b) { return parseInt(a.dataset.number) - parseInt(b.dataset.number); });
    } else if (sortBy === 'total') {
      visible.sort(function(a, b) { return parseInt(b.dataset.total) - parseInt(a.dataset.total); });
    } else if (sortBy === 'bp') {
      visible.sort(function(a, b) { return (parseInt(a.dataset.bp) || 9999) - (parseInt(b.dataset.bp) || 9999); });
    }

    // Reorder in DOM
    visible.forEach(function(card) { grid.appendChild(card); });

    // Update count
    if (countEl) countEl.textContent = visible.length;

    // Show/hide hidden cards at end
    var hidden = cards.filter(function(c) { return c.style.display === 'none'; });
    hidden.forEach(function(card) { grid.appendChild(card); });
  }

  // Search
  searchInput.addEventListener('input', filterAndSort);

  // Sort
  if (sortSelect) {
    sortSelect.addEventListener('change', function() {
      // Update sort with arrows
      filterAndSort();
    });
  }

  // Filter chips
  filterChips.forEach(function(chip) {
    chip.addEventListener('click', function() {
      filterChips.forEach(function(c) { c.classList.remove('active'); });
      this.classList.add('active');
      activeFilter = this.dataset.filter;
      filterAndSort();
    });
  });

  // Handle URL param ?element=fire
  var params = new URLSearchParams(window.location.search);
  var elParam = params.get('element');
  if (elParam) {
    var targetChip = document.querySelector('.pal-gallery-filter-chip[data-filter="' + elParam.toLowerCase() + '"]');
    if (targetChip) targetChip.click();
  }
})();
</script>`;

  return wrapPage(headHTML, bodyHTML);
}

// ---- Render Guide pages ----
console.log('Rendering guides...');
const guides = [
  { slug: 'best-base-workers', title: TITLE_TEMPLATES.guide1, icon: '🏭', render: renderBaseWorkersGuide },
  { slug: 'best-flying-mounts', title: TITLE_TEMPLATES.guide2, icon: '🦅', render: renderFlyingMountsGuide },
  { slug: 'best-combat-pals', title: TITLE_TEMPLATES.guide3, icon: '⚔️', render: renderCombatGuide },
  { slug: 'breeding-explained', title: TITLE_TEMPLATES.guide4, icon: '🧬', render: renderBreedingGuide },
  { slug: 'ancient-bone', title: TITLE_TEMPLATES.guide5, icon: '🦴', render: renderAncientBoneGuide },
  { slug: 'legendary-merchants', title: TITLE_TEMPLATES.guide6, icon: '🛒', render: renderLegendaryMerchantsGuide },
];

for (const guide of guides) {
  const html = guide.render();
  const outDir = path.join(DIST_DIR, 'guides', guide.slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  SITEMAP_ENTRIES.push({ url: `${DOMAIN}/guides/${guide.slug}/`, tier: 'A', lastmod: BUILD_DATE });
  console.log(`  dist/guides/${guide.slug}/index.html`);
}
SITEMAP_ENTRIES.push({ url: DOMAIN + '/guides/', tier: 'A', lastmod: BUILD_DATE });

// Guide rendering functions (abbreviated for build.js size — full content)
function renderBaseWorkersGuide() {
  const title = TITLE_TEMPLATES.guide1;
  const description = `Every base work role in Palworld — ranked. Best Pals for Kindling, Watering, Planting, Mining, Handiwork, and more. Data-driven from ${allPals.length} Pals.`.substring(0, 155);
  const headHTML = renderHead(config, { title, description, canonical: DOMAIN + '/guides/best-base-workers/', ogType: 'article' });

  // Build work rankings
  const workSections = Object.entries(WORK_LABELS).map(([workKey, workLabel]) => {
    const ranked = allPals
      .filter(p => (p.workSuitability[workKey] || 0) >= 2)
      .sort((a, b) => (b.workSuitability[workKey] || 0) - (a.workSuitability[workKey] || 0))
      .slice(0, 10);

    if (ranked.length === 0) return '';

    const rows = ranked.map((p, i) => {
      const lv = p.workSuitability[workKey] || 0;
      const tier = palTiers[p.slug] || 'B';
      return `<tr>
        <td>${i + 1}</td>
        <td><a href="/pals/${p.slug}/">${esc(p.name.en)}</a></td>
        <td><span class="badge badge-tier-${tier.toLowerCase()}">${tier}</span></td>
        <td><strong>Lv ${lv}</strong></td>
        <td><span class="badge badge-element ${(p.classification.elements[0] || 'neutral').toLowerCase()}">${p.classification.elements[0] || 'Unknown'}</span></td>
      </tr>`;
    }).join('\n');

    return `<section class="section">
      <h3>Best ${workLabel} Pals</h3>
      <table class="data-table">
        <thead><tr><th>#</th><th>Pal</th><th>Tier</th><th>Level</th><th>Element</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
  }).filter(Boolean).join('\n');

  const bodyHTML = `<div class="container container-narrow">
    <div class="page-header">
      <h1>🏭 Best Base Workers</h1>
      <p class="page-description">Every work role ranked by level across all ${allPals.length} Pals. Data-driven, not opinion.</p>
    </div>
    <p>Efficient base management starts with assigning the right Pal to each job. Below, every work type is ranked by the highest-level Pals available — so you can build the most productive base in Palworld.</p>
    <section class="section">
      <h2>🌱 Early Game Picks</h2>
      <p>Just starting out? These Pals are easy to catch in the starting areas and will carry you through the early game until you can upgrade to the top-tier options above:</p>
      <table class="data-table">
        <thead><tr><th>Role</th><th>Best Early Pick</th><th>Level</th><th>Where to Find</th></tr></thead>
        <tbody>
          <tr><td>🔥 Kindling</td><td><a href="/pals/foxparks/">Foxparks</a></td><td>Lv 1</td><td>Starting area, common spawn</td></tr>
          <tr><td>💧 Watering</td><td><a href="/pals/pengullet/">Pengullet</a></td><td>Lv 1</td><td>Starting area, near water</td></tr>
          <tr><td>🌿 Planting</td><td><a href="/pals/gumoss/">Gumoss</a></td><td>Lv 1</td><td>Starting area, common spawn</td></tr>
          <tr><td>⛏️ Mining</td><td><a href="/pals/rushoar/">Rushoar</a></td><td>Lv 1</td><td>Starting area → upgrade to <a href="/pals/tombat/">Tombat</a> (Lv 2)</td></tr>
          <tr><td>🔧 Handiwork</td><td><a href="/pals/cattiva/">Cattiva</a></td><td>Lv 1</td><td>Everywhere — first catch</td></tr>
        </tbody>
      </table>
      <p style="font-size:0.875rem;color:var(--color-text-muted);margin-top:var(--space-2)">Once you unlock breeding, use the <a href="/breeding-tree/">Breeding Tree</a> to work toward the Lv 3–4 Pals in the rankings above.</p>
    </section>
    ${workSections}
    <p style="margin-top:var(--space-8);font-size:0.875rem;color:var(--color-text-muted)">
      Rankings updated ${BUILD_DATE} · Based on game data from ${allPals.length} Pals.
    </p>
  </div>`;
  return wrapPage(headHTML, bodyHTML);
}

function renderFlyingMountsGuide() {
  const title = TITLE_TEMPLATES.guide2;
  const description = `Every flying mount in Palworld ranked by speed. Compare stamina, sprint speed, and element bonuses across all ridable flying Pals.`.substring(0, 155);
  const headHTML = renderHead(config, { title, description, canonical: DOMAIN + '/guides/best-flying-mounts/', ogType: 'article' });

  const flyers = allPals
    .filter(p => p.classification.isFlyable)
    .sort((a, b) => b.stats.speed - a.stats.speed);

  const rows = flyers.map((p, i) => {
    const tier = palTiers[p.slug] || 'B';
    const el = p.classification.elements[0];
    return `<tr>
      <td>${i + 1}</td>
      <td><a href="/pals/${p.slug}/">${esc(p.name.en)}</a></td>
      <td>${p.stats.speed}</td>
      <td>${p.stats.stamina}</td>
      <td><span class="badge badge-element ${el.toLowerCase()}">${el}</span></td>
      <td><span class="badge badge-tier-${tier.toLowerCase()}">${tier}</span></td>
    </tr>`;
  }).join('\n');

  const bodyHTML = `<div class="container container-narrow">
    <div class="page-header">
      <h1>🦅 Fastest Flying Mounts</h1>
      <p class="page-description">All ${flyers.length} flying mounts ranked by speed — with stamina comparison.</p>
    </div>
    <p>Flying mounts are essential for fast traversal in Palworld. Speed determines how fast you move, while stamina affects how long you can stay airborne. Pick a mount that balances both for your playstyle.</p>
    <section class="section">
      <h2>🌱 Early Game Picks</h2>
      <p>Don't have Jetragon yet? Here's your upgrade path for flying mounts as you progress:</p>
      <table class="data-table">
        <thead><tr><th>Mount</th><th>Speed</th><th>Unlock Level</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td><a href="/pals/nitewing/">Nitewing</a></td><td>600</td><td>~Lv 15</td><td>Earliest flyer — catch one as soon as you can craft saddles</td></tr>
          <tr><td><a href="/pals/vanwyrm/">Vanwyrm</a></td><td>700</td><td>~Lv 20</td><td>Good mid-game upgrade, also a solid Kindling worker</td></tr>
          <tr><td><a href="/pals/beakon/">Beakon</a></td><td>1200</td><td>~Lv 30</td><td>Best pre-Jetragon flyer — doubles Nitewing's speed</td></tr>
          <tr><td><a href="/pals/ragnahawk/">Ragnahawk</a></td><td>1300</td><td>~Lv 35</td><td>Slightly faster than Beakon, also strong in combat</td></tr>
          <tr><td><a href="/pals/faleris/">Faleris</a></td><td>1400</td><td>~Lv 38</td><td>Top speed before Jetragon — can be bred early via <a href="/breeding-tree/?pal=faleris">breeding chain</a></td></tr>
        </tbody>
      </table>
      <p style="font-size:0.875rem;color:var(--color-text-muted);margin-top:var(--space-2)">💡 <strong>Tip</strong>: Faleris can be obtained much earlier than level 38 via breeding — check the <a href="/breeding-tree/?pal=faleris">Breeding Tree</a> for ⭐ Direct Catch pairs.</p>
    </section>
    <table class="data-table">
      <thead><tr><th>#</th><th>Pal</th><th>Speed</th><th>Stamina</th><th>Element</th><th>Tier</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:var(--space-8);font-size:0.875rem;color:var(--color-text-muted)">
      Rankings updated ${BUILD_DATE} · Based on game data from ${allPals.length} Pals.
    </p>
  </div>`;
  return wrapPage(headHTML, bodyHTML);
}

function renderCombatGuide() {
  const title = TITLE_TEMPLATES.guide3;
  const description = `Best combat Pals by element — DPS ranking, skill builds, and type matchups. Find the strongest ${allPals.filter(p => palTiers[p.slug] === 'S').length} S-tier Pals for every situation.`.substring(0, 155);
  const headHTML = renderHead(config, { title, description, canonical: DOMAIN + '/guides/best-combat-pals/', ogType: 'article' });

  // Top combat Pals by attack stat
  const combatPals = allPals
    .sort((a, b) => b.stats.attack - a.stats.attack)
    .slice(0, 20);

  const rows = combatPals.map((p, i) => {
    const tier = palTiers[p.slug] || 'B';
    const el = p.classification.elements[0];
    const statTotal = p.stats.hp + p.stats.attack + p.stats.defense + p.stats.speed;
    return `<tr>
      <td>${i + 1}</td>
      <td><a href="/pals/${p.slug}/">${esc(p.name.en)}</a></td>
      <td><strong>${p.stats.attack}</strong></td>
      <td>${p.stats.hp}</td>
      <td>${p.stats.defense}</td>
      <td>${statTotal}</td>
      <td><span class="badge badge-element ${el.toLowerCase()}">${el}</span></td>
      <td><span class="badge badge-tier-${tier.toLowerCase()}">${tier}</span></td>
    </tr>`;
  }).join('\n');

  const bodyHTML = `<div class="container container-narrow">
    <div class="page-header">
      <h1>⚔️ Best Combat Pals</h1>
      <p class="page-description">Top 20 combat Pals ranked by attack power — with full stat comparison and tier ratings.</p>
    </div>
    <p>Combat in Palworld depends on more than raw Attack. Consider HP for survivability, Speed for positioning, and element matchups for type advantage. Below, Pals are ranked by Attack — but check the total stats column for the complete picture.</p>
    <table class="data-table">
      <thead><tr><th>#</th><th>Pal</th><th>ATK</th><th>HP</th><th>DEF</th><th>Total</th><th>Element</th><th>Tier</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:var(--space-8);font-size:0.875rem;color:var(--color-text-muted)">
      Rankings updated ${BUILD_DATE} · Based on game data from ${allPals.length} Pals.
    </p>
  </div>`;
  return wrapPage(headHTML, bodyHTML);
}

function renderBreedingGuide() {
  const title = TITLE_TEMPLATES.guide4;
  const description = `How Palworld breeding works — the formula, breeding power, special combos, and how to use the Calculator to find the shortest breeding path.`.substring(0, 155);
  const headHTML = renderHead(config, { title, description, canonical: DOMAIN + '/guides/breeding-explained/', ogType: 'article' });

  const bodyHTML = `<div class="container container-narrow">
    <div class="page-header">
      <h1>🧬 Palworld Breeding Explained</h1>
      <p class="page-description">The formula, breeding power system, special combos, and how to plan your breeding chains.</p>
    </div>

    <section class="section">
      <h2>The Breeding Formula</h2>
      <p>When you breed two Pals, the child is determined by a simple formula:</p>
      <div class="glass-panel glass-panel-accent" style="text-align:center;padding:var(--space-8)">
        <p style="font-family:var(--font-display);font-size:1.25rem;color:var(--color-accent);margin-bottom:0">
          Child BP = ⌊(Parent A BP + Parent B BP) ÷ 2⌋
        </p>
        <p style="font-size:0.875rem;margin-top:var(--space-2)">The child is the Pal whose Breeding Power is closest to this average.</p>
      </div>
    </section>

    <section class="section">
      <h2>What is Breeding Power?</h2>
      <p>Every Pal has a hidden stat called <strong>Breeding Power</strong> (BP). It ranges from 1 (hardest to breed) to ~2520 (easiest). The BP determines which child is produced when two Pals are bred.</p>
      <p>Key points about Breeding Power:</p>
      <ul style="list-style:disc;padding-left:20px;margin-bottom:var(--space-4);color:var(--color-text-secondary)">
        <li>Low BP = late-game/legendary Pals (harder to use as breeding parents)</li>
        <li>High BP = early-game/common Pals (easier to catch and use in breeding)</li>
        <li>The average BP of two parents determines the child — always rounds down</li>
      </ul>
    </section>

    <section class="section">
      <h2>Special Combos</h2>
      <p>Some Pal variants can only be produced through specific parent combinations — these are called <strong>Special Combos</strong>. For example:</p>
      <ul style="list-style:disc;padding-left:20px;margin-bottom:var(--space-4);color:var(--color-text-secondary)">
        <li><strong>Frostallion Noct</strong> = Frostallion + Helzephyr (special combo)</li>
        <li><strong>Jormuntide Ignis</strong> = Jormuntide + Blazehowl (special combo)</li>
        <li><strong>Blazehowl Noct</strong> = Blazehowl + Felbat (special combo)</li>
      </ul>
      <p>Our Calculator automatically checks special combos first before applying the standard formula.</p>
    </section>

    <section class="section">
      <h2>Parent Pair Difficulty</h2>
      <p>Not all breeding pairs are equal. When looking at parents for your target Pal, they fall into three groups:</p>
      <div style="display:flex;flex-direction:column;gap:var(--space-3);margin:var(--space-4) 0">
        <div class="glass-panel" style="border-color:rgba(52,211,153,0.25);padding:var(--space-4)">
          <strong style="color:#34d399">⭐ Direct Catch</strong>
          <p style="margin:var(--space-1) 0 0;font-size:0.9375rem">Both parents are <strong>catch-only</strong> — they can't be produced through breeding. The simplest path: catch both, breed them together, done.</p>
        </div>
        <div class="glass-panel" style="border-color:rgba(240,192,64,0.2);padding:var(--space-4)">
          <strong style="color:#f0c040">⚡ Short Chain</strong>
          <p style="margin:var(--space-1) 0 0;font-size:0.9375rem">One parent must be <strong>bred first</strong>, the other can be caught directly. A two-step chain: breed the intermediate parent, then breed it with the caught parent for your target.</p>
        </div>
        <div class="glass-panel" style="border-color:rgba(144,152,168,0.15);padding:var(--space-4)">
          <strong style="color:var(--color-text-secondary)">🔴 Full Chain</strong>
          <p style="margin:var(--space-1) 0 0;font-size:0.9375rem">Both parents need breeding first. The longest path — but also the most options since each parent can be produced from multiple pairs.</p>
        </div>
      </div>
      <p>The <a href="/breeding-tree/">Breeding Tree</a> automatically groups all pairs this way — just search for your target Pal to see every option.</p>
    </section>

    <section class="section">
      <h2>Planning Your Breeding Chain</h2>
      <p>Two tools to plan your chain — use whichever fits your workflow:</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin:var(--space-4) 0">
        <div class="glass-panel glass-panel-accent" style="padding:var(--space-5)">
          <h3 style="font-size:1rem;margin-bottom:var(--space-2)">🧬 Calculator</h3>
          <p style="font-size:0.875rem;margin-bottom:var(--space-3)">Pick two parents → instantly see the child. Or pick a target → see the shortest breeding path with estimated steps.</p>
          <a href="/breeding-calculator/" class="cta-button" style="font-size:0.8125rem">Open Calculator →</a>
        </div>
        <div class="glass-panel glass-panel-accent" style="padding:var(--space-5)">
          <h3 style="font-size:1rem;margin-bottom:var(--space-2)">🌳 Breeding Tree</h3>
          <p style="font-size:0.875rem;margin-bottom:var(--space-3)">Search any target → see ALL parent pairs grouped by difficulty. Click 🔗 Trace to walk back the full chain.</p>
          <a href="/breeding-tree/" class="cta-button cta-button-secondary" style="font-size:0.8125rem">Open Tree →</a>
        </div>
      </div>
      <p>General strategy:</p>
      <ol style="list-style:decimal;padding-left:20px;margin-bottom:var(--space-4);color:var(--color-text-secondary)">
        <li>Pick your target Pal in the <a href="/breeding-tree/">Breeding Tree</a></li>
        <li>Start with ⭐ Direct Catch pairs if available — they require no chaining</li>
        <li>For ⚡ Short Chain pairs, use 🔗 Trace to see the full path</li>
        <li>Use the <a href="/breeding-calculator/">Calculator</a> to test specific parent combinations you're unsure about</li>
      </ol>
    </section>

    <section class="section">
      <h2>Frequently Asked Questions</h2>

      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What does \"catch-only\" mean in the Breeding Tree?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "A catch-only Pal is one that has zero breeding combinations that produce it — the only way to get it is to catch it in the wild. About 66 of the 323 Pals are catch-only. In the Breeding Tree, these show up as parents in ⭐ Direct Catch pairs (the easiest path)."
            }
          },
          {
            "@type": "Question",
            "name": "Can I breed Legendary Pals like Frostallion or Jetragon?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes, most Legendary Pals can be produced through breeding — but only from specific high-BP parents. For example, Frostallion (BP 260) can be bred from a wide range of parent combinations. However, these Legendary Pals are never \"catch-only\" parents themselves: they must be bred from other Pals first, so they always appear in 🔴 Full Chain pairs rather than ⭐ Direct Catch pairs."
            }
          },
          {
            "@type": "Question",
            "name": "Why do some Pals show zero ⭐ Recommended pairs?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "⭐ Recommended pairs require both parents to be catch-only (no breeding required). If a target Pal has a very low or very high Breeding Power, it may not have any catch-only Pal pair that averages to its BP. This is common for Legendary and late-game Pals. Try the ⚡ Short Chain or 🔴 Full Chain tabs instead — these show pairs where one or both parents need breeding first."
            }
          },
          {
            "@type": "Question",
            "name": "How many breeding steps does it take to get a specific Pal?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "It depends on the target Pal and which parent pair you choose. ⭐ Direct Catch pairs take 1 step (breed the two caught parents). ⚡ Short Chain pairs typically take 2 steps (breed one parent first, then breed that result with a caught Pal). 🔴 Full Chain pairs can take 3+ steps. Use the 🔗 Trace button in the Breeding Tree to see the exact chain for any pair — it walks back through every intermediate breeding step until all paths end at catch-only Pals."
            }
          },
          {
            "@type": "Question",
            "name": "What's the difference between the Calculator and the Breeding Tree?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "The Calculator answers two specific questions: \"What child do these two parents produce?\" and \"What's the shortest path to breed this target?\" The Breeding Tree answers a different question: \"Show me ALL possible parent pairs for this target, grouped by difficulty.\" Use the Tree to explore your options, then the Calculator to test specific combinations. Both tools share the same underlying data and respect special combos."
            }
          },
          {
            "@type": "Question",
            "name": "Does the order of parents matter in breeding?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "No. The breeding formula is symmetric: (Parent A BP + Parent B BP) ÷ 2 gives the same result regardless of which Pal is Parent A or Parent B. Special combos also work in either order — Frostallion + Helzephyr produces the same child as Helzephyr + Frostallion."
            }
          },
          {
            "@type": "Question",
            "name": "How long does breeding take?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Default breeding time is 5 minutes per egg in a Breeding Farm, but this varies with world settings. A large egg takes the same time as a regular egg — the timer starts when both parents are assigned to the farm. On dedicated servers, breeding continues even when you're offline. The real time investment isn't the egg timer — it's catching the right parents and planning the chain."
            }
          },
          {
            "@type": "Question",
            "name": "Can I breed for specific passive skills?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes! Passive skills are inherited randomly from parents during breeding. To pass down a desired passive, breed parents that have it — the more parents with the skill, the higher the chance. Pro tip: Lock in passives early in your chain. Start with catch-only parents that have the traits you want, then breed toward your target — this is much easier than trying to add passives at the last step."
            }
          }
        ]
      }
      </script>

      <div class="faq-list">
        <details class="faq-item">
          <summary class="faq-question">What does "catch-only" mean in the Breeding Tree?</summary>
          <div class="faq-answer">
            <p>A <strong>catch-only</strong> Pal is one that has zero breeding combinations that produce it — the only way to get it is to catch it in the wild. About 66 of the 323 Pals are catch-only. In the Breeding Tree, these show up as parents in ⭐ Direct Catch pairs (the easiest path).</p>
          </div>
        </details>
        <details class="faq-item">
          <summary class="faq-question">Can I breed Legendary Pals like Frostallion or Jetragon?</summary>
          <div class="faq-answer">
            <p>Yes, most Legendary Pals can be produced through breeding — but only from specific high-BP parents. For example, Frostallion (BP 260) can be bred from a wide range of parent combinations. However, these Legendary Pals are never "catch-only" parents themselves: they must be bred from other Pals first, so they always appear in 🔴 Full Chain pairs rather than ⭐ Direct Catch pairs.</p>
          </div>
        </details>
        <details class="faq-item">
          <summary class="faq-question">Why do some Pals show zero ⭐ Recommended pairs?</summary>
          <div class="faq-answer">
            <p>⭐ Recommended pairs require both parents to be catch-only (no breeding required). If a target Pal has a very low or very high Breeding Power, it may not have any catch-only Pal pair that averages to its BP. This is common for Legendary and late-game Pals. Try the <strong>⚡ Short Chain</strong> or <strong>🔴 Full Chain</strong> tabs instead — these show pairs where one or both parents need breeding first.</p>
          </div>
        </details>
        <details class="faq-item">
          <summary class="faq-question">How many breeding steps does it take to get a specific Pal?</summary>
          <div class="faq-answer">
            <p>It depends on the target Pal and which parent pair you choose. ⭐ Direct Catch pairs take <strong>1 step</strong> (breed the two caught parents). ⚡ Short Chain pairs typically take <strong>2 steps</strong> (breed one parent first, then breed that result with a caught Pal). 🔴 Full Chain pairs can take <strong>3+ steps</strong>. Use the 🔗 Trace button in the Breeding Tree to see the exact chain for any pair — it walks back through every intermediate breeding step until all paths end at catch-only Pals.</p>
          </div>
        </details>
        <details class="faq-item">
          <summary class="faq-question">What's the difference between the Calculator and the Breeding Tree?</summary>
          <div class="faq-answer">
            <p>The Calculator answers two specific questions: <em>"What child do these two parents produce?"</em> and <em>"What's the shortest path to breed this target?"</em> The Breeding Tree answers a different question: <em>"Show me ALL possible parent pairs for this target, grouped by difficulty."</em> Use the Tree to explore your options, then the Calculator to test specific combinations. Both tools share the same underlying data and respect special combos.</p>
          </div>
        </details>
        <details class="faq-item">
          <summary class="faq-question">Does the order of parents matter in breeding?</summary>
          <div class="faq-answer">
            <p>No. The breeding formula is symmetric: (Parent A BP + Parent B BP) ÷ 2 gives the same result regardless of which Pal is Parent A or Parent B. Special combos also work in either order — Frostallion + Helzephyr produces the same child as Helzephyr + Frostallion.</p>
          </div>
        </details>
        <details class="faq-item">
          <summary class="faq-question">How long does breeding take?</summary>
          <div class="faq-answer">
            <p>Default breeding time is <strong>5 minutes</strong> per egg in a Breeding Farm, but this varies with world settings. A large egg takes the same time as a regular egg — the timer starts when both parents are assigned to the farm. On dedicated servers, breeding continues even when you're offline. The real time investment isn't the egg timer — it's catching the right parents and planning the chain.</p>
          </div>
        </details>
        <details class="faq-item">
          <summary class="faq-question">Can I breed for specific passive skills?</summary>
          <div class="faq-answer">
            <p>Yes! Passive skills are inherited randomly from parents during breeding. To pass down a desired passive, breed parents that have it — the more parents with the skill, the higher the chance. <strong>Pro tip</strong>: Lock in passives early in your chain. Start with catch-only parents that have the traits you want, then breed toward your target — this is much easier than trying to add passives at the last step. The Calculator and Breeding Tree focus on which Pals to breed, not passives — check the Pal Finder to filter by stats and find ideal trait donors.</p>
          </div>
        </details>
      </div>
    </section>

    <section class="content-upgrade-cta">
      <p>Ready to plan your breeding chain? Explore all ${Object.keys(reverseIndex).length} breedable Pals with the Breeding Tree or Calculator.</p>
      <a href="/breeding-tree/" class="cta-button cta-button-lg">🌳 Open Breeding Tree →</a>
      <a href="/breeding-calculator/" class="cta-button cta-button-lg cta-button-secondary" style="margin-left:var(--space-2)">🧬 Open Calculator →</a>
    </section>
  </div>`;
  return wrapPage(headHTML, bodyHTML);
}

function renderAncientBoneGuide() {
  const title = TITLE_TEMPLATES.guide5;
  const description = `Where to get Ancient Bone in Palworld — Wildlife Sanctuary No. 3 location, coordinates, fastest route, farming loop, and patrol tips.`.substring(0, 155);
  const headHTML = renderHead(config, { title, description, canonical: DOMAIN + '/guides/ancient-bone/', ogType: 'article' });

  const bodyHTML = `<div class="container container-narrow">
    <div class="page-header">
      <h1>🦴 Where to Find Ancient Bone</h1>
      <p class="page-description">Location, route, and farm guide — everything you need to gather Ancient Bone fast.</p>
    </div>

    <section class="section">
      <div class="glass-panel glass-panel-accent" style="padding:var(--space-5)">
        <strong style="color:var(--color-accent);text-transform:uppercase;letter-spacing:0.05em;font-size:0.75rem">⚡ Quick Answer</strong>
        <p style="margin:var(--space-2) 0 0;font-size:1rem">Ancient Bone is mined from <strong>fossilized skeleton nodes</strong> at <strong>Wildlife Sanctuary No. 3</strong> in the northeast of the map. Fast-travel to <strong>Deep Sand Dunes</strong>, fly northeast to the sanctuary, and mine the large ribcage-shaped formations.</p>
      </div>
    </section>

    <section class="section">
      <div class="glass-panel glass-panel-accent" style="padding:var(--space-5)">
        <h2 style="font-size:1.05rem;margin:0 0 var(--space-1)">📍 Ancient Bone Location Finder</h2>
        <p style="font-size:0.875rem;color:var(--color-text-secondary);margin:0 0 var(--space-3)">Everything you need in one place:</p>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:var(--space-2)">
          <li>✓ <strong>Wildlife Sanctuary No. 3</strong></li>
          <li>✓ Resource node markers — fossilized skeleton / ribcage</li>
          <li>✓ Coordinates ≈ <strong>652, 626</strong></li>
          <li>✓ Fast-travel starting point — <strong>Deep Sand Dunes</strong></li>
        </ul>
      </div>
    </section>

    <section class="section">
      <h2>🗺️ Ancient Bone Location — Wildlife Sanctuary No. 3</h2>
      <figure style="margin:var(--space-4) 0">
        <img src="/images/guides/ancient-bone-map.webp" alt="Palworld wildlife sanctuary map — Ancient Bone is mined at No. 3 Wildlife Sanctuary in the northeast" style="width:100%;height:auto;border-radius:8px" loading="lazy" onerror="this.src='/images/guides/ancient-bone-map.png'">
        <figcaption style="font-size:0.8125rem;color:var(--color-text-muted);margin-top:var(--space-2);text-align:center">Wildlife Sanctuary map — Ancient Bone nodes are at No. 3 (northeast).</figcaption>
      </figure>
      <table class="data-table">
        <thead><tr><th>Detail</th><th>Answer</th></tr></thead>
        <tbody>
          <tr><td>Main location</td><td><strong>Wildlife Sanctuary No. 3</strong></td></tr>
          <tr><td>Region</td><td>Northeast</td></tr>
          <!-- ⚠️ VERIFY: coordinates below — confirm against current game version before publish -->
          <tr><td>Approx. coordinates</td><td><strong>652, 626</strong></td></tr>
          <tr><td>Starting point</td><td>Deep Sand Dunes</td></tr>
          <tr><td>Node appearance</td><td>Large fossilized skeleton / ribcage</td></tr>
        </tbody>
      </table>
      <p style="margin-top:var(--space-3)">Note: there is <strong>no fast-travel point inside Wildlife Sanctuary No. 3</strong> — you must fly in from a nearby point such as Deep Sand Dunes.</p>
    </section>

    <section class="section">
      <h2>🛣️ How to Reach Ancient Bone — Fastest Route</h2>
      <ol style="list-style:decimal;padding-left:20px;margin-bottom:var(--space-4);color:var(--color-text-secondary)">
        <li>Fast-travel to <strong>Deep Sand Dunes</strong></li>
        <li>Fly <strong>northeast</strong></li>
        <li>Land at <strong>Wildlife Sanctuary No. 3</strong></li>
        <li>Find the fossil nodes along the outer edge and central area</li>
      </ol>
    </section>

    <section class="section">
      <h2>🦴 What Ancient Bone Looks Like</h2>
      <p>Ancient Bone is <strong>not ordinary ore</strong> — look for large skeleton-shaped resource nodes:</p>
      <ul style="list-style:disc;padding-left:20px;margin-bottom:var(--space-4);color:var(--color-text-secondary)">
        <li>Giant ribcages</li>
        <li>Large fossilized bones</li>
        <li>Skeleton-shaped resource nodes</li>
      </ul>
      <figure style="margin:var(--space-4) 0">
        <img src="/images/guides/ancient-bone-icon.png" alt="Ancient Bone material icon" style="max-width:96px;width:100%;height:auto" loading="lazy">
        <figcaption style="font-size:0.8125rem;color:var(--color-text-muted);margin-top:var(--space-2)">Ancient Bone — material icon. In the wild, look for the large ribcage-shaped skeleton nodes described above.</figcaption>
      </figure>
    </section>

    <section class="section">
      <h2>⛏️ How to Farm Ancient Bone</h2>
      <p><strong>Recommended setup:</strong></p>
      <ul style="list-style:disc;padding-left:20px;margin-bottom:var(--space-4);color:var(--color-text-secondary)">
        <li>A fast flying mount — see the <a href="/guides/best-flying-mounts/">Fastest Flying Mounts</a> guide</li>
        <li>Pickaxe or Plasma Multicutter</li>
        <li>Empty inventory space</li>
      </ul>
      <p><strong>Farming route:</strong></p>
      <ol style="list-style:decimal;padding-left:20px;margin-bottom:var(--space-4);color:var(--color-text-secondary)">
        <li>Enter the sanctuary</li>
        <li>Follow the outer area</li>
        <li>Mine the visible skeleton nodes</li>
        <li>Move toward the central area</li>
        <li>Leave and repeat</li>
      </ol>
    </section>

    <section class="section">
      <h2>🚨 How to Avoid the Sanctuary Patrols</h2>
      <ul style="list-style:disc;padding-left:20px;margin-bottom:var(--space-4);color:var(--color-text-secondary)">
        <li>Watch for the red spotlights</li>
        <li>Stay airborne when practical</li>
        <li>Mine after a patrol passes</li>
        <li>Leave instead of fighting unnecessary enemies</li>
      </ul>
    </section>

    <section class="section">
      <h2>🔧 What Is Ancient Bone Used For?</h2>
      <!-- ⚠️ VERIFY: recipe item names & quantities below — confirm against current game data before publish -->
      <table class="data-table">
        <thead><tr><th>Item</th><th>Ancient Bone Needed</th></tr></thead>
        <tbody>
          <tr><td>Air Walker EX</td><td>60</td></tr>
          <tr><td>Air Walker Mk III</td><td>30</td></tr>
        </tbody>
      </table>
    </section>

    <section class="section">
      <h2>Frequently Asked Questions</h2>

      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Where can I find Ancient Bone in Palworld?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Ancient Bone is found at Wildlife Sanctuary No. 3 in the northeast of the map. Fast-travel to Deep Sand Dunes and fly northeast to reach the sanctuary, then mine the large fossilized skeleton nodes — approximate coordinates 652, 626."
            }
          },
          {
            "@type": "Question",
            "name": "What Wildlife Sanctuary has Ancient Bone?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Wildlife Sanctuary No. 3 is the sanctuary with Ancient Bone. It sits in the northeast region of the map, reached by flying from a nearby northern fast-travel point such as Deep Sand Dunes."
            }
          },
          {
            "@type": "Question",
            "name": "Can Pals drop Ancient Bone?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Ancient Bone is primarily gathered from fossilized skeleton resource nodes rather than dropped by specific Pals. The sanctuary nodes are the reliable source for farming the material."
            }
          },
          {
            "@type": "Question",
            "name": "Can you buy Ancient Bone?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Ancient Bone is primarily a node-gathered material rather than a purchasable item. Head to Wildlife Sanctuary No. 3 and mine the fossilized skeleton nodes to farm it."
            }
          }
        ]
      }
      </script>

      <div class="faq-list">
        <details class="faq-item">
          <summary class="faq-question">Where can I find Ancient Bone in Palworld?</summary>
          <div class="faq-answer">
            <p>Ancient Bone is found at <strong>Wildlife Sanctuary No. 3</strong> in the northeast of the map. Fast-travel to Deep Sand Dunes and fly northeast to reach the sanctuary, then mine the large fossilized skeleton nodes — approximate coordinates <strong>652, 626</strong>.</p>
          </div>
        </details>
        <details class="faq-item">
          <summary class="faq-question">What Wildlife Sanctuary has Ancient Bone?</summary>
          <div class="faq-answer">
            <p><strong>Wildlife Sanctuary No. 3</strong> is the sanctuary with Ancient Bone. It sits in the northeast region of the map, reached by flying from a nearby northern fast-travel point such as Deep Sand Dunes.</p>
          </div>
        </details>
        <details class="faq-item">
          <summary class="faq-question">Can Pals drop Ancient Bone?</summary>
          <div class="faq-answer">
            <p>Ancient Bone is primarily gathered from <strong>fossilized skeleton resource nodes</strong> rather than dropped by specific Pals. The sanctuary nodes are the reliable source for farming the material.</p>
          </div>
        </details>
        <details class="faq-item">
          <summary class="faq-question">Can you buy Ancient Bone?</summary>
          <div class="faq-answer">
            <p>Ancient Bone is primarily a node-gathered material rather than a purchasable item. Head to Wildlife Sanctuary No. 3 and mine the fossilized skeleton nodes to farm it.</p>
          </div>
        </details>
      </div>
    </section>

    <section class="content-upgrade-cta">
      <p>Farming Ancient Bone is far faster with a good flying mount. See the full speed ranking.</p>
      <a href="/guides/best-flying-mounts/" class="cta-button cta-button-lg">🦅 Open Flying Mounts Guide →</a>
    </section>
  </div>`;
  return wrapPage(headHTML, bodyHTML);
}

function renderLegendaryMerchantsGuide() {
  const title = TITLE_TEMPLATES.guide6;
  const description = `How Palworld 1.0's 18 specialized visiting merchants work — all six categories, what they sell, how to spawn and reroll them, and how to capture one.`.substring(0, 155);
  const headHTML = renderHead(config, { title, description, canonical: DOMAIN + '/guides/legendary-merchants/', ogType: 'article' });

  const bodyHTML = `<div class="container container-narrow">
    <div class="page-header">
      <h1>🛒 Palworld Legendary Merchants</h1>
      <p class="page-description">All six specialized visiting-merchant categories — how to spawn, reroll, and capture the one you want.</p>
    </div>

    <section class="section">
      <div class="glass-panel glass-panel-accent" style="padding:var(--space-5)">
        <strong style="color:var(--color-accent);text-transform:uppercase;letter-spacing:0.05em;font-size:0.75rem">⚡ Quick Answer</strong>
        <p style="margin:var(--space-2) 0 0;font-size:1rem">Palworld 1.0 added <strong>18 specialized visiting merchants</strong> across six categories — <strong>meat, vegetables, ammo, medicine, food, and Pal materials</strong>. They arrive at your base through visitor events, and you can reroll or capture the one you want.</p>
      </div>
    </section>

    <section class="section">
      <h2>🔁 How Legendary Merchants Work</h2>
      <p>These are <strong>visitor NPCs</strong>, not the fixed settlement merchants you find on the map. The flow looks like this:</p>
      <ol style="list-style:decimal;padding-left:20px;margin-bottom:var(--space-4);color:var(--color-text-secondary)">
        <li>Build a base with a <strong>Palbox</strong></li>
        <li>Wait for a <strong>visitor event</strong></li>
        <li>The merchant appears at your base</li>
        <li>Identify the merchant type</li>
        <li>Keep it, reroll it, or capture it</li>
      </ol>
      <p>Which merchants can appear depends on your <strong>base level</strong> — higher-level bases unlock more specialized (and rarer) merchant types.</p>
    </section>

    <section class="section">
      <h2>📋 The Six Merchant Categories</h2>
      <p>The 18 specialized visiting merchants fall into six categories. Rather than memorizing individual names, match the category to what you need:</p>
      <table class="data-table">
        <thead><tr><th>Category</th><th>What They Sell</th><th>Best For</th></tr></thead>
        <tbody>
          <tr><td><strong>Meat</strong></td><td>Meat and hunting supplies</td><td>Meat-based cooking recipes</td></tr>
          <tr><td><strong>Vegetables</strong></td><td>Vegetables and crop seeds</td><td>Farming and recipe ingredients</td></tr>
          <tr><td><strong>Ammo</strong></td><td>Ammunition and ranged-weapon supplies</td><td>Keeping guns and bows stocked</td></tr>
          <tr><td><strong>Medicine</strong></td><td>Medical supplies and healing items</td><td>Recovering from fights and status effects</td></tr>
          <tr><td><strong>Food</strong></td><td>Prepared food and cooking ingredients</td><td>Ready-made meals without the cooking step</td></tr>
          <tr><td><strong>Pal Materials</strong></td><td>Pal crafting materials (Paldium, bones, organs)</td><td>Crafting gear and base upgrades</td></tr>
        </tbody>
      </table>
    </section>

    <section class="section">
      <h2>🏗️ How to Spawn &amp; Reroll Legendary Merchants</h2>
      <p>You don't find these merchants at a fixed spot — you make them come to you:</p>
      <ul style="list-style:disc;padding-left:20px;margin-bottom:var(--space-4);color:var(--color-text-secondary)">
        <li><strong>Build a Palbox</strong> in an open area (a dedicated spawn base works best)</li>
        <li><strong>Raise your base level</strong> to unlock more specialized merchant types</li>
        <li><strong>Wait for a visitor event</strong> to bring a merchant to the base</li>
        <li><strong>Reroll if needed</strong>: dismantle the Palbox and rebuild it to force a new visitor event, repeating until the merchant type you want appears</li>
      </ul>
      <p style="font-size:0.875rem;color:var(--color-text-muted)">Don't confuse these visiting merchants with <strong>wandering merchants</strong> or <strong>fixed settlement merchants</strong> — the latter are map NPCs, while legendary merchants are visitor events at your own base.</p>
    </section>

    <section class="section">
      <h2>🎯 How to Capture a Legendary Merchant</h2>
      <p>The merchant arriving is only half the battle — capturing one takes preparation:</p>
      <ul style="list-style:disc;padding-left:20px;margin-bottom:var(--space-4);color:var(--color-text-secondary)">
        <li>Bring <strong>high-level Spheres</strong> — these merchants have high capture resistance</li>
        <li>Clear or control the merchant's <strong>high-level guards</strong> first</li>
        <li>Watch for a <strong>Wanted level</strong> — the attempt can alert PIDF</li>
        <li>Avoid letting your whole base's Pals join the fight</li>
        <li>Once captured, the merchant can serve as a <strong>permanent merchant</strong> in your base</li>
      </ul>
    </section>

    <section class="section">
      <h2>✅ Which Merchant Should You Get?</h2>
      <p>There's no single best merchant — it depends on what you're short on:</p>
      <ul style="list-style:disc;padding-left:20px;margin-bottom:var(--space-4);color:var(--color-text-secondary)">
        <li><strong>Best for ammo</strong> → Ammo merchants</li>
        <li><strong>Best for food</strong> → Food merchants</li>
        <li><strong>Best for materials</strong> → Pal Material merchants</li>
        <li><strong>Best for meat</strong> → Meat merchants</li>
        <li><strong>Best for medicine</strong> → Medicine merchants</li>
        <li><strong>Best for farming</strong> → Vegetable merchants</li>
      </ul>
    </section>

    <section class="section">
      <h2>🔎 Legendary Merchant Finder</h2>
      <p>Tell us what you need and we'll point you to the right merchant category.</p>
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin:var(--space-3) 0">
        <button type="button" class="finder-btn" data-cat="Ammo" style="padding:var(--space-2) var(--space-4);border:1px solid var(--color-accent);border-radius:999px;background:transparent;color:var(--color-accent);cursor:pointer;font-size:0.875rem">Ammo</button>
        <button type="button" class="finder-btn" data-cat="Food" style="padding:var(--space-2) var(--space-4);border:1px solid var(--color-accent);border-radius:999px;background:transparent;color:var(--color-accent);cursor:pointer;font-size:0.875rem">Food</button>
        <button type="button" class="finder-btn" data-cat="Materials" style="padding:var(--space-2) var(--space-4);border:1px solid var(--color-accent);border-radius:999px;background:transparent;color:var(--color-accent);cursor:pointer;font-size:0.875rem">Materials</button>
        <button type="button" class="finder-btn" data-cat="Medicine" style="padding:var(--space-2) var(--space-4);border:1px solid var(--color-accent);border-radius:999px;background:transparent;color:var(--color-accent);cursor:pointer;font-size:0.875rem">Medicine</button>
        <button type="button" class="finder-btn" data-cat="Vegetables" style="padding:var(--space-2) var(--space-4);border:1px solid var(--color-accent);border-radius:999px;background:transparent;color:var(--color-accent);cursor:pointer;font-size:0.875rem">Vegetables</button>
        <button type="button" class="finder-btn" data-cat="Meat" style="padding:var(--space-2) var(--space-4);border:1px solid var(--color-accent);border-radius:999px;background:transparent;color:var(--color-accent);cursor:pointer;font-size:0.875rem">Meat</button>
      </div>
      <div id="finder-result" class="glass-panel" style="padding:var(--space-4)">
        <p style="margin:0;color:var(--color-text-muted)">Select a need above to see the matching merchant category.</p>
      </div>
      <script>
      (function () {
        var data = {
          Ammo: { sell: 'ammunition and ranged-weapon supplies', use: 'keeping guns and bows stocked' },
          Food: { sell: 'prepared food and cooking ingredients', use: 'ready-made meals without the cooking step' },
          Materials: { sell: 'Pal crafting materials like Paldium, bones, and organs', use: 'crafting gear and base upgrades' },
          Medicine: { sell: 'medical supplies and healing items', use: 'recovering from fights and status effects' },
          Vegetables: { sell: 'vegetables and crop seeds', use: 'farming and recipe ingredients' },
          Meat: { sell: 'meat and hunting supplies', use: 'meat-based cooking recipes' }
        };
        var result = document.getElementById('finder-result');
        document.querySelectorAll('.finder-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var cat = btn.getAttribute('data-cat');
            var d = data[cat];
            result.innerHTML = '<p style="margin:0"><strong>' + cat + ' merchants</strong> sell ' + d.sell + '.</p>' +
              '<p style="margin:var(--space-2) 0 0;color:var(--color-text-secondary)">Best for ' + d.use + '.</p>' +
              '<p style="margin:var(--space-2) 0 0;color:var(--color-text-secondary)">Spawn them by raising your base level, waiting for a visitor event at your Palbox, and rerolling until the right merchant appears.</p>';
          });
        });
      })();
      </script>
    </section>

    <section class="section">
      <h2>Frequently Asked Questions</h2>

      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How do you get Legendary Merchants in Palworld?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "They appear as visitor events at your base's Palbox. Raise your base level to unlock more specialized merchant types, then wait for a visiting merchant to arrive. If it's not the one you want, reroll by dismantling and rebuilding the Palbox."
            }
          },
          {
            "@type": "Question",
            "name": "Do Legendary Merchants have fixed locations?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "No. Legendary (specialized visiting) merchants are visitor NPCs, not fixed settlement merchants. They arrive at your base through visitor events rather than spawning at fixed map locations."
            }
          },
          {
            "@type": "Question",
            "name": "Can you capture Legendary Merchants?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes, but be prepared: they arrive with high-level guards, and attempting a capture can trigger a Wanted level with PIDF. Bring high-level Spheres and clear or control the guards first."
            }
          },
          {
            "@type": "Question",
            "name": "How do you reroll Legendary Merchant spawns?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "The common method is the temporary Palbox strategy — dismantle your Palbox and rebuild it to force a new visitor event, repeating until the merchant type you want appears."
            }
          },
          {
            "@type": "Question",
            "name": "Which Legendary Merchant is best?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "There's no single best — it depends on what you need. Ammo merchants are best for keeping weapons stocked, food merchants for ready meals, and Pal material merchants for crafting supplies."
            }
          }
        ]
      }
      </script>

      <div class="faq-list">
        <details class="faq-item">
          <summary class="faq-question">How do you get Legendary Merchants in Palworld?</summary>
          <div class="faq-answer">
            <p>They appear as <strong>visitor events</strong> at your base's Palbox. Raise your base level to unlock more specialized merchant types, then wait for a visiting merchant to arrive. If it's not the one you want, reroll by dismantling and rebuilding the Palbox.</p>
          </div>
        </details>
        <details class="faq-item">
          <summary class="faq-question">Do Legendary Merchants have fixed locations?</summary>
          <div class="faq-answer">
            <p>No. Legendary (specialized visiting) merchants are <strong>visitor NPCs</strong>, not fixed settlement merchants. They arrive at your base through visitor events rather than spawning at fixed map locations.</p>
          </div>
        </details>
        <details class="faq-item">
          <summary class="faq-question">Can you capture Legendary Merchants?</summary>
          <div class="faq-answer">
            <p>Yes, but be prepared: they arrive with <strong>high-level guards</strong>, and attempting a capture can trigger a <strong>Wanted level</strong> with PIDF. Bring high-level Spheres and clear or control the guards first.</p>
          </div>
        </details>
        <details class="faq-item">
          <summary class="faq-question">How do you reroll Legendary Merchant spawns?</summary>
          <div class="faq-answer">
            <p>The common method is the <strong>temporary Palbox strategy</strong> — dismantle your Palbox and rebuild it to force a new visitor event, repeating until the merchant type you want appears.</p>
          </div>
        </details>
        <details class="faq-item">
          <summary class="faq-question">Which Legendary Merchant is best?</summary>
          <div class="faq-answer">
            <p>There's no single best — it depends on what you need. Ammo merchants are best for keeping weapons stocked, food merchants for ready meals, and Pal material merchants for crafting supplies.</p>
          </div>
        </details>
      </div>
    </section>

    <section class="content-upgrade-cta">
      <p>Capturing merchants means building a solid base first. See the ranked base-worker guide.</p>
      <a href="/guides/best-base-workers/" class="cta-button cta-button-lg">🏭 Open Base Workers Guide →</a>
      <a href="/guides/" class="cta-button cta-button-lg cta-button-secondary" style="margin-left:var(--space-2)">📖 All Guides →</a>
    </section>
  </div>`;
  return wrapPage(headHTML, bodyHTML);
}

// Guides index page
const guidesIndexHTML = renderGuidesIndex();
fs.mkdirSync(path.join(DIST_DIR, 'guides'), { recursive: true });
fs.writeFileSync(path.join(DIST_DIR, 'guides', 'index.html'), guidesIndexHTML);
console.log('  dist/guides/index.html');

function renderGuidesIndex() {
  const title = TITLE_TEMPLATES.guides;
  const description = 'Palworld strategy guides — best base workers, fastest flying mounts, top combat Pals, and breeding explained. Data-driven rankings, not opinion.'.substring(0, 155);
  const headHTML = renderHead(config, { title, description, canonical: DOMAIN + '/guides/' });

  const bodyHTML = `<div class="container">
    <div class="page-header">
      <h1>📖 Palworld Guides</h1>
      <p class="page-description">Data-driven rankings and strategy — updated for ${BUILD_DATE}.</p>
    </div>
    <div class="grid grid-2" style="gap:var(--space-4);margin-bottom:var(--space-8)">
      <a href="/guides/best-base-workers/" class="guide-card">
        <div class="guide-card-icon">🏭</div>
        <h3>Best Base Workers</h3>
        <p>Every work role ranked — Kindling, Watering, Mining, Handiwork, and more. Find the most efficient Pals for your base.</p>
      </a>
      <a href="/guides/best-flying-mounts/" class="guide-card">
        <div class="guide-card-icon">🦅</div>
        <h3>Fastest Flying Mounts</h3>
        <p>All flying mounts ranked by speed and stamina. Pick the best traversal Pal for your needs.</p>
      </a>
      <a href="/guides/best-combat-pals/" class="guide-card">
        <div class="guide-card-icon">⚔️</div>
        <h3>Best Combat Pals</h3>
        <p>Top 20 combat Pals by attack power — with element breakdowns and tier ratings.</p>
      </a>
      <a href="/guides/breeding-explained/" class="guide-card">
        <div class="guide-card-icon">🧬</div>
        <h3>Breeding Explained</h3>
        <p>How the breeding formula works, special combos, and how to build efficient breeding chains.</p>
      </a>
      <a href="/guides/ancient-bone/" class="guide-card">
        <div class="guide-card-icon">🦴</div>
        <h3>Where to Find Ancient Bone</h3>
        <p>Wildlife Sanctuary No. 3 location, fastest route, farming loop, and patrol tips.</p>
      </a>
      <a href="/guides/legendary-merchants/" class="guide-card">
        <div class="guide-card-icon">🛒</div>
        <h3>Legendary Merchants</h3>
        <p>All six specialized visiting-merchant categories — how to spawn, reroll, and capture.</p>
      </a>
    </div>
  </div>`;
  return wrapPage(headHTML, bodyHTML);
}

// ---- Render Calculator page ----
console.log('Rendering Calculator...');
const calcHTML = renderCalculator();
fs.mkdirSync(path.join(DIST_DIR, 'breeding-calculator'), { recursive: true });
fs.writeFileSync(path.join(DIST_DIR, 'breeding-calculator', 'index.html'), calcHTML);
SITEMAP_ENTRIES.push({ url: DOMAIN + '/breeding-calculator/', tier: 'S', lastmod: BUILD_DATE });
// Top 10 Calculator variant URLs for Google indexing
const topTargetSlugs = ['anubis', 'jormuntide_ignis', 'blazamut', 'frostallion',
  'shadowbeak', 'paladius', 'necromus', 'jetragon', 'bastigor', 'lunaris'];
for (const ts of topTargetSlugs) {
  SITEMAP_ENTRIES.push({ url: `${DOMAIN}/breeding-calculator/?target=${ts}`, tier: 'A', lastmod: BUILD_DATE });
}
console.log(`  dist/breeding-calculator/index.html (+ ${topTargetSlugs.length} sitemap variants)`);

/**
 * Classify a Pal into role buckets for Calculator filtering.
 * @param {object} pal
 * @returns {string} comma-separated roles, e.g. "worker,fighter" or "all"
 */
/**
 * Build Pal grid data for client-side rendering.
 * Embeds full Pal list as JSON for the click-grid in calculator.js.
 * @returns {Array} Array of { slug, name, number, element, elements, bp, tier, isWild }
 */
function buildPalGridData() {
  return allPals.map(p => {
    const el = (p.classification && p.classification.elements && p.classification.elements[0])
      ? p.classification.elements[0].toLowerCase() : 'neutral';
    const els = (p.classification && p.classification.elements)
      ? p.classification.elements.map(e => e.toLowerCase())
      : ['neutral'];
    return {
      slug: p.slug,
      name: p.name.en,
      number: p.number,
      element: el,
      elements: els,
      bp: calculatorData.palBP[p.slug] || null,
      tier: palTiers[p.slug] || 'B',
      isWild: !!(p.acquisition && p.acquisition.isCatchable !== false),
    };
  });
}


function renderCalculator() {
  const title = TITLE_TEMPLATES.calculator;
  const description = 'Palworld Breeding Calculator — find the shortest path to any Pal. 51K+ combinations, special combos, instant results. Verified against the breeding formula.'.substring(0, 155);
  const headHTML = renderHead(config, { title, description, canonical: DOMAIN + '/breeding-calculator/' });

  const palOptions = allPals
    .sort((a, b) => a.name.en.localeCompare(b.name.en))
    .map(p => '<option value="' + p.slug + '">' + esc(p.name.en) + '</option>')
    .join('\n                ');

  // Build grid data for client-side rendering
  const gridData = buildPalGridData();
  const gridDataJSON = JSON.stringify(gridData);

  // Precompute 3 static Best Path examples for SEO
  const staticExamples = buildStaticPathExamples();

  const bodyHTML = '<div class="container">\n' +
    '    <div class="page-header calc-hero">\n' +
    '      <h1>🧬 Palworld Breeding Calculator <span class="calc-hero-amp">&amp;</span> Combinations</h1>\n' +
    '      <p class="page-description calc-hero-sub">Breed any two Pals to see their offspring, or pick a target to trace every path to it. <a href="/breeding-tree/" style="color:var(--color-accent)">Explore full breeding chains →</a> Not sure which Pal you need? Try the <a href="/pal-finder/" style="color:var(--color-accent)">Pal Finder →</a></p>\n' +
    '      <div class="calc-hero-stats">\n' +
    '        <span class="calc-hero-stat">📚 323 Pals</span>\n' +
    '        <span class="calc-hero-stat">🔀 50K+ Combos</span>\n' +
    '        <span class="calc-hero-stat">⚡ Instant</span>\n' +
    '      </div>\n' +
    '      <p class="calc-version-badge">✅ Updated ' + BUILD_DATE + ' — compatible with the latest Palworld version</p>\n' +
    '    </div>\n' +
    '\n' +
    '    <!-- EQUATION BAR: A + B = C -->\n' +
    '    <div class="calc-equation" id="calc-equation">\n' +
    '      <div class="calc-eq-card eq-slot-a" id="calc-eq-card-a">\n' +
    '        <div class="calc-eq-placeholder">\n' +
    '          <span class="calc-eq-q">?</span>\n' +
    '          <span class="calc-eq-hint">Pick a Pal</span>\n' +
    '        </div>\n' +
    '        <div class="calc-eq-filled" style="display:none">\n' +
    '          <button class="calc-eq-remove" aria-label="Remove">&times;</button>\n' +
    '          <img class="calc-eq-img" src="" alt="">\n' +
    '          <span class="calc-eq-name"></span>\n' +
    '          <span class="calc-eq-meta"></span>\n' +
    '        </div>\n' +
    '        <span class="calc-eq-label">Parent A</span>\n' +
    '      </div>\n' +
    '      <span class="calc-eq-op">+</span>\n' +
    '      <div class="calc-eq-card eq-slot-b" id="calc-eq-card-b">\n' +
    '        <div class="calc-eq-placeholder">\n' +
    '          <span class="calc-eq-q">?</span>\n' +
    '          <span class="calc-eq-hint">Pick another</span>\n' +
    '        </div>\n' +
    '        <div class="calc-eq-filled" style="display:none">\n' +
    '          <button class="calc-eq-remove" aria-label="Remove">&times;</button>\n' +
    '          <img class="calc-eq-img" src="" alt="">\n' +
    '          <span class="calc-eq-name"></span>\n' +
    '          <span class="calc-eq-meta"></span>\n' +
    '        </div>\n' +
    '        <span class="calc-eq-label">Parent B</span>\n' +
    '      </div>\n' +
    '      <span class="calc-eq-op">=</span>\n' +
    '      <div class="calc-eq-card eq-slot-c" id="calc-eq-card-c">\n' +
    '        <div class="calc-eq-placeholder">\n' +
    '          <span class="calc-eq-q">?</span>\n' +
    '          <span class="calc-eq-hint">Waiting...</span>\n' +
    '        </div>\n' +
    '        <div class="calc-eq-filled" style="display:none">\n' +
    '          <img class="calc-eq-img" src="" alt="">\n' +
    '          <span class="calc-eq-name"></span>\n' +
    '          <span class="calc-eq-meta"></span>\n' +
    '        </div>\n' +
    '        <span class="calc-eq-label">Child</span>\n' +
    '      </div>\n' +
    '      <button class="calc-eq-swap" id="calc-eq-swap" title="Swap parents" style="display:none">🔀</button>\n' +
    '    </div>\n' +
    '\n' +
    '    <!-- TWO-COLUMN LAYOUT: Left = Selection, Right = Results -->\n' +
    '    <div class="calc-layout" id="calc-layout">\n' +
    '\n' +
    '      <!-- LEFT PANEL: Pal Selection -->\n' +
    '      <div class="calc-left">\n' +
    '\n' +
    '        <!-- Search -->\n' +
    '        <div class="calc-search-wrap">\n' +
    '          <input type="text" id="calc-search" class="calc-search-input"\n' +
    '                 placeholder="Search Pals by name or number…" autocomplete="off">\n' +
      '        </div>\n' +
    '\n' +

    '        <!-- Filter Chips -->\n' +
    '        <div class="calc-filters" id="calc-filters">\n' +
    '          <button class="calc-filter-chip active" data-filter="all">All</button>\n' +
    '          <button class="calc-filter-chip" data-filter="palbox" id="calc-filter-palbox" style="display:none">\n' +
    '            📦 My Box (<span id="calc-filter-palbox-count">0</span>)\n' +
    '          </button>\n' +
    '          <button class="calc-filter-chip" data-filter="fire">🔥 Fire</button>\n' +
    '          <button class="calc-filter-chip" data-filter="water">💧 Water</button>\n' +
    '          <button class="calc-filter-chip" data-filter="grass">🌿 Grass</button>\n' +
    '          <button class="calc-filter-chip" data-filter="electric">⚡ Electric</button>\n' +
    '          <button class="calc-filter-chip" data-filter="ground">⛰ Ground</button>\n' +
    '          <button class="calc-filter-chip" data-filter="ice">❄ Ice</button>\n' +
    '          <button class="calc-filter-chip" data-filter="dragon">🐉 Dragon</button>\n' +
    '          <button class="calc-filter-chip" data-filter="dark">🌑 Dark</button>\n' +
    '          <button class="calc-filter-chip" data-filter="neutral">⬜ Neutral</button>\n' +
    '        </div>\n' +
    '\n' +
    '        <!-- Pal Grid (6 columns, scrollable) -->\n' +
    '        <div class="calc-grid" id="calc-grid">\n' +
    '          <!-- Dynamically populated by JS -->\n' +
    '        </div>\n' +
    '      </div>\n' +
    '\n' +
    '      <!-- RIGHT PANEL: Results -->\n' +
    '      <div class="calc-right" id="calc-right">\n' +
    '\n' +
    '        <!-- Empty State -->\n' +
    '        <div class="calc-empty" id="calc-empty">\n' +
    '          <div class="calc-empty-icon">🧬</div>\n' +
    '          <div class="calc-empty-slots">\n' +
    '            <div class="calc-empty-slot">?</div>\n' +
    '            <span style="color:var(--color-accent);font-size:1.25rem;font-weight:700">✕</span>\n' +
    '            <div class="calc-empty-slot">?</div>\n' +
    '          </div>\n' +
    '          <p class="calc-empty-text" id="calc-empty-text">\n' +
    '            Pick a Pal from the grid to see its breeding path,<br>\n' +
    '            or pick two to see what they produce.\n' +
    '          </p>\n' +
    '          <button class="cta-button cta-button-secondary" id="calc-empty-palbox">\n' +
    '            📦 Browse My Palbox\n' +
    '          </button>\n' +
    '        </div>\n' +
    '\n' +
    '        <!-- Result State -->\n' +
    '        <div class="calc-result" id="calc-result" style="display:none">\n' +
    '          <div class="calc-result-header" id="calc-result-header"></div>\n' +
    '          <div class="calc-result-primary" id="calc-result-primary"></div>\n' +
    '          <div class="calc-result-tabs" id="calc-result-tabs" style="display:none">\n' +
    '            <button class="calc-result-tab active" data-tab="tab1"></button>\n' +
    '            <button class="calc-result-tab" data-tab="tab2"></button>\n' +
    '          </div>\n' +
    '          <div class="calc-result-secondary" id="calc-result-secondary"></div>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '\n' +
    '    <!-- PALBOX FLOATING PANEL -->\n' +
    '    <div id="calc-palbox-float" class="calc-palbox-float" style="display:none">\n' +
    '      <div class="calc-palbox-float-header">\n' +
    '        <span>📦 My Palbox (<span id="calc-palbox-count-float">0</span>)</span>\n' +
    '        <button id="calc-palbox-add-btn" class="calc-palbox-add-btn" aria-label="Add Pal to Palbox">＋ Add</button>\n' +
    '      </div>\n' +
    '      <div id="calc-palbox-list" class="calc-palbox-chips"></div>\n' +
    '      <div class="calc-palbox-actions">\n' +
    '        <button id="calc-palbox-what-can-breed" class="cta-button cta-button-secondary" disabled>🔒 Add 2+ Pals to see what you can breed</button>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '\n' +
    '    <!-- STATIC SEO EXAMPLES -->\n' +
    '    <div id="static-examples" aria-hidden="true">\n' +
    '      ' + staticExamples + '\n' +
    '    </div>\n' +
    '\n' +
    '    <!-- HIDDEN SELECT FOR SEO -->\n' +
    '    <select id="calc-select-target" name="target" class="sr-only" aria-hidden="true">\n' +
    '      <option value="">Select Target Pal…</option>\n' +
    '      ' + palOptions + '\n' +
    '    </select>\n' +
    '\n' +
    '    <!-- GRID DATA (embedded JSON) -->\n' +
    '    <script id="calc-grid-data" type="application/json">' + gridDataJSON.replace(/</g, '\\u003c') + '</script>\n' +
    '\n' +
    '    <!-- FORMULA -->\n' +
    '    <details class="calc-formula" style="margin-top:var(--space-6);padding:var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-md)">\n' +
    '      <summary style="cursor:pointer;font-family:var(--font-display);font-size:1rem;color:var(--color-accent);padding:4px 0">\n' +
    '        📐 How Palworld Breeding Works\n' +
    '      </summary>\n' +
    '      <div style="margin-top:var(--space-3)">\n' +
    '        <p style="font-size:1.0625rem;margin-bottom:var(--space-3)">\n' +
    '          <strong>Child BP = ⌊(Parent A BP + Parent B BP) ÷ 2⌋</strong>\n' +
    '        </p>\n' +
    '        <p style="font-size:0.875rem;color:var(--color-text-secondary);margin-bottom:var(--space-2)">\n' +
    '          Every Pal has a hidden <strong>Breeding Power (BP)</strong> value. When you breed two Pals, the game\n' +
    '          averages their BP values and finds the Pal whose BP is closest to that average — that\'s the child.\n' +
    '        </p>\n' +
    '        <p style="font-size:0.875rem;color:var(--color-text-secondary);margin-bottom:var(--space-2)">\n' +
    '          Some combinations produce a <strong>fixed child</strong> regardless of BP — these are called\n' +
    '          <span style="color:var(--color-accent)">Special Combos</span> and the Calculator checks them first.\n' +
    '        </p>\n' +
    '        <p style="font-size:0.8125rem;color:var(--color-text-muted)">\n' +
    '          Higher BP = easier to catch in the wild (🟢). Lower BP = harder (🔴⚡).\n' +
    '          Breeding chains let you go from easy-to-catch Pals to rare ones by breeding in steps.\n' +
    '        </p>\n' +
    '      </div>\n' +
    '    </details>\n' +
    '  </div>\n' +
    '\n' +
    '  <script src="/assets/calculator.js" defer></script>';

  return wrapPage(headHTML, bodyHTML);
}


function buildStaticPathExamples() {
  const targets = [
    { slug: 'anubis', label: 'Most wanted base Pal' },
    { slug: 'jormuntide_ignis', label: 'Best Kindling Lv4' },
    { slug: 'blazamut', label: 'Top-tier combat mount' },
  ];

  let html = '';
  for (const t of targets) {
    const pairs = reverseIndex[t.slug] || [];
    if (pairs.length === 0) continue;

    // Find easiest pair (highest combined BP)
    const best = pairs.reduce((best, p) =>
      (p.parent1BP + p.parent2BP) > (best.parent1BP + best.parent2BP) ? p : best
    , pairs[0]);

    const a = palBySlug[best.parent1];
    const b = palBySlug[best.parent2];
    const target = palBySlug[t.slug];
    if (!a || !b || !target) continue;

    html += `<a href="/breeding-calculator/?target=${t.slug}" style="text-decoration:none;color:inherit;display:block;margin-bottom:var(--space-2)">
      <div style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-3);background:var(--color-bg-glass)">
        <div style="font-size:0.75rem;color:var(--color-text-muted);margin-bottom:4px">${t.label}</div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:0.8125rem">
          <span>${esc(a.name.en)}</span> <span style="color:var(--color-accent)">+</span> <span>${esc(b.name.en)}</span>
          <span style="color:var(--color-text-muted);margin:0 4px">→</span>
          <strong>${esc(target.name.en)}</strong>
          ${best.isSpecial ? '<span class="badge badge-tier-s" style="font-size:0.5625rem">⭐</span>' : ''}
        </div>
      </div>
    </a>`;
  }
  return html;return html;
}

// ---- Render Pal Finder page ----
console.log('Rendering Pal Finder...');
const finderHTML = renderPalFinder();
fs.mkdirSync(path.join(DIST_DIR, 'pal-finder'), { recursive: true });
fs.writeFileSync(path.join(DIST_DIR, 'pal-finder', 'index.html'), finderHTML);
SITEMAP_ENTRIES.push({ url: DOMAIN + '/pal-finder/', tier: 'S', lastmod: BUILD_DATE });
console.log('  dist/pal-finder/index.html');

// ---- Render Breeding Tree page ----
console.log('Rendering Breeding Tree...');
const treeHTML = renderBreedingTree();
fs.mkdirSync(path.join(DIST_DIR, 'breeding-tree'), { recursive: true });
fs.writeFileSync(path.join(DIST_DIR, 'breeding-tree', 'index.html'), treeHTML);
SITEMAP_ENTRIES.push({ url: DOMAIN + '/breeding-tree/', tier: 'S', lastmod: BUILD_DATE });
// Top 5 Breeding Tree variant URLs
const topTreeSlugs = ['anubis', 'jormuntide_ignis', 'shadowbeak', 'frostallion', 'paladius'];
for (const ts of topTreeSlugs) {
  SITEMAP_ENTRIES.push({ url: `${DOMAIN}/breeding-tree/?pal=${ts}`, tier: 'A', lastmod: BUILD_DATE });
}
console.log(`  dist/breeding-tree/index.html (+ ${topTreeSlugs.length} sitemap variants)`);

function renderBreedingTree() {
  const title = TITLE_TEMPLATES.breedingTree;
  const description = 'Find the easiest breeding path to any Pal. Pairs grouped by difficulty — catch-only parents first, then pairs that need chaining.'.substring(0, 155);
  const headHTML = renderHead(config, { title, description, canonical: DOMAIN + '/breeding-tree/' });

  const gridData = buildPalGridData();

  // SEO fallback: show a few Anubis pairs for crawlers
  const fallbackPal = 'anubis';
  const fallbackPalData = palBySlug[fallbackPal];
  const fallbackPairs = (reverseIndex[fallbackPal] || []).slice(0, 6);

  const fallbackHTML = fallbackPalData ? `
  <div class="tree-seo-fallback">
    <h2>🌳 ${esc(fallbackPalData.name.en)} Breeding Tree</h2>
    <p>${fallbackPairs.length} parent pairs that can produce <strong>${esc(fallbackPalData.name.en)}</strong>.</p>
    <div class="tree-seo-grid">
      ${fallbackPairs.map(pair => {
        const p1 = palBySlug[pair.parent1];
        const p2 = palBySlug[pair.parent2];
        if (!p1 || !p2) return '';
        return `<a href="/pals/${pair.parent1}/" class="tree-seo-pair">
          <img src="/images/pals/${pair.parent1}.webp" alt="${esc(p1.name.en)}" loading="lazy" onerror="this.src='/images/pals/${pair.parent1}.png'">
          <span>${esc(p1.name.en)}</span></a>
          <span class="tree-seo-plus">+</span>
          <a href="/pals/${pair.parent2}/" class="tree-seo-pair">
          <img src="/images/pals/${pair.parent2}.webp" alt="${esc(p2.name.en)}" loading="lazy" onerror="this.src='/images/pals/${pair.parent2}.png'">
          <span>${esc(p2.name.en)}</span></a>`;
      }).join('')}
    </div>
    <p><a href="/breeding-calculator/?target=${fallbackPal}" class="cta-button">🧬 Open in Calculator →</a></p>
  </div>` : '';

  const bodyHTML = `<div class="container">
  <div class="page-header">
    <h1>🌳 Breeding Tree</h1>
    <p class="page-description">Find the easiest way to breed any Pal. Parent pairs are grouped by how hard they are to obtain. <a href="/breeding-calculator/" style="color:var(--color-accent)">Try the Calculator →</a></p>
  </div>

  <div class="tree-toolbar" id="tree-toolbar">
    <div class="tree-search-wrap">
      <input type="text" id="tree-search" class="tree-search-input"
             placeholder="Search Pal by name or number…" autocomplete="off">
      <div class="tree-search-results" id="tree-search-results" style="display:none"></div>
    </div>
    <a href="/breeding-calculator/" class="tree-ctrl-btn" id="tree-btn-calculator" style="text-decoration:none">🧬 Calculator</a>
  </div>

  <div class="tree-empty-state" id="tree-empty">
    <div class="tree-empty-icon">🌳</div>
    <p class="tree-empty-text">Search for a Pal above to find the <strong>easiest breeding paths</strong>.</p>
    <p class="tree-empty-hint">Every parent pair that can produce your target — sorted by how easy the parents are to get.</p>
  </div>

  <div class="tree-target-header" id="tree-target-header" style="display:none">
    <div class="tree-target-card" id="tree-target-card"></div>
    <div class="tree-sort-bar" id="tree-sort-bar">
      <span class="tree-sort-label">Sort:</span>
      <button class="tree-sort-pill active" data-sort="recommended">⭐ Recommended</button>
      <button class="tree-sort-pill" data-sort="wild">🌿 Catch First</button>
      <button class="tree-sort-pill" data-sort="bp">🔢 By BP</button>
      <button class="tree-sort-pill" data-sort="steps">📶 Fewest Steps</button>
    </div>
  </div>

  <div class="tree-pair-list" id="tree-pair-list"></div>

  ${fallbackHTML}

  <details class="tree-help">
    <summary>📖 How to Use the Breeding Tree</summary>
    <div>
      <p><strong>🔍 Search</strong> — Pick a Pal you want to breed. Pairs appear grouped by difficulty.</p>
      <p><strong>⭐ Direct Catch</strong> — Both parents must be caught (they can't be bred). Simplest path — no chain needed.</p>
      <p><strong>⚡ Short Chain</strong> — One parent can be bred, one must be caught. Click <span style="color:var(--color-accent)">🔗 Trace</span> to see the chain.</p>
      <p><strong>🔴 Full Chain</strong> — Both parents need breeding first. The longest path — but also the most options.</p>
      <p><strong>🔗 Trace Chain</strong> — Click on any pair with a breedable parent to walk back through the full breeding chain.</p>
      <p><strong>🧬 Calculator</strong> — Jump to the Breeding Calculator to test custom combinations.</p>
    </div>
  </details>
</div>

<script id="tree-grid-data" type="application/json">${JSON.stringify(gridData)}</script>
<script id="tree-palbp-data" type="application/json">${JSON.stringify(calculatorData.palBP)}</script>
<script src="/assets/breeding-tree.js" defer></script>`;

  return wrapPage(headHTML, bodyHTML);
}

function renderPalFinder() {
  const title = TITLE_TEMPLATES.palFinder;
  const description = `Filter Pals by element, work type, rarity, and mount capability. Compare stats, find the right Pal for your team or base.`.substring(0, 155);
  const headHTML = renderHead(config, { title, description, canonical: DOMAIN + '/pal-finder/' });

  // Default: show top 20 by stat total (no-JS fallback)
  const topPals = [...allPals]
    .sort((a, b) => {
      const totalA = a.stats.hp + a.stats.attack + a.stats.defense + a.stats.speed;
      const totalB = b.stats.hp + b.stats.attack + b.stats.defense + b.stats.speed;
      return totalB - totalA;
    })
    .slice(0, 20);

  const cardsHTML = topPals.map(pal => {
    const el = pal.classification.elements[0].toLowerCase();
    const tier = palTiers[pal.slug] || 'B';
    const attrs = [];
    if (pal.classification.isFlyable) attrs.push('<span class="badge badge-work">🕊️ Flyer</span>');
    else if (pal.classification.isRideable) attrs.push('<span class="badge badge-work">🐎 Rideable</span>');
    return `<div class="pal-card ${el}">
      <a href="/pals/${pal.slug}/" style="text-decoration:none;color:inherit">
        <img src="/images/pals/${pal.slug}.webp" alt="${esc(pal.name.en)}" class="pal-card-image" loading="lazy" onerror="this.src='/images/pals/${pal.slug}.png'">
        <div class="pal-card-name">${esc(pal.name.en)}</div>
        <div class="pal-card-number">#${pal.number}</div>
        <div class="pal-card-badges">
          <span class="badge badge-tier-${tier.toLowerCase()}">${tier}</span>
          <span class="badge badge-element ${el}">${pal.classification.elements[0]}</span>
          <span class="badge badge-rarity-${pal.classification.rarity.toLowerCase()}">${pal.classification.rarity}</span>
          ${attrs.join('')}
        </div>
        <div class="pal-card-stats" style="margin-top:12px">
          <div class="pal-card-stat"><span>HP</span><span class="pal-card-stat-value">${pal.stats.hp}</span></div>
          <div class="pal-card-stat"><span>ATK</span><span class="pal-card-stat-value">${pal.stats.attack}</span></div>
          <div class="pal-card-stat"><span>DEF</span><span class="pal-card-stat-value">${pal.stats.defense}</span></div>
          <div class="pal-card-stat"><span>SPD</span><span class="pal-card-stat-value">${pal.stats.speed}</span></div>
        </div>
      </a>
    </div>`;
  }).join('\n          ');

  const bodyHTML = `<div class="container">
    <div class="page-header">
      <h1>🔍 Pal Finder</h1>
      <p class="page-description">Filter <span id="finder-count">${allPals.length} Pals</span> by element, work type, rarity, and more. Want to breed one? Use the <a href="/breeding-calculator/" style="color:var(--color-accent)">Breeding Calculator →</a></p>
    </div>

    <div id="finder-filters" class="finder-filters glass-panel" style="padding:var(--space-4);margin-bottom:var(--space-6)">
      <p style="text-align:center;color:var(--color-text-muted)">Loading filters…</p>
    </div>

    <div id="finder-results">
      <div class="pal-grid">
        ${cardsHTML}
      </div>
      <div style="text-align:center;margin-top:var(--space-4)">
        <a href="/pals/" class="cta-button cta-button-secondary">Browse All ${allPals.length} Pals →</a>
      </div>
    </div>

    <div style="text-align:center;margin-top:var(--space-6)">
      <button id="finder-load-more" class="cta-button" style="display:none">Load More</button>
    </div>
  </div>

  <script src="/assets/pal-finder.js" defer></script>`;

  return wrapPage(headHTML, bodyHTML);
}

// ---- Render static pages ----
console.log('Rendering static pages...');
const staticPages = [
  { slug: 'about', title: `About ${SITE_NAME} — Independent Palworld Database`, h1: 'About PalworldBase.com' },
  { slug: 'privacy', title: 'Privacy Policy — PalworldBase', h1: 'Privacy Policy' },
  { slug: 'terms', title: 'Terms of Service — PalworldBase', h1: 'Terms of Service' },
  { slug: 'cookie-policy', title: 'Cookie Policy — PalworldBase', h1: 'Cookie Policy' },
];

for (const page of staticPages) {
  const html = renderStaticPage(page);
  fs.writeFileSync(path.join(DIST_DIR, page.slug, 'index.html'), html);
  SITEMAP_ENTRIES.push({ url: `${DOMAIN}/${page.slug}/`, tier: 'B', lastmod: BUILD_DATE });
  console.log(`  dist/${page.slug}/index.html`);
}

function renderStaticPage(page) {
  const headHTML = renderHead(config, {
    title: page.title,
    description: `${page.h1} — PalworldBase.com, independent Palworld stats and breeding database.`,
    canonical: `${DOMAIN}/${page.slug}/`,
  });

  let content = '';
  if (page.slug === 'about') {
    content = `<p>PalworldBase.com is an independent database for Palworld players. We provide peer-ranked Pal stats, skill builds, breeding paths, and strategy guides — all generated from game data, cross-referenced against the community wiki.</p>
    <p>We're not affiliated with Pocketpair, Inc. Palworld is a trademark of Pocketpair.</p>
    <p>Questions or corrections? Email <a href="mailto:support@palworldbase.net">support@palworldbase.net</a>.</p>`;
  } else if (page.slug === 'privacy') {
    content = `<p>This Privacy Policy explains how PalworldBase handles your information.</p>
    <h3>Cookies & Analytics</h3>
    <p>We use cookies for analytics (to understand how many people visit) and for advertising. You can control cookie preferences through the consent banner.</p>
    <h3>Data We Collect</h3>
    <p>We use Microsoft Clarity for anonymous usage analytics (heatmaps, session recordings). No personal data is collected. IP addresses are anonymized.</p>
    <h3>Advertising</h3>
    <p>We display ads via Google AdSense. Google may use cookies to serve personalized ads. You can opt out at <a href="https://adssettings.google.com">Google Ad Settings</a>.</p>
    <h3>Contact</h3>
    <p>Questions? <a href="mailto:support@palworldbase.net">support@palworldbase.net</a></p>`;
  } else if (page.slug === 'terms') {
    content = `<p>By using PalworldBase, you agree to these terms.</p>
    <h3>Content</h3>
    <p>All Pal stats, skill data, and breeding information are sourced from game files and the community wiki. While we strive for accuracy, we make no guarantees.</p>
    <h3>Intellectual Property</h3>
    <p>Palworld is a trademark of Pocketpair, Inc. All Pal names, images, and game data belong to their respective owners. PalworldBase is an independent fan project.</p>
    <p>Contact: <a href="mailto:support@palworldbase.net">support@palworldbase.net</a></p>`;
  } else if (page.slug === 'cookie-policy') {
    content = `<p>This Cookie Policy explains what cookies are and how we use them.</p>
    <h3>Essential Cookies</h3>
    <p>These cookies are necessary for the website to function. They remember your cookie consent preferences.</p>
    <h3>Analytics Cookies</h3>
    <p>We use Microsoft Clarity to understand how visitors use our site. This helps us improve the content and user experience.</p>
    <h3>Advertising Cookies</h3>
    <p>Google AdSense may use cookies to show relevant ads and measure ad performance.</p>
    <h3>Managing Cookies</h3>
    <p>You can clear your browser cookies at any time. Revisit the site to reset your cookie preferences.</p>`;
  }

  const bodyHTML = `<div class="container container-narrow">
    <div class="page-header">
      <h1>${page.h1}</h1>
    </div>
    ${content}
  </div>`;
  return wrapPage(headHTML, bodyHTML, false);
}

// ---- Render 404 page ----
console.log('Rendering 404 page...');
const notFoundHTML = renderNotFound();
fs.writeFileSync(path.join(DIST_DIR, '404.html'), notFoundHTML);
console.log('  dist/404.html');

function renderNotFound() {
  const headHTML = renderHead(config, {
    title: 'Pal Not Found — 404',
    description: 'This Pal does not exist. Return to explore stats, breeding paths, and guides.',
    canonical: DOMAIN + '/404.html',
  });

  const bodyHTML = `<div class="container" style="text-align:center;padding:var(--space-20) 0">
    <div style="font-size:4rem;margin-bottom:var(--space-4)">❓</div>
    <h1 style="font-size:2.5rem;margin-bottom:var(--space-4)">Pal Not Found</h1>
    <p style="font-size:1.125rem;margin-bottom:var(--space-8)">This Pal doesn't exist in our database. Maybe it's still undiscovered?</p>
    <div style="display:flex;gap:var(--space-4);justify-content:center;flex-wrap:wrap">
      <a href="/" class="cta-button">← Back to Home</a>
      <a href="/pals/" class="cta-button cta-button-secondary">Browse All Pals</a>
    </div>
  </div>`;
  return wrapPage(headHTML, bodyHTML, false);
}

// ---- Generate SEO files ----
console.log('\n⏳ Generating SEO files...');

// sitemap.xml (all pages)
const sitemapEntries = SITEMAP_ENTRIES.map(e =>
  `  <url><loc>${esc(e.url)}</loc><lastmod>${e.lastmod}</lastmod><priority>${e.tier === 'S' ? '1.0' : e.tier === 'A' ? '0.8' : '0.5'}</priority></url>`
).join('\n');

const sitemapXML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</urlset>`;
fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemapXML);
console.log(`  dist/sitemap.xml (${SITEMAP_ENTRIES.length} URLs)`);

// robots.txt
  const robotsTXT = `User-agent: *
Allow: /

Disallow: /cdn-cgi/

Sitemap: ${DOMAIN}/sitemap.xml
`;
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robotsTXT);
console.log('  dist/robots.txt');

// ── llms.txt (AI crawler directory) ──
  const sTierPals = allPals.filter(p => palTiers[p.slug] === 'S');
  const aTierPals = allPals.filter(p => palTiers[p.slug] === 'A');
  const bTierPals = allPals.filter(p => palTiers[p.slug] === 'B');

  const llmsLines = [
    `# ${SITE_NAME}`,
    `> Peer-ranked Pal stats, skill builds, and breeding paths for ${allPals.length} Pals.`,
    `> Data sourced from game files, verified against the Palworld breeding formula. Updated ${BUILD_DATE}.`,
    '',
    '## Core Pages',
    `- [Home](${DOMAIN}/): Pal stats, mini Calculator, top Pal cards`,
    `- [Calculator](${DOMAIN}/breeding-calculator/): Find child from parents or parents from child`,
    `- [Breeding Tree](${DOMAIN}/breeding-tree/): Explore ALL parent pairs grouped by difficulty, with chain tracing`,
    `- [Pal Finder](${DOMAIN}/pal-finder/): Filter by element, work suitability, rarity`,
    `- [All Pals](${DOMAIN}/pals/): Accordion index by element/work/rarity`,
    '',
    '## Guides',
    `- [Best Base Workers](${DOMAIN}/guides/best-base-workers/): Kindling, Watering, Planting, Mining, Handiwork, Transport, Cooling, Medicine, Lumbering`,
    `- [Fastest Flying Mounts](${DOMAIN}/guides/best-flying-mounts/): All flying mounts ranked by speed + early game picks`,
    `- [Best Combat Pals](${DOMAIN}/guides/best-combat-pals/): Top 20 by attack, with element breakdowns`,
    `- [Breeding Explained](${DOMAIN}/guides/breeding-explained/): Formula, BP system, special combos, difficulty groups, FAQ`,
    `- [Where to Find Ancient Bone](${DOMAIN}/guides/ancient-bone/): Wildlife Sanctuary No. 3 location, route, farming loop, patrol tips`,
    `- [Legendary Merchants](${DOMAIN}/guides/legendary-merchants/): Six categories, spawn, reroll, and capture`,
    '',
    '## Info',
    `- [About](${DOMAIN}/about/): Data sources and methodology`,
    '',
    `## S-Tier Pals (${sTierPals.length} total) — highest priority pages`,
  ];
  for (const p of sTierPals) {
    const bp = calculatorData.palBP && calculatorData.palBP[p.slug] ? `BP ${calculatorData.palBP[p.slug]}` : '';
    llmsLines.push(`- [${p.name.en}](${DOMAIN}/pals/${p.slug}/): ${p.classification.elements.join('/')} ${p.classification.rarity}, ${bp}`);
  }
  llmsLines.push('', `## A-Tier Pals (${aTierPals.length} total)`, '');
  for (const p of aTierPals) {
    llmsLines.push(`- [${p.name.en}](${DOMAIN}/pals/${p.slug}/): ${p.classification.elements.join('/')} ${p.classification.rarity}`);
  }
  llmsLines.push('', `> ${bTierPals.length} B-tier Pals also available — see [All Pals](${DOMAIN}/pals/) for full index.`);

  fs.writeFileSync(path.join(DIST_DIR, 'llms.txt'), llmsLines.join('\n'));
  console.log('  dist/llms.txt');

  // ── llms-full.txt (AI crawler full content) ──
  const llmsFull = [
    `# ${SITE_NAME} — Full Content`,
    `> Data sourced from Palworld game files. All ${allPals.length} Pals verified against the breeding formula.`,
    `> Last updated: ${BUILD_DATE}. Site: ${DOMAIN}`,
    '',
    '## Site Overview',
    `PalworldBase is a data-driven Palworld database with ${allPals.length} Pals.`,
    'Every Pal has: stats (HP/ATK/DEF), work suitabilities, breeding power, tier ranking, and skill loadouts.',
    'Tools: Breeding Calculator (50K+ combos), Breeding Tree (pair difficulty + chain tracing), Pal Finder (filter by element/work/rarity).',
    '',
    '## Breeding Formula',
    'Child BP = floor((Parent A BP + Parent B BP) / 2). The child is the Pal whose Breeding Power is closest to this average.',
    'Special combos override the formula for variant Pals (e.g. Frostallion Noct = Frostallion + Helzephyr).',
    '',
    '## Breeding Power (BP) — All Pals',
    '| # | Pal | BP | Elements | Rarity | Tier |',
    '|---|-----|----|----------|--------|------|',
  ];
  for (const p of allPals) {
    const bp = calculatorData.palBP[p.slug] || '?';
    const tier = palTiers[p.slug] || 'B';
    const els = p.classification.elements.join('/');
    llmsFull.push(`| ${p.number || '-'} | ${p.name.en} | ${bp} | ${els} | ${p.classification.rarity} | ${tier} |`);
  }

  // Work rankings summary
  const workKeys = ['kindling', 'watering', 'planting', 'mining', 'handiwork', 'transport', 'cooling', 'medicine', 'lumbering'];
  llmsFull.push('', '## Best Base Workers', '');
  for (const wk of workKeys) {
    const top5 = allPals
      .filter(p => (p.workSuitability[wk] || 0) >= 2)
      .sort((a, b) => (b.workSuitability[wk] || 0) - (a.workSuitability[wk] || 0))
      .slice(0, 5);
    if (top5.length === 0) continue;
    const label = wk.charAt(0).toUpperCase() + wk.slice(1);
    llmsFull.push(`**Top ${label}**: ${top5.map(p => `${p.name.en} (Lv ${p.workSuitability[wk]})`).join(', ')}`);
  }

  // Fastest flyers
  llmsFull.push('', '## Fastest Flying Mounts', '');
  const topFlyers = allPals.filter(p => p.classification.isFlyable).sort((a, b) => b.stats.speed - a.stats.speed).slice(0, 10);
  llmsFull.push(topFlyers.map((p, i) => `${i + 1}. ${p.name.en} — Speed ${p.stats.speed}, Stamina ${p.stats.stamina}`).join('\n'));

  // Best combat
  llmsFull.push('', '## Best Combat Pals (by ATK)', '');
  const topCombat = [...allPals].sort((a, b) => (b.stats.attack || 0) - (a.stats.attack || 0)).slice(0, 10);
  llmsFull.push(topCombat.map((p, i) => `${i + 1}. ${p.name.en} — ATK ${p.stats.attack}, ${p.classification.elements.join('/')}`).join('\n'));

  llmsFull.push('', '---', `Generated: ${BUILD_DATE} | ${DOMAIN} | ${allPals.length} Pals`);

  fs.writeFileSync(path.join(DIST_DIR, 'llms-full.txt'), llmsFull.join('\n'));
  console.log('  dist/llms-full.txt');

  // ---- Summary ----
  const sCount = sTierPals.length;
  const aCount = aTierPals.length;
  const bCount = bTierPals.length;const totalPages = 1 + 1 + palPagesRendered + 4 + 1 + 1 + 1 + 1 + 4 + 1;

console.log(`\n═══ Build Complete ═══`);
console.log(`Total pages:  ${totalPages}`);
console.log(`  Homepage:   1`);
console.log(`  Pal pages:  ${palPagesRendered} (S:${sCount} A:${aCount} B:${bCount})`);
console.log(`  Guides:     5 (4 detail + 1 index)`);
console.log(`  Tools:      3 (Calculator + Breeding Tree + Pal Finder)`);
console.log(`  Static:     4 (About/Privacy/Terms/Cookies)`);
console.log(`  Other:      1 (404)`);
console.log(`Sitemap:      ${SITEMAP_ENTRIES.length} URLs`);
console.log(`Output:       ${DIST_DIR}/`);

// ---- Quality Audit ----
const palTiersSimple = {};
for (const pal of allPals) {
  palTiersSimple[pal.slug] = palTiers[pal.slug] || 'B';
}
const auditResult = require('./audit').run(DIST_DIR, palTiersSimple);

// Write audit report
const auditReport = {
  buildDate: BUILD_DATE,
  passed: auditResult.passed,
  slugCount: auditResult.slugCount,
  ngram: auditResult.ngram,
  structure: auditResult.structure,
  wordCount: auditResult.wordCount,
};
fs.writeFileSync(
  path.join(DIST_DIR, 'audit-report.json'),
  JSON.stringify(auditReport, null, 2)
);
console.log('  dist/audit-report.json');

	// ── IndexNow key file ──
	const INDEXNOW_KEY = fs.readFileSync(path.join(DATA_DIR, 'indexnow-key.txt'), 'utf8').trim();
	fs.writeFileSync(path.join(DIST_DIR, `indexnow-key.html`), INDEXNOW_KEY);
	console.log(`  dist/indexnow-key.html`);

	// ── IndexNow API submission ──
	const indexNowUrls = SITEMAP_ENTRIES.map(e => e.url);
	console.log(`\nSubmitting ${indexNowUrls.length} URLs to IndexNow...`);
	const payload = JSON.stringify({
	  host: new URL(DOMAIN).hostname,
	  key: INDEXNOW_KEY,
	  keyLocation: `${DOMAIN}/indexnow-key.html`,
	  urlList: indexNowUrls,
	});
	const req = require('https').request({
	  hostname: 'api.indexnow.org',
	  path: '/indexnow',
	  method: 'POST',
	  headers: {
	    'Content-Type': 'application/json; charset=utf-8',
	    'Content-Length': Buffer.byteLength(payload),
	  },
	}, res => {
	  console.log(`IndexNow: ${res.statusCode} ${res.statusMessage}`);
	});
	req.on('error', e => console.error('IndexNow error:', e.message));
	req.write(payload);
	req.end();
