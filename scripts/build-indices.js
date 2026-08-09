#!/usr/bin/env node
/**
 * build-indices.js — Pre-compute breeding & element indices
 *
 * Outputs:
 *   data/reverse-breeding.json — child → all parent pairs
 *   data/forward-breeding.json — parent pair → child
 *   data/element-peers.json    — element → Pals sorted by stats
 *   data/pal-stats.json        — Pal stat lookup for Calculator/Finder
 *
 * Usage: node scripts/build-indices.js
 */

const fs = require('fs');
const path = require('path');

const PALS_DIR = path.join(__dirname, '..', 'data', 'pals');
const SPECIAL_PATH = path.join(__dirname, '..', 'data', 'special-combos.json');
const OUT_DIR = path.join(__dirname, '..', 'data');

// ---- Load data ----
function loadPals() {
  const pals = [];
  const files = fs.readdirSync(PALS_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const pal = JSON.parse(fs.readFileSync(path.join(PALS_DIR, f), 'utf8'));
    if (pal.number === 0 && !pal.name.en) continue;
    pals.push(pal);
  }
  return pals;
}

function loadSpecialCombos() {
  if (!fs.existsSync(SPECIAL_PATH)) return [];
  return JSON.parse(fs.readFileSync(SPECIAL_PATH, 'utf8'));
}

// ---- Utility ----
function computeStatTotal(pal) {
  return pal.stats.hp + pal.stats.attack + pal.stats.defense + pal.stats.speed;
}

// ---- Breeding child lookup ----
// Uses pre-sorted BP array for O(log N) closest-match lookup
function findChildByBP(slugA, slugB, bpA, bpB, palBPList, bpSorted, specialCombos) {
  // 1. Check special combos first
  for (const sc of specialCombos) {
    if ((sc.a === slugA && sc.b === slugB) || (sc.a === slugB && sc.b === slugA)) {
      const childBP = palBPList[sc.c];
      if (childBP !== undefined) {
        return { slug: sc.c, bp: childBP, isSpecial: true };
      }
    }
  }

  // 2. Standard formula: child = Pal with BP closest to floor(avg)
  const avg = Math.floor((bpA + bpB) / 2);

  // Binary search for closest BP
  let lo = 0, hi = bpSorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bpSorted[mid].bp < avg) lo = mid + 1;
    else hi = mid;
  }
  // Check lo and lo-1 for closest
  let best = bpSorted[lo];
  let bestDist = Math.abs(best.bp - avg);
  if (lo > 0) {
    const prev = bpSorted[lo - 1];
    const prevDist = Math.abs(prev.bp - avg);
    if (prevDist < bestDist || (prevDist === bestDist && prev.bp < best.bp)) {
      best = prev;
      bestDist = prevDist;
    }
  }

  return { slug: best.slug, bp: best.bp, isSpecial: false };
}

// ---- Sort key for parent pairs (deterministic) ----
function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// ---- Main ----
function main() {
  console.log('Loading data...');
  const allPals = loadPals();
  console.log(`  ${allPals.length} Pals loaded`);

  const specialCombos = loadSpecialCombos();
  console.log(`  ${specialCombos.length} special combos loaded`);

  // Build BP lookup directly from Pal JSONs (breeding.breedingPower)
  const palBP = {};
  const bpSorted = [];
  for (const pal of allPals) {
    const bp = pal.breeding && pal.breeding.breedingPower;
    if (bp !== undefined && bp !== null) {
      palBP[pal.slug] = bp;
      bpSorted.push({ slug: pal.slug, bp });
    }
  }
  bpSorted.sort((a, b) => a.bp - b.bp);

  // Filter to Pals with BP values
  const palsWithBP = allPals.filter(p => palBP[p.slug] !== undefined);
  console.log(`  ${palsWithBP.length} Pals have BP values (${bpSorted.length} in sorted index)`);

  // ---- Build reverse-breeding.json (top 30 pairs per child) ----
  // Full scan to collect all pairs, then trim to top 30 easiest per child
  console.log('\nBuilding reverse breeding index (top 30 per child)...');
  const reverseFull = {};
  const total = palsWithBP.length;

  for (let i = 0; i < total; i++) {
    for (let j = i; j < total; j++) {
      const a = palsWithBP[i];
      const b = palsWithBP[j];
      const bpA = palBP[a.slug];
      const bpB = palBP[b.slug];

      if (bpA === undefined || bpB === undefined) continue;

      const child = findChildByBP(a.slug, b.slug, bpA, bpB, palBP, bpSorted, specialCombos);
      if (!child || !child.slug) continue;

      if (!reverseFull[child.slug]) reverseFull[child.slug] = [];
      reverseFull[child.slug].push({
        parent1: a.slug,
        parent2: b.slug,
        parent1BP: bpA,
        parent2BP: bpB,
        avgBP: Math.floor((bpA + bpB) / 2),
        childBP: child.bp,
        isSpecial: child.isSpecial,
      });
    }
  }

  // Sort and trim: special combos always kept, then top by ease
  const MAX_PAIRS = 30;
  const reverseIndex = {};
  let totalPairsFull = 0;
  let totalPairsTrimmed = 0;

  for (const [slug, pairs] of Object.entries(reverseFull)) {
    totalPairsFull += pairs.length;

    // Separate special combos from standard pairs
    const specials = pairs.filter(p => p.isSpecial);
    const standards = pairs.filter(p => !p.isSpecial);

    // Sort standards by combined BP (higher = easier to obtain)
    standards.sort((x, y) =>
      (y.parent1BP + y.parent2BP) - (x.parent1BP + x.parent2BP)
    );

    // Keep all specials + top standards up to MAX_PAIRS
    const trimmed = [...specials, ...standards.slice(0, MAX_PAIRS - specials.length)];
    reverseIndex[slug] = trimmed;
    totalPairsTrimmed += trimmed.length;
  }

  const reversePath = path.join(OUT_DIR, 'reverse-breeding.json');
  fs.writeFileSync(reversePath, JSON.stringify(reverseIndex, null, 2));
  console.log(`  ${Object.keys(reverseIndex).length} children`);
  console.log(`  ${totalPairsFull} total pairs → ${totalPairsTrimmed} after trimming (top ${MAX_PAIRS} + specials)`);
  console.log(`  → ${reversePath}`);

  // ---- Build minimal BP lookup for Calculator (client-side) ----
  // The Calculator does on-the-fly computation using the formula:
  //   1. Check special combos
  //   2. child = Pal with BP closest to floor((bpA + bpB) / 2)
  // We only need: slug→BP map + sorted BP list + special combos
  console.log('\nBuilding Calculator BP lookup...');
  const bpLookup = {
    _note: 'For client-side Calculator. Formula: child = closest BP to floor((bpA+bpB)/2)',
    specialCombos,
    palBP,
    bpSorted: bpSorted.map(e => e.slug), // Ordered by BP ascending
  };
  const bpLookupPath = path.join(OUT_DIR, 'calculator-data.json');
  fs.writeFileSync(bpLookupPath, JSON.stringify(bpLookup, null, 2));
  console.log(`  ${bpSorted.length} BPs, ${specialCombos.length} special combos → ${bpLookupPath}`);

  // ---- Build element-peers.json ----
  console.log('\nBuilding element peer index...');
  const elementPeers = {};

  for (const pal of allPals) {
    const statTotal = computeStatTotal(pal);
    for (const element of pal.classification.elements) {
      if (!elementPeers[element]) elementPeers[element] = [];
      elementPeers[element].push({
        slug: pal.slug,
        name: pal.name.en,
        number: pal.number,
        rarity: pal.classification.rarity,
        tier: pal.tier || 'B',
        statTotal,
        stats: {
          hp: pal.stats.hp,
          attack: pal.stats.attack,
          defense: pal.stats.defense,
          speed: pal.stats.speed,
        },
      });
    }
  }

  // Sort each element's Pals by stat total descending, assign rank
  for (const [element, pals] of Object.entries(elementPeers)) {
    pals.sort((a, b) => b.statTotal - a.statTotal);
    pals.forEach((p, i) => { p.rank = i + 1; });
  }

  const peersPath = path.join(OUT_DIR, 'element-peers.json');
  fs.writeFileSync(peersPath, JSON.stringify(elementPeers, null, 2));
  const peerCounts = Object.entries(elementPeers).map(([el, pals]) => `  ${el}: ${pals.length}`);
  console.log(`  ${Object.keys(elementPeers).length} elements → ${peersPath}`);
  console.log(peerCounts.join('\n'));

  // ---- Build pal-stats.json (lightweight lookup for Calculator/Finder) ----
  console.log('\nBuilding Pal stats lookup...');
  const palStats = allPals.map(pal => ({
    slug: pal.slug,
    name: pal.name.en,
    number: pal.number,
    elements: pal.classification.elements,
    rarity: pal.classification.rarity,
    tier: pal.tier || 'B',
    bp: palBP[pal.slug] || null,
    statTotal: computeStatTotal(pal),
    stats: {
      hp: pal.stats.hp,
      attack: pal.stats.attack,
      defense: pal.stats.defense,
      speed: pal.stats.speed,
    },
    workSuitability: pal.workSuitability,
    isRideable: pal.classification.isRideable,
    isFlyable: pal.classification.isFlyable,
  })).sort((a, b) => a.number - b.number);

  const statsPath = path.join(OUT_DIR, 'pal-stats.json');
  fs.writeFileSync(statsPath, JSON.stringify(palStats, null, 2));
  console.log(`  ${palStats.length} Pals → ${statsPath}`);

  // ---- Summary ----
  console.log('\n=== Build Complete ===');
  console.log(`reverse-breeding.json:  ${Object.keys(reverseIndex).length} children, ${totalPairsTrimmed} pairs (top ${MAX_PAIRS}/child)`);
  console.log(`calculator-data.json:    ${bpSorted.length} BPs, ${specialCombos.length} special combos`);
  console.log(`element-peers.json:      ${Object.keys(elementPeers).length} elements`);
  console.log(`pal-stats.json:          ${palStats.length} Pals`);

  // Verify top Pal
  const anubisPairs = reverseIndex['anubis'];
  if (anubisPairs) {
    console.log(`\nVerification: Anubis has ${anubisPairs.length} displayed breeding pairs`);
    console.log(`  Top 3:`);
    anubisPairs.slice(0, 3).forEach(p => {
      console.log(`    ${p.parent1} (BP:${p.parent1BP}) + ${p.parent2} (BP:${p.parent2BP}) → Anubis (BP:${p.childBP}) ${p.isSpecial ? '⭐' : ''}`);
    });
  }
}

main();
