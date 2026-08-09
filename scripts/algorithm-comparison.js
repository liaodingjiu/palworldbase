/**
 * algorithm-comparison.js — Peer comparison & Z-score analysis (§8.5)
 *
 * Generates stat rankings, Z-scores, and comparison sentences
 * for a Pal vs its element peers.
 *
 * Usage: const comparison = require('./algorithm-comparison');
 */

/**
 * Compute mean of an array of numbers.
 */
function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Compute standard deviation of an array of numbers.
 */
function stdDev(values, avg) {
  if (values.length <= 1) return 1; // Avoid division by zero
  const m = avg !== undefined ? avg : mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance) || 1;
}

/**
 * Compute Z-scores for a Pal's stats against its element peers.
 *
 * Z-score = (value - mean) / stdDev
 * Positive = above average, negative = below average.
 * |Z| > 1.5 is notable, |Z| > 2.0 is exceptional.
 *
 * @param {object} pal - The target Pal {stats: {hp, attack, defense, speed}}
 * @param {Array} peers - Array of peer Pals with same stat structure
 * @returns {object} Z-scores and rankings
 */
function computeZScores(pal, peers) {
  if (!peers || peers.length === 0) return null;

  const statKeys = ['hp', 'attack', 'defense', 'speed'];
  const peerValues = {};
  const peerStats = {};

  for (const key of statKeys) {
    peerValues[key] = peers.map(p => p.stats[key]);
    peerStats[key] = {
      mean: mean(peerValues[key]),
      stdDev: stdDev(peerValues[key]),
    };
  }

  const zScores = {};
  const rankings = {};
  for (const key of statKeys) {
    const myVal = pal.stats[key];
    const { mean: m, stdDev: sd } = peerStats[key];
    zScores[key] = sd > 0 ? parseFloat(((myVal - m) / sd).toFixed(2)) : 0;

    // Rank: count how many peers have higher values
    const higher = peerValues[key].filter(v => v > myVal).length;
    rankings[key] = { rank: higher + 1, total: peers.length, pct: Math.round((1 - higher / peers.length) * 100) };
  }

  // Overall Z-score (sum of individual Z-scores)
  const overallZ = parseFloat(Object.values(zScores).reduce((s, z) => s + z, 0).toFixed(2));

  // Best stat (highest Z-score) and worst stat
  let bestStat = statKeys[0], worstStat = statKeys[0];
  let bestZ = zScores[statKeys[0]], worstZ = zScores[statKeys[0]];
  for (const key of statKeys) {
    if (zScores[key] > bestZ) { bestZ = zScores[key]; bestStat = key; }
    if (zScores[key] < worstZ) { worstZ = zScores[key]; worstStat = key; }
  }

  return {
    zScores,
    rankings,
    overallZ,
    bestStat: { key: bestStat, z: bestZ, rank: rankings[bestStat] },
    worstStat: { key: worstStat, z: worstZ, rank: rankings[worstStat] },
    peerCount: peers.length,
  };
}

/**
 * Rank a Pal among its element peers by stat total.
 *
 * @returns {{ rank: number, total: number, pct: number, statTotal: number }}
 */
function rankAmongPeers(pal, peers) {
  const myTotal = pal.stats.hp + pal.stats.attack + pal.stats.defense + pal.stats.speed;
  const peerTotals = peers.map(p =>
    p.stats.hp + p.stats.attack + p.stats.defense + p.stats.speed
  );
  const higher = peerTotals.filter(t => t > myTotal).length;
  return {
    rank: higher + 1,
    total: peers.length,
    pct: Math.round((1 - higher / peers.length) * 100),
    statTotal: myTotal,
  };
}

/**
 * Generate comparison sentences with varied structures.
 *
 * Returns an array of fact strings, each using a different sentence template
 * to avoid repetitive patterns across pages.
 */
function generateComparisonSentences(pal, zResults, rankResult, variant) {
  const sentences = [];

  if (!zResults || !rankResult) return sentences;

  const name = pal.name.en;
  const element = pal.classification.elements[0];
  const { bestStat, worstStat, peerCount, zScores, rankings } = zResults;

  // Template 1: Overall rank
  sentences.push(
    `${name} ranks #${rankResult.rank} out of ${peerCount} ${element} Pals by total stats (HP+ATK+DEF+SPD).`
  );

  // Template 2: Best stat
  const bestLabel = bestStat.key === 'hp' ? 'HP' :
                    bestStat.key === 'attack' ? 'Attack' :
                    bestStat.key === 'defense' ? 'Defense' : 'Speed';
  if (bestStat.z > 1.0) {
    const templates = [
      `With ${pal.stats[bestStat.key]} ${bestLabel}, ${name} is in the top ${bestStat.rank.pct}% of ${element} Pals for ${bestLabel.toLowerCase()}.`,
      `${name}'s standout stat is ${bestLabel} (${pal.stats[bestStat.key]}) — ranking #${bestStat.rank.rank}/${peerCount} among ${element} Pals.`,
      `At ${pal.stats[bestStat.key]} ${bestLabel}, ${name} outperforms ${bestStat.rank.pct}% of ${element} Pals.`,
    ];
    sentences.push(templates[variant % templates.length]);
  }

  // Template 3: Worst stat (if notable)
  if (worstStat.z < -0.5) {
    const worstLabel = worstStat.key === 'hp' ? 'HP' :
                       worstStat.key === 'attack' ? 'Attack' :
                       worstStat.key === 'defense' ? 'Defense' : 'Speed';
    sentences.push(
      `${name}'s ${worstLabel} (${pal.stats[worstStat.key]}) is below the ${element} average — compensate with skill selection or partner Pal.`
    );
  }

  // Template 4: Exceptional stats (Z > 2.0)
  const exceptional = Object.entries(zScores)
    .filter(([, z]) => Math.abs(z) > 2.0)
    .map(([key]) => key);

  if (exceptional.length > 0) {
    const statNames = exceptional.map(k =>
      k === 'hp' ? 'HP' : k === 'attack' ? 'Attack' : k === 'defense' ? 'Defense' : 'Speed'
    );
    sentences.push(
      `${name} is an outlier among ${element} Pals — its ${statNames.join(' and ')} is significantly above the ${element} average.`
    );
  }

  return sentences;
}

module.exports = {
  mean,
  stdDev,
  computeZScores,
  rankAmongPeers,
  generateComparisonSentences,
};
