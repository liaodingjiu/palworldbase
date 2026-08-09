/**
 * algorithm-breeding.js — Breeding path algorithms (§8.4)
 *
 * Functions:
 *   findBestPath()        — Easiest path to breed a target Pal
 *   findWhatsNext()       — Top 3 valuable children from a parent
 *   getParentPairs()      — All parent pairs for a child
 *   rankByEase()          — Rank pairs by combined acquisition ease
 *   getBreedingDifficulty() — BP-based difficulty label
 *
 * Usage: const breeding = require('./algorithm-breeding');
 */

// ---- Difficulty by BP (higher BP = easier/common, lower = late-game) ----
function getBreedingDifficulty(bp) {
  if (!bp && bp !== 0) return { level: 4, label: 'Unknown', emoji: '❓' };
  if (bp >= 1000) return { level: 1, label: 'Starter', emoji: '🟢' };
  if (bp >= 500)  return { level: 2, label: 'Easy', emoji: '🟢' };
  if (bp >= 200)  return { level: 3, label: 'Medium', emoji: '🟡' };
  if (bp >= 100)  return { level: 4, label: 'Hard', emoji: '🟠' };
  if (bp >= 10)   return { level: 5, label: 'Endgame', emoji: '🔴' };
  return { level: 6, label: 'Legendary', emoji: '⚡' };
}

// ---- Rank parent pairs by combined ease ----
function rankByEase(pairs) {
  return pairs.map(pair => {
    const easeA = getBreedingDifficulty(pair.parent1BP).level;
    const easeB = getBreedingDifficulty(pair.parent2BP).level;
    return { ...pair, easeScore: easeA + easeB };
  }).sort((a, b) => a.easeScore - b.easeScore); // Lower = easier
}

/**
 * Get all parent pairs for a target Pal from the reverse index.
 * @returns {Array} Sorted by ease (easiest first)
 */
function getParentPairs(targetSlug, reverseIndex, maxResults = 30) {
  const pairs = reverseIndex[targetSlug] || [];
  const ranked = rankByEase(pairs);
  return ranked.slice(0, maxResults);
}

/**
 * Find the easiest breeding path to obtain a target Pal.
 *
 * Strategy:
 *   1. Check special combos first (guaranteed unique path)
 *   2. Sort all parent pairs by combined ease
 *   3. Return top N easiest paths
 *
 * @param {string} targetSlug
 * @param {object} reverseIndex — child → parent pairs
 * @param {object} palBP — slug → BP value
 * @param {number} maxPaths — max paths to return
 * @returns {Array} Ranked breeding paths
 */
function findBestPath(targetSlug, reverseIndex, maxPaths = 5) {
  const pairs = reverseIndex[targetSlug] || [];
  if (pairs.length === 0) return [];

  const ranked = rankByEase(pairs);

  const paths = [];
  const seen = new Set();

  for (const pair of ranked) {
    // Deduplicate by parent combination (order-independent)
    const comboKey = [pair.parent1, pair.parent2].sort().join('|');
    if (seen.has(comboKey)) continue;
    seen.add(comboKey);

    paths.push({
      parent1: pair.parent1,
      parent2: pair.parent2,
      parent1BP: pair.parent1BP,
      parent2BP: pair.parent2BP,
      childBP: pair.childBP,
      difficulty: getBreedingDifficulty(pair.parent1BP).label +
                  ' + ' + getBreedingDifficulty(pair.parent2BP).label,
      isSpecial: pair.isSpecial,
      steps: pair.isSpecial ? 1 : 2, // Special = direct, standard = catch+breed
      note: pair.isSpecial ? 'Special combo — guaranteed result' : null,
    });

    if (paths.length >= maxPaths) break;
  }

  return paths;
}

/**
 * Find top valuable children when breeding FROM a given parent.
 * "What to breed after you have this Pal"
 *
 * Strategy: For each other Pal, compute the child and rank by:
 *   1. Child tier (S > A > B)
 *   2. Child rarity (Legendary > Epic > ...)
 *   3. Child stat total
 *
 * @param {string} parentSlug
 * @param {Array} bpSorted — [{slug, bp}] sorted by BP ascending
 * @param {object} palBP — slug → BP
 * @param {Array} specialCombos
 * @param {object} palStats — slug → {tier, rarity, statTotal, name, ...}
 * @returns {Array} Top 3 recommended children
 */
function findWhatsNext(parentSlug, bpSorted, palBP, specialCombos, palStats) {
  const parentBP = palBP[parentSlug];
  if (parentBP === undefined) return [];

  const children = [];

  for (const { slug: otherSlug, bp: otherBP } of bpSorted) {
    if (otherSlug === parentSlug) continue;

    // Check special combos
    let childSlug = null;
    let isSpecial = false;
    for (const sc of specialCombos) {
      if ((sc.a === parentSlug && sc.b === otherSlug) ||
          (sc.a === otherSlug && sc.b === parentSlug)) {
        childSlug = sc.c;
        isSpecial = true;
        break;
      }
    }

    // Standard formula
    if (!childSlug) {
      const avg = Math.floor((parentBP + otherBP) / 2);
      // Find Pal with closest BP
      let bestSlug = null, bestDist = Infinity;
      for (const { slug, bp } of bpSorted) {
        const dist = Math.abs(bp - avg);
        if (dist < bestDist) {
          bestDist = dist;
          bestSlug = slug;
        }
      }
      childSlug = bestSlug;
    }

    const childInfo = palStats[childSlug];
    if (!childInfo) continue;

    // Only consider useful children (not self, not lower tier)
    children.push({
      child: childSlug,
      otherParent: otherSlug,
      childName: childInfo.name || childSlug,
      childTier: childInfo.tier || 'B',
      childRarity: childInfo.rarity || 'Common',
      childStatTotal: childInfo.statTotal || 0,
      isSpecial,
    });
  }

  // Deduplicate by child
  const seen = new Set();
  const unique = [];
  for (const c of children) {
    if (seen.has(c.child)) continue;
    seen.add(c.child);
    unique.push(c);
  }

  // Score: tier (S=3, A=2, B=1) + rarity bonus + stat bonus
  const tierScore = { S: 300, A: 200, B: 100 };
  const rarityBonus = { Legendary: 50, Epic: 40, Rare: 30, Uncommon: 20, Common: 10 };

  unique.sort((a, b) => {
    const scoreA = (tierScore[a.childTier] || 0) + (rarityBonus[a.childRarity] || 0) + a.childStatTotal;
    const scoreB = (tierScore[b.childTier] || 0) + (rarityBonus[b.childRarity] || 0) + b.childStatTotal;
    return scoreB - scoreA;
  });

  // Return top 3
  return unique.slice(0, 3).map(c => ({
    child: c.child,
    childName: c.childName,
    otherParent: c.otherParent,
    childTier: c.childTier,
    isSpecial: c.isSpecial,
    reason: c.isSpecial
      ? `Special combo — breed with ${c.otherParent}`
      : `Produce a Tier ${c.childTier} ${c.childRarity} Pal`,
  }));
}

module.exports = {
  getBreedingDifficulty,
  rankByEase,
  getParentPairs,
  findBestPath,
  findWhatsNext,
};
