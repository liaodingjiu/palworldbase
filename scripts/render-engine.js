/**
 * render-engine.js — Simple template rendering engine
 * Pure string interpolation, zero dependencies.
 *
 * Usage:
 *   const { renderTemplate, renderPage } = require('./render-engine');
 *   const html = renderTemplate(templatePath, variables);
 *   const page = renderPage(templatePath, variables, config);
 */

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const COMPONENTS_DIR = path.join(TEMPLATES_DIR, 'components');

// Cache for loaded templates
const templateCache = new Map();

/**
 * Load a template file (with caching).
 */
function loadTemplate(templatePath) {
  if (templateCache.has(templatePath)) {
    return templateCache.get(templatePath);
  }
  const content = fs.readFileSync(templatePath, 'utf8');
  templateCache.set(templatePath, content);
  return content;
}

/**
 * Load a shared component.
 */
function loadComponent(name) {
  const compPath = path.join(COMPONENTS_DIR, `${name}.html`);
  return loadTemplate(compPath);
}

/**
 * Render a template by replacing {{PLACEHOLDER}} markers.
 * Supports:
 *   {{KEY}}           — simple replacement
 *   {{#SECTION}}...{{/SECTION}} — conditional block: rendered if KEY is truthy
 *   {{^SECTION}}...{{/SECTION}} — inverted conditional: rendered if KEY is falsy
 *   {{!COMMENT}}      — stripped from output
 *
 * If a variable is a function, it is called with no arguments.
 */
function renderTemplate(templatePath, variables = {}) {
  let template = loadTemplate(templatePath);

  // Strip comments: {{! ... }}
  template = template.replace(/\{\{!\s*[\s\S]*?\}\}/g, '');

  // Handle conditional blocks: {{#KEY}}...{{/KEY}}
  template = template.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, key, content) => {
    const val = variables[key];
    if (Array.isArray(val)) {
      // If it's an array, render the block for each item
      // The item's properties become the context within the block
      return val.map(item => {
        if (typeof item === 'object') {
          return renderString(content, { ...variables, ...item });
        }
        return renderString(content, { ...variables, [key]: item });
      }).join('');
    }
    return val ? renderString(content, variables) : '';
  });

  // Handle inverted conditionals: {{^KEY}}...{{/KEY}}
  template = template.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, key, content) => {
    const val = variables[key];
    return (!val || (Array.isArray(val) && val.length === 0)) ? renderString(content, variables) : '';
  });

  // Replace simple variables: {{KEY}}
  template = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const val = variables[key];
    if (val === undefined || val === null) return '';
    if (typeof val === 'function') return val();
    return String(val);
  });

  return template;
}

/**
 * Render a string (not a file) with variables.
 */
function renderString(str, variables = {}) {
  // Simple variable replacement only (no conditionals in strings)
  return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const val = variables[key];
    if (val === undefined || val === null) return '';
    if (typeof val === 'function') return val();
    return String(val);
  });
}

/**
 * Render a full page: template + shared components (header, footer, cookie-banner).
 *
 * @param {string} templatePath - Path to the page template
 * @param {object} variables - Template variables
 * @param {object} config - The config module (from config.js)
 * @param {object} opts - Options
 * @param {string} opts.activeNav - Which nav item is active ('calculator'|'finder'|'pals'|'guides'|'about')
 * @param {boolean} opts.includeCookieBanner - Whether to include cookie consent (default true)
 * @returns {string} Full HTML page
 */
function renderPage(templatePath, variables = {}, config = null, opts = {}) {
  const { activeNav = null, includeCookieBanner = true } = opts;

  // Build header nav HTML with active state
  const navHTML = buildNavHTML(config, activeNav);

  // Render shared components
  const headerHTML = renderTemplate(
    path.join(COMPONENTS_DIR, 'header.html'),
    { ...variables, NAV_ITEMS: navHTML, config }
  );

  const footerHTML = renderTemplate(
    path.join(COMPONENTS_DIR, 'footer.html'),
    { ...variables, config }
  );

  const cookieHTML = includeCookieBanner
    ? renderTemplate(path.join(COMPONENTS_DIR, 'cookie-banner.html'), { config })
    : '';

  // Render page body
  const bodyHTML = renderTemplate(templatePath, {
    ...variables,
    config,
    header: headerHTML,
    footer: footerHTML,
    cookieBanner: cookieHTML,
  });

  return bodyHTML;
}

/**
 * Build navigation HTML with active state.
 */
function buildNavHTML(config, activeNav) {
  const nav = config ? config.NAV : [
    { label: 'Calculator', href: '/breeding-calculator/' },
    { label: 'Pal Finder', href: '/pal-finder/' },
    { label: 'All Pals', href: '/pals/' },
    { label: 'Guides', href: '/guides/' },
    { label: 'About', href: '/about/' },
  ];

  return nav.map(item => {
    const key = item.label.toLowerCase().replace(/\s+/g, '-');
    // Map nav labels to activeNav values
    const navMap = {
      'calculator': 'calculator',
      'pal-finder': 'finder',
      'all-pals': 'pals',
      'guides': 'guides',
      'about': 'about',
    };
    const isActive = navMap[key] === activeNav;
    return `<a href="${item.href}"${isActive ? ' class="active" aria-current="page"' : ''}>${item.label}</a>`;
  }).join('\n      ');
}

/**
 * Clear the template cache (useful during development).
 */
function clearCache() {
  templateCache.clear();
}

module.exports = {
  renderTemplate,
  renderString,
  renderPage,
  loadTemplate,
  loadComponent,
  clearCache,
  TEMPLATES_DIR,
  COMPONENTS_DIR,
};
