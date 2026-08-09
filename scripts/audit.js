/**
 * audit.js — Post-build quality verification (§15.1-15.4)
 *
 * Three checks run against all generated Pal pages:
 *   1. N-gram overlap scan — any 5-gram in >20% pages = content too homogeneous
 *   2. Structure fingerprint — count unique H2 sequences (target ≥10)
 *   3. Word count distribution — std dev (target >200), histogram by tier
 *
 * Usage: const audit = require('./audit'); audit.run(distDir, palTiers);
 */

const fs = require('fs');
const path = require('path');

// ---- Config ----
const NGRAM_SIZE = 5;
const NGRAM_THRESHOLD = 0.20; // Flag if a 5-gram appears in >20% of pages
const STRUCTURE_MIN_UNIQUE = 10; // Minimum unique H2 patterns
const WORDCOUNT_MIN_STDDEV = 200; // Minimum word count standard deviation

/**
 * Main entry point. Runs all audits and prints reports.
 */
function run(distDir, palTiers) {
  const palsDir = path.join(distDir, 'pals');
  const slugs = fs.readdirSync(palsDir).filter(f => {
    const full = path.join(palsDir, f);
    return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'index.html'));
  });

  if (slugs.length === 0) {
    console.log('\n⚠️  Audit skipped: no Pal pages found in dist/pals/');
    return { passed: false, slugCount: 0 };
  }

  console.log(`\n📋 Running quality audits on ${slugs.length} Pal pages...\n`);

  const pages = loadPages(palsDir, slugs, palTiers);

  // Run checks
  const ngramResult = checkNGrams(pages);
  const structureResult = checkStructure(pages);
  const wordCountResult = checkWordCount(pages);

  // Print reports
  printNGramReport(ngramResult);
  printStructureReport(structureResult);
  printWordCountReport(wordCountResult);

  // Overall verdict
  const passed = ngramResult.passed && structureResult.passed && wordCountResult.passed;
  printVerdict(passed, ngramResult, structureResult, wordCountResult);

  return {
    passed,
    slugCount: slugs.length,
    ngram: ngramResult,
    structure: structureResult,
    wordCount: wordCountResult,
  };
}

// ---- Page Loading ----
function loadPages(palsDir, slugs, palTiers) {
  return slugs.map(slug => {
    const filePath = path.join(palsDir, slug, 'index.html');
    const html = fs.readFileSync(filePath, 'utf8');
    const tier = palTiers[slug] || 'B';

    // Extract main content (between <main> tags) for n-gram
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const bodyText = mainMatch
      ? stripHTML(mainMatch[1])
      : stripHTML(html);

    // Extract H2 sequence for structure fingerprint
    const h2Matches = html.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || [];
    const h2Texts = h2Matches.map(h => {
      const inner = h.replace(/<h2[^>]*>/i, '').replace(/<\/h2>/i, '');
      // Normalize: remove Pal names to detect structural patterns
      return normalizeH2(inner.trim(), slug);
    });

    // Word count (main content only, no HTML tags)
    const words = bodyText.split(/\s+/).filter(w => w.length > 0);

    return { slug, html, bodyText, h2Texts, words, wordCount: words.length, tier };
  });
}

function stripHTML(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/&#?\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize H2 text: replace the Pal name with PAL_NAME to detect structural
 * patterns regardless of which Pal the page is about.
 */
function normalizeH2(h2Text, slug) {
  // Build candidate names from slug (e.g., "kingpaca_cryst" → ["Kingpaca Cryst", "Kingpaca"])
  const parts = slug.split('_');
  const variants = [];
  for (let i = 0; i < parts.length; i++) {
    variants.push(parts.slice(i).map(capitalize).join(' '));
  }

  let result = h2Text;
  for (const v of variants) {
    if (v.length > 2) {
      result = result.replace(new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 'PAL_NAME');
    }
  }

  // Additional: normalize common pattern variations
  result = result.replace(/About PAL_NAME/g, 'About PAL_NAME');
  result = result.replace(/PAL_NAME Stats Compared/g, 'PAL_NAME Stats Compared');
  result = result.replace(/PAL_NAME vs \w+ Pals/g, 'PAL_NAME vs ELEMENT Pals');
  result = result.replace(/vs \w+ Pals/g, 'vs ELEMENT Pals');
  result = result.replace(/Skill Builds for PAL_NAME/g, 'Skill Builds for PAL_NAME');
  result = result.replace(/Best Skills for PAL_NAME/g, 'Best Skills for PAL_NAME');
  result = result.replace(/How to Breed PAL_NAME/g, 'How to Breed PAL_NAME');
  result = result.replace(/Breeding PAL_NAME/g, 'Breeding PAL_NAME');
  result = result.replace(/PAL_NAME Base Work/g, 'PAL_NAME Base Work');
  result = result.replace(/What to Breed After PAL_NAME/g, 'What to Breed After PAL_NAME');

  return result;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ================================================================
// Check 1: N-gram Overlap
// ================================================================

function checkNGrams(pages) {
  const ngramPages = new Map(); // ngram → Set of page slugs

  for (const page of pages) {
    const tokens = page.bodyText.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    const seen = new Set();

    for (let i = 0; i <= tokens.length - NGRAM_SIZE; i++) {
      const ngram = tokens.slice(i, i + NGRAM_SIZE).join(' ');
      if (!seen.has(ngram)) {
        seen.add(ngram);
        if (!ngramPages.has(ngram)) ngramPages.set(ngram, new Set());
        ngramPages.get(ngram).add(page.slug);
      }
    }
  }

  const total = pages.length;
  const threshold = Math.ceil(total * NGRAM_THRESHOLD);

  // Collect violations
  const violations = [];
  for (const [ngram, pageSet] of ngramPages) {
    const count = pageSet.size;
    if (count >= threshold) {
      violations.push({ ngram, count, pct: parseFloat(((count / total) * 100).toFixed(1)) });
    }
  }

  // Sort by frequency descending
  violations.sort((a, b) => b.count - a.count);

  // Also compute the "overlap score" — what % of all 5-grams appear in >1 page
  let totalUnique = ngramPages.size;
  let sharedCount = 0;
  for (const [, pageSet] of ngramPages) {
    if (pageSet.size > 1) sharedCount++;
  }
  const sharedPct = totalUnique > 0 ? ((sharedCount / totalUnique) * 100).toFixed(1) : 0;

  const passed = violations.length === 0;

  return { passed, violations, total, threshold, totalUnique, sharedCount, sharedPct };
}

function printNGramReport(result) {
  console.log('━'.repeat(60));
  console.log('📝 N-Gram Overlap Scan (5-word sequences)');
  console.log('━'.repeat(60));
  console.log(`  Pages scanned:    ${result.total}`);
  console.log(`  Threshold:        >${Math.ceil(result.total * NGRAM_THRESHOLD)} pages (${(NGRAM_THRESHOLD * 100).toFixed(0)}%)`);
  console.log(`  Unique 5-grams:   ${result.totalUnique.toLocaleString()}`);
  console.log(`  Shared in >1 pg:  ${result.sharedCount.toLocaleString()} (${result.sharedPct}%)`);

  if (result.violations.length === 0) {
    console.log(`  ✅ No 5-gram exceeds the threshold.`);
  } else {
    console.log(`  ❌ ${result.violations.length} 5-grams appear too frequently:\n`);
    // Show top 10
    for (const v of result.violations.slice(0, 10)) {
      console.log(`     "${v.ngram}" — ${v.count} pages (${v.pct}%)`);
    }
    if (result.violations.length > 10) {
      console.log(`     ... and ${result.violations.length - 10} more.`);
    }
  }
  console.log();
}

// ================================================================
// Check 2: Structure Fingerprint (H2 diversity)
// ================================================================

function checkStructure(pages) {
  // Count unique H2 sequences (as joined strings)
  const patternCounts = new Map();
  const tierPatterns = { S: new Map(), A: new Map(), B: new Map() };

  for (const page of pages) {
    const key = page.h2Texts.join(' → ');
    patternCounts.set(key, (patternCounts.get(key) || 0) + 1);

    const tMap = tierPatterns[page.tier] || tierPatterns.B;
    tMap.set(key, (tMap.get(key) || 0) + 1);
  }

  const uniquePatterns = patternCounts.size;
  const passed = uniquePatterns >= STRUCTURE_MIN_UNIQUE;

  // Find most common patterns
  const sortedPatterns = [...patternCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Per-tier pattern breakdown
  const tierBreakdown = {};
  for (const tier of ['S', 'A', 'B']) {
    const tMap = tierPatterns[tier];
    tierBreakdown[tier] = {
      unique: tMap.size,
      mostCommon: [...tMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
    };
  }

  return { passed, uniquePatterns, sortedPatterns, tierBreakdown };
}

function printStructureReport(result) {
  console.log('━'.repeat(60));
  console.log('🏗️  Structure Fingerprint (H2 sequences, Pal names normalized)');
  console.log('━'.repeat(60));
  console.log(`  Unique H2 patterns: ${result.uniquePatterns} (min: ${STRUCTURE_MIN_UNIQUE})`);

  if (result.passed) {
    console.log(`  ✅ Good — ${result.uniquePatterns} unique H2 sequences found.`);
  } else {
    console.log(`  ❌ Only ${result.uniquePatterns} unique patterns — content structure is too homogeneous.\n`);
  }

  console.log('\n  Top patterns:');
  for (const [pattern, count] of result.sortedPatterns.slice(0, 8)) {
    console.log(`    [${count}×] ${pattern}`);
  }

  console.log('\n  Per-tier:');
  for (const tier of ['S', 'A', 'B']) {
    const tb = result.tierBreakdown[tier];
    console.log(`    ${tier}-tier: ${tb.unique} unique patterns`);
    for (const [p, c] of tb.mostCommon) {
      console.log(`      [${c}×] ${p}`);
    }
  }
  console.log();
}

// ================================================================
// Check 3: Word Count Distribution
// ================================================================

function checkWordCount(pages) {
  const counts = pages.map(p => p.wordCount);
  const n = counts.length;

  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const sum = counts.reduce((s, c) => s + c, 0);
  const mean = sum / n;
  const variance = counts.reduce((s, c) => s + (c - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const passed = stdDev >= WORDCOUNT_MIN_STDDEV;

  // Histogram by tier
  const tierStats = { S: [], A: [], B: [] };
  for (const page of pages) {
    (tierStats[page.tier] || tierStats.B).push(page.wordCount);
  }

  const tierReport = {};
  for (const tier of ['S', 'A', 'B']) {
    const arr = tierStats[tier];
    if (arr.length === 0) {
      tierReport[tier] = { count: 0, min: 0, max: 0, mean: 0 };
      continue;
    }
    tierReport[tier] = {
      count: arr.length,
      min: Math.min(...arr),
      max: Math.max(...arr),
      mean: Math.round(arr.reduce((s, v) => s + v, 0) / arr.length),
    };
  }

  // Distribution buckets
  const buckets = [0, 600, 800, 1000, 1200, 1400, 99999];
  const bucketLabels = ['<600', '600–799', '800–999', '1000–1199', '1200–1399', '1400+'];
  const histogram = bucketLabels.map((label, i) => {
    const lo = buckets[i], hi = buckets[i + 1];
    const count = counts.filter(c => c >= lo && c < hi).length;
    const bar = '█'.repeat(Math.round(count / n * 50));
    return { label, count, pct: parseFloat(((count / n) * 100).toFixed(1)), bar };
  });

  return { passed, n, min, max, mean: Math.round(mean), stdDev: Math.round(stdDev), tierReport, histogram };
}

function printWordCountReport(result) {
  console.log('━'.repeat(60));
  console.log('📊 Word Count Distribution');
  console.log('━'.repeat(60));
  console.log(`  Pages:       ${result.n}`);
  console.log(`  Mean:        ${result.mean} words`);
  console.log(`  Std Dev:     ${result.stdDev} (min: ${WORDCOUNT_MIN_STDDEV})`);
  console.log(`  Range:       ${result.min} – ${result.max}`);

  if (result.passed) {
    console.log(`  ✅ StdDev ≥ ${WORDCOUNT_MIN_STDDEV} — good content depth variation.`);
  } else {
    console.log(`  ❌ StdDev < ${WORDCOUNT_MIN_STDDEV} — content depth is too uniform between tiers.\n`);
    console.log('  💡 Fix: Add more sections to S-tier pages or trim B-tier to increase variance.');
  }

  console.log('\n  By Tier:');
  for (const tier of ['S', 'A', 'B']) {
    const t = result.tierReport[tier];
    console.log(`    ${tier}-tier (${t.count} Pals): mean ${t.mean} words, range ${t.min}–${t.max}`);
  }

  console.log('\n  Distribution:');
  for (const bucket of result.histogram) {
    const pad = ' '.repeat(Math.max(0, 8 - bucket.label.length));
    console.log(`    ${bucket.label}${pad} ${bucket.bar} ${bucket.count} (${bucket.pct}%)`);
  }
  console.log();
}

// ================================================================
// Overall Verdict
// ================================================================

function printVerdict(passed, ngram, structure, wordCount) {
  console.log('═'.repeat(60));
  if (passed) {
    console.log('✅ ALL AUDITS PASSED');
  } else {
    console.log('❌ AUDIT FAILURES DETECTED');
    if (!ngram.passed)   console.log('   • N-gram overlap exceeds threshold');
    if (!structure.passed) console.log('   • Structure fingerprint too homogeneous');
    if (!wordCount.passed)  console.log('   • Word count std dev below minimum');
  }
  console.log('═'.repeat(60));
  console.log();
}

module.exports = { run, checkNGrams, checkStructure, checkWordCount };
