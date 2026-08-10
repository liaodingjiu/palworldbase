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

// ---- Directory setup ----
console.log('\nSetting up dist/...');
const dirs = [
  'dist', 'dist/pals', 'dist/css', 'dist/images/pals',
  'dist/breeding-calculator', 'dist/pal-finder', 'dist/guides',
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
console.log('  data/calculator-data.json → dist/data/');
console.log('  data/pal-stats.json → dist/data/');
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
    const navMap = { 'calculator': 'calculator', 'pal-finder': 'finder', 'all-pals': 'pals', 'guides': 'guides', 'about': 'about' };
    const isActive = navMap[key] === activeNav;
    return `<a href="${item.href}"${isActive ? ' class="active" aria-current="page"' : ''}>${item.label}</a>`;
  }).join('\n      ');

  return `<header class="site-header">
  <div class="container">
    <a href="/" class="header-logo" aria-label="${SITE_NAME} Home">
      <span class="header-logo-icon">⚡</span>
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
  const variant = (typeof pal.number === 'number' ? pal.number : parseInt(pal.number, 10) || 0) % 4;
  const peers = elementPeers[element] || [];

  // Title & Description (with rotation)
  const title = tier === 'S' ? TITLE_TEMPLATES.palS(pal) :
                tier === 'A' ? TITLE_TEMPLATES.palA(pal) :
                TITLE_TEMPLATES.palB(pal);

  const comboCount = (reverseIndex[pal.slug] || []).length;
  const description = generateDescription(pal, tier, variant, peers, comboCount);

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
  const palFacts = extractFacts(pal, elementPeers, variant);
  sections.push(renderFactsSection(pal, palFacts));

  // 3. Stats comparison (S/A tier)
  if (tier !== 'B' && peers.length > 0) {
    const zResults = computeZScores(pal, peers);
    const rankResult = rankAmongPeers(pal, peers);
    sections.push(renderComparison(pal, tier, zResults, rankResult, variant, peers));
  }

  // 4. Skill builds (S tier gets all 3, A gets 1-2)
  const builds = computeAllBuilds(pal.skills, element);
  if (builds.length > 0) {
    sections.push(renderSkillBuilds(pal, tier, builds, variant));
  }

  // 5. How to Breed
  sections.push(renderBreedingSection(pal, tier, variant));

  // 6. Work suitability
  sections.push(renderWorkSection(pal, tier, variant));

  // 7. Acquisition (B tier only — simpler location info)
  if (tier === 'B') {
    sections.push(renderAcquisition(pal, variant));
  }

  // 8. Drops (all tiers)
  if (pal.drops && pal.drops.length > 0) {
    sections.push(renderDrops(pal, tier, variant));
  }

  // 9. What's Next (S/A only)
  if (tier !== 'B') {
    const bp = pal.breeding && pal.breeding.breedingPower;
    if (bp !== undefined) {
      const whatsNext = findWhatsNext(pal.slug, calculatorData.bpSorted.map((s, i) => ({
        slug: s,
        bp: calculatorData.palBP[s] || 0
      })), calculatorData.palBP, calculatorData.specialCombos, statsBySlug);
      if (whatsNext.length > 0) {
        sections.push(renderWhatsNext(pal, whatsNext, variant));
      }
    }
  }

  // 10. Content Upgrade CTA (S/A only)
  if (tier !== 'B') {
    sections.push(renderContentUpgradeCTA(pal, comboCount, variant));
  }

  // Breadcrumb
  const breadcrumb = `<nav class="breadcrumb" aria-label="Breadcrumb">
  <a href="/">Home</a> <span class="separator">/</span>
  <a href="/pals/">All Pals</a> <span class="separator">/</span>
  <span class="current">${esc(pal.name.en)}</span>
</nav>`;

  const bodyHTML = `${breadcrumb}
<div class="container container-narrow">
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

  const statTotal = pal.stats.hp + pal.stats.attack + pal.stats.defense + pal.stats.speed;

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
    <div class="pal-hero-stats-grid">
      <div class="pal-hero-stat"><div class="pal-hero-stat-value">${pal.stats.hp}</div><div class="pal-hero-stat-label">HP</div></div>
      <div class="pal-hero-stat"><div class="pal-hero-stat-value">${pal.stats.attack}</div><div class="pal-hero-stat-label">ATK</div></div>
      <div class="pal-hero-stat"><div class="pal-hero-stat-value">${pal.stats.defense}</div><div class="pal-hero-stat-label">DEF</div></div>
      <div class="pal-hero-stat"><div class="pal-hero-stat-value">${pal.stats.speed}</div><div class="pal-hero-stat-label">SPD</div></div>
    </div>
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

  return `<section class="section">
  <h2>${heading}</h2>
  <p>${totalPairs} parent pairs can produce ${esc(pal.name.en)}. Here are the easiest combinations:</p>
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

  return `<section class="section">
  <h2>${heading}</h2>
  <div class="glass-panel">
    ${workHTML}
  </div>
</section>`;
}

function renderAcquisition(pal, variant) {
  const heading = SECTION_HEADINGS.acquisition.B(pal);
  const acq = pal.acquisition || {};
  const habitats = acq.habitats || [];

  let content = '';
  if (habitats.length > 0) {
    content += `<p>Found in: ${habitats.join(', ')}</p>`;
  }
  if (acq.isBossEncounter) {
    content += `<p>⚠️ Boss encounter — prepare for a challenging fight.</p>`;
  }
  if (acq.isNocturnal) {
    content += `<p>🌙 Nocturnal — only appears at night.</p>`;
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

  const dropList = (pal.drops || []).map(d =>
    typeof d === 'string' ? d : d.name || d.item
  ).filter(Boolean);

  if (dropList.length === 0) return '';

  return `<section class="section">
  <h2>${heading}</h2>
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

  return `<section class="section">
  <h2>${heading}</h2>
  <p>After you have ${esc(pal.name.en)}, breed it to produce these valuable Pals:</p>
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

  // B tier
  const bTemplates = [
    () => DESC_TEMPLATES.bDefault(pal),
    () => DESC_TEMPLATES.bAcquisition(pal),
    () => DESC_TEMPLATES.bData(pal, comboCount),
  ];
  return bTemplates[variant % 3]();
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
        <p>How the breeding formula works, step-by-step — with examples and calculator.</p>
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
  const description = 'Browse all Pals by element, work type, and rarity. Filterable index with tier badges and key stats.';
  const canonical = DOMAIN + '/pals/';

  const headHTML = renderHead(config, { title, description, canonical });

  // Group by element
  const byElement = {};
  for (const pal of allPals) {
    const el = pal.classification.elements[0];
    if (!byElement[el]) byElement[el] = [];
    byElement[el].push(pal);
  }

  // Group by work type
  const byWork = {};
  for (const pal of allPals) {
    for (const [work, level] of Object.entries(pal.workSuitability || {})) {
      if (level >= 3) {
        if (!byWork[work]) byWork[work] = [];
        byWork[work].push({ pal, level });
      }
    }
  }
  // Sort each work group by level desc
  for (const key of Object.keys(byWork)) {
    byWork[key].sort((a, b) => b.level - a.level);
  }

  // Group by rarity
  const byRarity = {};
  const rarityOrder = ['Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'];
  for (const r of rarityOrder) {
    byRarity[r] = allPals.filter(p => p.classification.rarity === r);
  }

  function renderPalTable(pals) {
    const rows = pals.map(p => {
      const tier = palTiers[p.slug] || 'B';
      const works = Object.entries(p.workSuitability || {})
        .filter(([, lv]) => lv >= 3)
        .map(([w, lv]) => `${WORK_LABELS[w]||w} Lv${lv}`)
        .join(', ') || '-';
      return `<tr>
        <td>#${p.number}</td>
        <td><a href="/pals/${p.slug}/">${esc(p.name.en)}</a></td>
        <td><span class="badge badge-element ${(p.classification.elements[0] || 'neutral').toLowerCase()}">${p.classification.elements[0] || 'Unknown'}</span></td>
        <td><span class="badge badge-tier-${tier.toLowerCase()}">${tier}</span></td>
        <td>${works}</td>
      </tr>`;
    }).join('\n');

    return `<table class="data-table">
      <thead><tr><th>#</th><th>Name</th><th>Element</th><th>Tier</th><th>Key Work</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  const elementAccordions = Object.entries(byElement)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([el, pals]) => `<details class="pal-accordion">
      <summary>${el} <span style="font-size:0.8125rem;color:var(--color-text-muted)">(${pals.length} Pals)</span></summary>
      <div class="accordion-content">${renderPalTable(pals)}</div>
    </details>`).join('\n');

  const workAccordions = Object.entries(byWork)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([work, entries]) => `<details class="pal-accordion">
      <summary>${WORK_LABELS[work] || work} <span style="font-size:0.8125rem;color:var(--color-text-muted)">(${entries.length} Pals)</span></summary>
      <div class="accordion-content">${renderPalTable(entries.map(e => e.pal))}</div>
    </details>`).join('\n');

  const rarityAccordions = Object.entries(byRarity)
    .filter(([, pals]) => pals.length > 0)
    .map(([rarity, pals]) => `<details class="pal-accordion">
      <summary>${rarity} <span style="font-size:0.8125rem;color:var(--color-text-muted)">(${pals.length} Pals)</span></summary>
      <div class="accordion-content">${renderPalTable(pals)}</div>
    </details>`).join('\n');

  const bodyHTML = `<div class="container">
  <div class="page-header">
    <h1>All ${allPals.length} Pals</h1>
    <p class="page-description">Browse by Element, Work Type, or Rarity. Click a Pal name to see full stats, skill builds, and breeding paths.</p>
  </div>

  <section class="section">
    <h2>By Element</h2>
    ${elementAccordions}
  </section>

  <section class="section">
    <h2>By Work Type (Lv 3+)</h2>
    ${workAccordions}
  </section>

  <section class="section">
    <h2>By Rarity</h2>
    ${rarityAccordions}
  </section>
</div>`;

  return wrapPage(headHTML, bodyHTML);
}

// ---- Render Guide pages ----
console.log('Rendering guides...');
const guides = [
  { slug: 'best-base-workers', title: TITLE_TEMPLATES.guide1, icon: '🏭', render: renderBaseWorkersGuide },
  { slug: 'best-flying-mounts', title: TITLE_TEMPLATES.guide2, icon: '🦅', render: renderFlyingMountsGuide },
  { slug: 'best-combat-pals', title: TITLE_TEMPLATES.guide3, icon: '⚔️', render: renderCombatGuide },
  { slug: 'breeding-explained', title: TITLE_TEMPLATES.guide4, icon: '🧬', render: renderBreedingGuide },
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
      <h2>Planning Your Breeding Chain</h2>
      <p>The easiest way to plan a breeding chain is:</p>
      <ol style="list-style:decimal;padding-left:20px;margin-bottom:var(--space-4);color:var(--color-text-secondary)">
        <li>Pick your target Pal in the <a href="/breeding-calculator/">Breeding Calculator</a></li>
        <li>Check the easiest parent pairs (sorted by acquisition difficulty)</li>
        <li>If you don't have those parents, repeat the process for each parent</li>
        <li>Work backwards until you reach Pals you already own</li>
      </ol>
    </section>

    <section class="content-upgrade-cta">
      <p>Ready to plan your breeding chain? Our Calculator checks all ${Object.keys(reverseIndex).length} breedable Pals instantly.</p>
      <a href="/breeding-calculator/" class="cta-button cta-button-lg">Open Breeding Calculator →</a>
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
  'shadowbeak', 'paladius', 'necromus', 'jetragon', 'astral_lupus', 'lunaris'];
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
    '      <p class="page-description calc-hero-sub">Breed any two Pals to see their offspring, or pick a target to trace every path to it.</p>\n' +
    '      <div class="calc-hero-stats">\n' +
    '        <span class="calc-hero-stat">📚 323 Pals</span>\n' +
    '        <span class="calc-hero-stat">🔀 50K+ Combos</span>\n' +
    '        <span class="calc-hero-stat">⚡ Instant</span>\n' +
    '      </div>\n' +
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

function renderPalFinder() {
  const title = TITLE_TEMPLATES.palFinder;
  const description = `Filter ${allPals.length} Pals by element, work type, rarity, and mount capability. Compare stats, find the right Pal for your team or base.`.substring(0, 155);
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
      <p class="page-description">Filter <span id="finder-count">${allPals.length} Pals</span> by element, work type, rarity, and more.</p>
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

# AI Crawlers
User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: Google-Extended
Disallow: /

Sitemap: ${DOMAIN}/sitemap.xml
`;
fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robotsTXT);
console.log('  dist/robots.txt');

// llms.txt
const llmsLines = [
  `# ${SITE_NAME}`,
  `> Peer-ranked Pal stats, skill builds, and breeding paths for ${allPals.length} Pals.`,
  '',
  '## Core Pages',
  '- [Home](${DOMAIN}/): Pal stats, mini Calculator, top Pal cards',
  '- [Calculator](${DOMAIN}/breeding-calculator/): Find child from parents or parents from child',
  '- [Pal Finder](${DOMAIN}/pal-finder/): Filter by element, work, rarity',
  '- [All Pals](${DOMAIN}/pals/): Accordion index by element/work/rarity',
  '',
  '## Guides',
  '- [Best Base Workers](${DOMAIN}/guides/best-base-workers/): Work rankings',
  '- [Fastest Flying Mounts](${DOMAIN}/guides/best-flying-mounts/): Speed ranking',
  '- [Best Combat Pals](${DOMAIN}/guides/best-combat-pals/): Attack ranking',
  '- [Breeding Explained](${DOMAIN}/guides/breeding-explained/): Formula + strategy',
  '',
  `## Pal Pages (${allPals.length} total)`,
];
const topPals = allPals.filter(p => palTiers[p.slug] === 'S').slice(0, 10);
for (const p of topPals) {
  llmsLines.push(`- [${p.name.en}](${DOMAIN}/pals/${p.slug}/): ${p.classification.elements[0]} ${p.classification.rarity}, Tier ${palTiers[p.slug]}`);
}
llmsLines.push(`- [...and ${allPals.length - 10} more Pal detail pages](${DOMAIN}/pals/)`);

fs.writeFileSync(path.join(DIST_DIR, 'llms.txt'), llmsLines.join('\n'));
console.log('  dist/llms.txt');

// ---- Summary ----
const sCount = allPals.filter(p => palTiers[p.slug] === 'S').length;
const aCount = allPals.filter(p => palTiers[p.slug] === 'A').length;
const bCount = allPals.filter(p => palTiers[p.slug] === 'B').length;
const totalPages = 1 + 1 + palPagesRendered + 4 + 1 + 1 + 1 + 4 + 1;

console.log(`\n═══ Build Complete ═══`);
console.log(`Total pages:  ${totalPages}`);
console.log(`  Homepage:   1`);
console.log(`  Pal pages:  ${palPagesRendered} (S:${sCount} A:${aCount} B:${bCount})`);
console.log(`  Guides:     5 (4 detail + 1 index)`);
console.log(`  Tools:      2 (Calculator + Pal Finder)`);
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
