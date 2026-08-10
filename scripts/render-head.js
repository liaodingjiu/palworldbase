/**
 * render-head.js — Shared <head> and meta generation
 * Generates title, description, canonical, og:tags, JSON-LD schema.
 *
 * Usage:
 *   const { renderHead, renderSchema } = require('./render-head');
 *   const head = renderHead(config, pageMeta);
 */

const { DOMAIN, SITE_NAME, ALT_TEMPLATES } = require('./config');

/**
 * Escape HTML entities in a string.
 */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate <head> HTML for a page.
 *
 * @param {object} config - The config module
 * @param {object} meta - Page metadata
 * @param {string} meta.title - Page title
 * @param {string} meta.description - Meta description
 * @param {string} meta.canonical - Canonical URL
 * @param {string} meta.ogImage - og:image URL (optional)
 * @param {string} meta.ogType - og:type (default 'website', 'article' for guides)
 * @param {boolean} meta.noIndex - Set to true to add noindex
 * @param {object} meta.schema - JSON-LD schema object (optional)
 * @returns {string} HTML <head> section
 */
function renderHead(config, meta = {}) {
  const {
    title = SITE_NAME,
    description = '',
    canonical = DOMAIN + '/',
    ogImage = DOMAIN + '/assets/og-default.png',
    ogType = 'website',
    noIndex = false,
    schema = null,
  } = meta;

  const escapedTitle = esc(title);
  const escapedDesc = esc(description).substring(0, 300);

  const lines = [
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<title>${escapedTitle}</title>`,
    `<meta name="description" content="${escapedDesc}">`,
    '<meta name="ai-summary" content="AI-generated content. All data verified against game files.">',
    '',
    '<!-- Open Graph -->',
    `<meta property="og:title" content="${escapedTitle}">`,
    `<meta property="og:description" content="${escapedDesc}">`,
    `<meta property="og:url" content="${esc(canonical)}">`,
    `<meta property="og:image" content="${esc(ogImage)}">`,
    `<meta property="og:type" content="${esc(ogType)}">`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}">`,
    '',
    '<!-- Twitter -->',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapedTitle}">`,
    `<meta name="twitter:description" content="${escapedDesc}">`,
    `<meta name="twitter:image" content="${esc(ogImage)}">`,
    '',
    '<!-- Canonical -->',
    `<link rel="canonical" href="${esc(canonical)}">`,
    '',
    '<!-- Preload fonts -->',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '',
    '<!-- Stylesheets -->',
    '<link rel="stylesheet" href="/css/shared.css">',
    '<link rel="stylesheet" href="/css/components.css">',
    '',
    '<!-- Favicon -->',
    '<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/assets/favicon-180.png">',
    '<link rel="manifest" href="/assets/site.webmanifest">',
  ];

  if (noIndex) {
    lines.push('', '<meta name="robots" content="noindex, follow">');
  }

  // JSON-LD Schema
  if (schema) {
    lines.push('', '<!-- JSON-LD Schema -->');
    lines.push(`<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`);
  }

  return lines.join('\n');
}

/**
 * Generate WebSite schema (for homepage).
 */
function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: DOMAIN,
    description: 'Pal stats, builds, skill loadouts, and breeding paths — peer-ranked, not raw stats. Compare every Pal side-by-side.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: DOMAIN + '/pal-finder/?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Generate FAQ schema for a Guide page.
 */
function guideFAQSchema(questions) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(q => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  };
}

/**
 * Generate Pal detail page schema.
 */
function palSchema(pal, canonical) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: `${pal.name.en} — Palworld Pal #${pal.number}`,
    description: `${pal.name.en} is a ${pal.classification.elements.join('/')} ${pal.classification.rarity} Pal in Palworld. HP ${pal.stats.hp}, ATK ${pal.stats.attack}, DEF ${pal.stats.defense}.`,
    url: canonical,
    gamePlatform: ['PC', 'Xbox', 'PlayStation'],
    playMode: { '@type': 'GamePlayMode', name: 'SinglePlayer' },
    characterAttribute: {
      '@type': 'Thing',
      name: `Element: ${pal.classification.elements.join(', ')}`,
    },
    game: {
      '@type': 'VideoGame',
      name: 'Palworld',
      url: 'https://www.pocketpair.jp/palworld',
    },
  };
}

/**
 * Generate BreadcrumbList schema.
 */
function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Generate alternate image alt text using rotation.
 */
function getAltText(pal, variant) {
  const template = ALT_TEMPLATES[variant % ALT_TEMPLATES.length];
  return template(pal);
}

module.exports = {
  renderHead,
  websiteSchema,
  guideFAQSchema,
  palSchema,
  breadcrumbSchema,
  getAltText,
  esc,
};
