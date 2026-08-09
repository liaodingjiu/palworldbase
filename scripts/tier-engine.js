#!/usr/bin/env node
/**
 * tier-engine.js — S/A/B Tier Classification (3-Layer Funnel)
 *
 * Layer 1: 13-signal scoring + breeding centrality
 * Layer 2: 8 hard rules
 * Layer 3: manual overrides from tier-overrides.json
 *
 * Output: data/pal-tiers.json
 *
 * Usage: node scripts/tier-engine.js
 */

const fs = require('fs');
const path = require('path');

const PALS_DIR = path.join(__dirname, '..', 'data', 'pals');
const OVERRIDES_PATH = path.join(__dirname, '..', 'data', 'tier-overrides.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'pal-tiers.json');
const BREEDING_RANKS_PATH = path.join(__dirname, '..', 'data', 'wiki-breeding-ranks.json');

// ---- Load data ----
function loadPals() {
  const pals = [];
  const files = fs.readdirSync(PALS_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const pal = JSON.parse(fs.readFileSync(path.join(PALS_DIR, f), 'utf8'));
    // Skip placeholders — Pals with number=0 and empty names
    if (pal.number === 0 && !pal.name.en) continue;
    // Skip unreleased/placeholder Pals
    if (pal._source && pal.number === 0 && pal.skills.every(s => !s.name)) continue;
    pals.push(pal);
  }
  return pals;
}

function loadBreedingRanks() {
  if (!fs.existsSync(BREEDING_RANKS_PATH)) return null;
  const raw = JSON.parse(fs.readFileSync(BREEDING_RANKS_PATH, 'utf8'));
  const map = {};
  raw.forEach(entry => { map[entry.name.toLowerCase()] = entry.bp; });
  return map;
}

// ---- Layer 1: Signal Scoring ----

function computeStatTotal(pal) {
  return pal.stats.hp + pal.stats.attack + pal.stats.defense + pal.stats.speed;
}

function computePercentileRank(values, target) {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = sorted.findIndex(v => v >= target);
  return idx === -1 ? 100 : Math.round((idx / sorted.length) * 100);
}

function maxWorkLevel(pal) {
  let max = 0;
  for (const v of Object.values(pal.workSuitability || {})) {
    if (v > max) max = v;
  }
  return max;
}

function hasUniqueWorkLv4(pal, allPals) {
  for (const [work, level] of Object.entries(pal.workSuitability || {})) {
    if (level >= 4) {
      const others = allPals.filter(p =>
        p.slug !== pal.slug && (p.workSuitability[work] || 0) >= 4
      );
      if (others.length === 0) return true;
    }
  }
  return false;
}

function countBestFor(pal) {
  return (pal.decision && pal.decision.bestFor) ? pal.decision.bestFor.length : 0;
}

function computeBreedingCentrality(palSlug, allPals, tiers, breedingRanks) {
  // Count unique S/A-tier species this Pal can produce as a parent
  if (!breedingRanks) return 0;
  const thisBP = breedingRanks[palSlug.toLowerCase()];
  if (!thisBP) return 0;

  const produced = new Set();
  for (const other of allPals) {
    const otherBP = breedingRanks[other.slug.toLowerCase()];
    if (!otherBP || other.slug === palSlug) continue;
    // Child BP = floor((thisBP + otherBP) / 2)
    const childBP = Math.floor((thisBP + otherBP) / 2);
    // Find child Pal whose BP is closest
    let closest = null, closestDist = Infinity;
    for (const p of allPals) {
      const pBP = breedingRanks[p.slug.toLowerCase()];
      if (!pBP) continue;
      const dist = Math.abs(pBP - childBP);
      if (dist < closestDist) {
        closestDist = dist;
        closest = p;
      }
    }
    if (closest && tiers[closest.slug] === 'S') {
      produced.add(closest.slug);
    }
  }
  return produced.size;
}

function scoreLayer1(pal, allPals, statTotals, tiers, breedingRanks) {
  let score = 0;
  const reasons = [];

  // 1. Rarity bonus
  const rarityScore = { Legendary: 30, Epic: 20, Rare: 10, Uncommon: 5, Common: 0 };
  const rScore = rarityScore[pal.classification.rarity] || 0;
  score += rScore;
  if (rScore > 0) reasons.push(`rarity:${pal.classification.rarity}`);

  // 2. Max work level
  const maxW = maxWorkLevel(pal);
  if (maxW >= 4) { score += 25; reasons.push('work:Lv4'); }
  else if (maxW >= 3) { score += 15; reasons.push('work:Lv3'); }

  // 3. Unique Lv4 work (only Pal in game with that work at Lv4)
  if (hasUniqueWorkLv4(pal, allPals)) { score += 20; reasons.push('unique-work'); }

  // 4. Flyable
  if (pal.classification.isFlyable) { score += 20; reasons.push('flyable'); }

  // 5. Rideable
  if (pal.classification.isRideable && !pal.classification.isFlyable) { score += 10; reasons.push('rideable'); }

  // 6. Stat total percentile
  const myTotal = computeStatTotal(pal);
  const pctRank = computePercentileRank(statTotals, myTotal);
  if (pctRank >= 90) { score += 20; reasons.push('stats:top10%'); }
  else if (pctRank >= 75) { score += 10; reasons.push('stats:top25%'); }

  // 7. Breeding power (low = hard to breed = late game = high interest)
  const bp = pal.breeding && pal.breeding.breedingPower;
  if (bp && bp < 100) { score += 15; reasons.push('bp:endgame'); }
  else if (bp && bp < 200) { score += 10; reasons.push('bp:hard'); }

  // 8. Boss encounter
  if (pal.acquisition && pal.acquisition.isBossEncounter) { score += 10; reasons.push('boss'); }

  // 9. Dual element
  if (pal.classification.elements.length >= 2) { score += 5; reasons.push('dual-element'); }

  // 10. Breeding centrality (counts S-tier children only, not S+A)
  if (tiers && breedingRanks) {
    const centrality = computeBreedingCentrality(pal.slug, allPals, tiers, breedingRanks);
    if (centrality >= 4) { score += 15; reasons.push(`centrality:${centrality}`); }
    else if (centrality >= 2) { score += 8; reasons.push(`centrality:${centrality}`); }
  }

  // 11. High attack
  if (pal.stats.attack >= 120) { score += 5; reasons.push('high-atk'); }

  // 12. Multi-role (bestFor count)
  const bfCount = countBestFor(pal);
  if (bfCount >= 4) { score += 10; reasons.push(`multi-role:${bfCount}`); }
  else if (bfCount >= 2) { score += 5; reasons.push(`role:${bfCount}`); }

  // 13. Number of skills
  if (pal.skills && pal.skills.length >= 7) { score += 5; reasons.push('rich-skills'); }

  return { score, reasons };
}

// ---- Layer 2: Hard Rules (applied in order) ----

function applyHardRules(pal, allPals, initialTier, tiers, breedingRanks) {
  let tier = initialTier;
  const appliedRules = [];

  // Rule 1: Legendary → force S
  if (pal.classification.rarity === 'Legendary') {
    tier = 'S';
    appliedRules.push('legendary→S');
  }

  // Rule 2: number ≤ 10 and Common → force B
  if (pal.number <= 10 && pal.classification.rarity === 'Common') {
    tier = 'B';
    appliedRules.push('starter→B');
  }

  // Rule 3: Unique Lv4 work → force S
  if (hasUniqueWorkLv4(pal, allPals)) {
    tier = 'S';
    appliedRules.push('unique-lv4→S');
  }

  // Rule 4: Breeding bridge (produces ≥3 S-tier Pals as parent) → upgrade to A
  // Only applies to B-tier — a B Pal that's a critical breeding bridge deserves A
  if (tier === 'B' && breedingRanks) {
    // Count unique S-tier species this Pal can produce
    let sProducedByBridge = 0;
    if (tiers && breedingRanks) {
      const thisBP = breedingRanks[pal.slug.toLowerCase()];
      if (thisBP) {
        const produced = new Set();
        for (const other of allPals) {
          const otherBP = breedingRanks[other.slug.toLowerCase()];
          if (!otherBP || other.slug === pal.slug) continue;
          const childBP = Math.floor((thisBP + otherBP) / 2);
          let closest = null, closestDist = Infinity;
          for (const p of allPals) {
            const pBP = breedingRanks[p.slug.toLowerCase()];
            if (!pBP) continue;
            const dist = Math.abs(pBP - childBP);
            if (dist < closestDist) { closestDist = dist; closest = p; }
          }
          if (closest && tiers[closest.slug] === 'S') {
            produced.add(closest.slug);
          }
        }
        sProducedByBridge = produced.size;
      }
    }
    if (sProducedByBridge >= 3) {
      tier = 'A';
      appliedRules.push('bridge→A');
    }
  }

  // Rule 5: Boss encounter + rarity ≥ Epic → upgrade (B→A only)
  if (pal.acquisition && pal.acquisition.isBossEncounter) {
    const rarityLvl = { Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4 };
    if ((rarityLvl[pal.classification.rarity] || 0) >= 3 && tier === 'B') {
      tier = 'A';
      appliedRules.push('boss-epic→A');
    }
  }

  // Rule 6: BP < 100 → force S or A
  const bp = pal.breeding && pal.breeding.breedingPower;
  if (bp && bp < 100 && tier === 'B') {
    tier = 'A';
    appliedRules.push('bp<100→A');
  }

  // Rule 7: Dual element + flyable → upgrade one level
  if (pal.classification.elements.length >= 2 && pal.classification.isFlyable && tier === 'B') {
    tier = 'A';
    appliedRules.push('dual-fly→A');
  }

  // Rule 8: bestFor ≥ 4 → upgrade one level
  if (countBestFor(pal) >= 4 && tier !== 'S') {
    tier = 'A';
    appliedRules.push('bestFor≥4→A');
  }

  return { tier, appliedRules };
}

// ---- Layer 3: Manual Overrides ----

function applyOverrides(tiers) {
  if (!fs.existsSync(OVERRIDES_PATH)) return tiers;
  const overrides = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'));
  for (const [slug, tier] of Object.entries(overrides)) {
    if (tier === 'S' || tier === 'A' || tier === 'B') {
      tiers[slug] = tier;
    }
  }
  return tiers;
}

// ---- Main ----

function main() {
  console.log('Loading Pals...');
  const allPals = loadPals();
  console.log(`Loaded ${allPals.length} Pals`);

  const breedingRanks = loadBreedingRanks();
  console.log(`Loaded breeding ranks: ${breedingRanks ? Object.keys(breedingRanks).length : 0} entries`);

  // Compute stat totals for percentile ranking
  const statTotals = allPals.map(p => computeStatTotal(p));

  // ---- Pass 1: Score without breeding centrality ----
  console.log('\nLayer 1 (pass 1): Scoring without centrality...');
  const noTiers = {}; // No tiers yet
  const scores1 = new Map();
  allPals.forEach(pal => {
    const { score, reasons } = scoreLayer1(pal, allPals, statTotals, null, breedingRanks);
    scores1.set(pal.slug, { score, reasons, pal });
  });

  // Assign initial tiers based on thresholds
  const initialTiers = {};
  const S_THRESHOLD = 100;
  const A_THRESHOLD = 65;

  allPals.forEach(pal => {
    const s = scores1.get(pal.slug);
    if (!s) { initialTiers[pal.slug] = 'B'; return; }
    if (s.score >= S_THRESHOLD) initialTiers[pal.slug] = 'S';
    else if (s.score >= A_THRESHOLD) initialTiers[pal.slug] = 'A';
    else initialTiers[pal.slug] = 'B';
  });

  // ---- Pass 2: Re-score with breeding centrality ----
  console.log('Layer 1 (pass 2): Scoring with breeding centrality...');
  const scores2 = new Map();
  allPals.forEach(pal => {
    const { score, reasons } = scoreLayer1(pal, allPals, statTotals, initialTiers, breedingRanks);
    scores2.set(pal.slug, { score, reasons, pal });
  });

  // Re-assign tiers
  const l1Tiers = {};
  allPals.forEach(pal => {
    const s = scores2.get(pal.slug);
    if (!s) { l1Tiers[pal.slug] = 'B'; return; }
    if (s.score >= S_THRESHOLD) l1Tiers[pal.slug] = 'S';
    else if (s.score >= A_THRESHOLD) l1Tiers[pal.slug] = 'A';
    else l1Tiers[pal.slug] = 'B';
  });

  // ---- Layer 2: Hard rules ----
  console.log('Layer 2: Applying hard rules...');
  const l2Tiers = {};
  const ruleLog = [];
  allPals.forEach(pal => {
    const { tier, appliedRules } = applyHardRules(pal, allPals, l1Tiers[pal.slug] || 'B', l1Tiers, breedingRanks);
    l2Tiers[pal.slug] = tier;
    if (appliedRules.length > 0) {
      ruleLog.push({ slug: pal.slug, name: pal.name.en, from: l1Tiers[pal.slug], to: tier, rules: appliedRules });
    }
  });

  // ---- Layer 3: Overrides ----
  console.log('Layer 3: Applying manual overrides...');
  const finalTiers = applyOverrides({ ...l2Tiers });

  // ---- Output ----
  const sCount = Object.values(finalTiers).filter(t => t === 'S').length;
  const aCount = Object.values(finalTiers).filter(t => t === 'A').length;
  const bCount = Object.values(finalTiers).filter(t => t === 'B').length;

  console.log(`\n=== Tier Distribution ===`);
  console.log(`S: ${sCount} | A: ${aCount} | B: ${bCount} | Total: ${sCount + aCount + bCount}`);

  // Top S-tier Pals
  console.log(`\n=== S Tier (${sCount}) ===`);
  const sList = allPals.filter(p => finalTiers[p.slug] === 'S')
    .map(p => ({ slug: p.slug, name: p.name.en, rarity: p.classification.rarity, score: scores2.get(p.slug)?.score || 0 }))
    .sort((a, b) => b.score - a.score);
  sList.forEach(p => console.log(`  ${p.score} | ${p.name} | ${p.rarity}`));

  // Rule changes
  console.log(`\n=== Rule Applications (${ruleLog.length}) ===`);
  ruleLog.forEach(r => console.log(`  ${r.name}: ${r.from} → ${r.to} [${r.rules.join(', ')}]`));

  // Write output
  const output = {};
  for (const [slug, tier] of Object.entries(finalTiers)) {
    output[slug] = tier;
  }
  output._metadata = {
    sCount, aCount, bCount,
    thresholds: { s: S_THRESHOLD, a: A_THRESHOLD },
    buildDate: new Date().toISOString().split('T')[0],
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${OUTPUT_PATH}`);

  // Also write tier info back into each Pal JSON
  console.log('Updating Pal JSONs with tier field...');
  let updated = 0;
  allPals.forEach(pal => {
    const tier = finalTiers[pal.slug];
    if (pal.tier !== tier) {
      pal.tier = tier;
      const filePath = path.join(PALS_DIR, `${pal.slug}.json`);
      fs.writeFileSync(filePath, JSON.stringify(pal, null, 2) + '\n');
      updated++;
    }
  });
  console.log(`Updated ${updated} Pal JSONs with tier field`);
}

main();
