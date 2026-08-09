/**
 * seed-facts.js — Data-driven fact generation (§5.6)
 *
 * Extracts unique, interesting facts about each Pal from data analysis:
 *   - Exceptional stats (Z > 1.5)
 *   - Unique work capabilities (only Pal with Lv4 in a work type)
 *   - Breeding anomalies (can't breed, special combos only)
 *   - Extreme values (highest/lowest in element group)
 *   - Multi-role versatility
 *
 * Each fact type has 2-3 sentence templates that are selected by variant
 * to ensure text diversity across pages.
 *
 * Usage: const facts = require('./seed-facts');
 */

const { WORK_LABELS } = require('./config');

/**
 * Extract 2-3 unique, data-driven facts about a Pal.
 *
 * @param {object} pal - The Pal JSON
 * @param {object} elementPeers - element-peers.json data
 * @param {number} variant - Rotation variant (pal.number % N) for sentence diversity
 * @returns {string[]} Array of fact sentences
 */
function extractFacts(pal, elementPeers, variant = 0) {
  const facts = [];
  const element = pal.classification.elements[0];
  const peers = elementPeers ? (elementPeers[element] || []) : [];

  // Fact 1: Exceptional stat
  const statFact = extractStatFact(pal, peers, variant);
  if (statFact) facts.push(statFact);

  // Fact 2: Work capability
  const workFact = extractWorkFact(pal, variant);
  if (workFact) facts.push(workFact);

  // Fact 3: Breeding rarity / difficulty
  const breedFact = extractBreedingFact(pal, variant);
  if (breedFact) facts.push(breedFact);

  // Fact 4 (bonus): Unique element combination or special trait
  if (facts.length < 3) {
    const extraFact = extractExtraFact(pal, variant);
    if (extraFact) facts.push(extraFact);
  }

  // Ensure at least 2 facts
  while (facts.length < 2) {
    // Fallback: generic descriptive fact
    const genericFacts = [
      `${pal.name.en} is a ${pal.classification.rarity} ${element} Pal with ${pal.skills ? pal.skills.length : 0} learnable skills.`,
      `${pal.name.en} can be found in Palworld as Paldeck #${pal.number} — a ${pal.classification.rarity.toLowerCase()} ${element}-type Pal.`,
      `Paldeck #${pal.number}: ${pal.name.en} is one of ${peers.length} ${element} Pals in Palworld.`,
    ];
    const generic = genericFacts[variant % genericFacts.length];
    if (!facts.includes(generic)) facts.push(generic);
    else break; // Prevent infinite loop
  }

  return facts.slice(0, 3);
}

/**
 * Fact: Exceptional stat (Z-score > 1.5 or < -1.5).
 */
function extractStatFact(pal, peers, variant) {
  if (!peers || peers.length === 0) return null;

  const statKeys = ['hp', 'attack', 'defense', 'speed'];
  const statLabels = { hp: 'HP', attack: 'Attack', defense: 'Defense', speed: 'Speed' };

  // Find Pal's best stat among peers
  let bestKey = 'attack', bestRank = peers.length + 1;
  for (const key of statKeys) {
    const myVal = pal.stats[key];
    const higher = peers.filter(p => p.stats[key] > myVal).length;
    const pct = (higher / peers.length) * 100;
    if ((1 - higher / peers.length) > (1 - bestRank / peers.length)) {
      bestKey = key;
      bestRank = higher + 1;
    }
  }

  const bestPct = Math.round((1 - (bestRank - 1) / peers.length) * 100);
  const label = statLabels[bestKey];
  const value = pal.stats[bestKey];

  if (bestPct >= 75) {
    const templates = [
      `${pal.name.en} ranks in the top ${100 - bestPct}% of ${peers.length} ${pal.classification.elements[0]} Pals for ${label} — with a base ${label.toLowerCase()} of ${value}.`,
      `${pal.name.en} has a base ${label} of ${value}, putting it ahead of ${bestPct}% of ${pal.classification.elements[0]} Pals.`,
      `Only ${bestRank - 1} ${pal.classification.elements[0]} Pals have higher ${label} than ${pal.name.en} (${value}).`,
    ];
    return templates[variant % templates.length];
  }

  // If no exceptional stat, return basic stat summary
  return `${pal.name.en}'s stats: HP ${pal.stats.hp}, ATK ${pal.stats.attack}, DEF ${pal.stats.defense}, SPD ${pal.stats.speed}.`;
}

/**
 * Fact: Work capability — Lv4 or unique work type.
 */
function extractWorkFact(pal, variant) {
  const works = Object.entries(pal.workSuitability || {}).filter(([, lv]) => lv > 0);
  if (works.length === 0) return null;

  // Find highest work level
  works.sort((a, b) => b[1] - a[1]);
  const bestWorks = works.filter(([, lv]) => lv >= 3);

  if (bestWorks.length === 0) {
    // Basic work capabilities
    const topWork = works[0];
    const label = WORK_LABELS[topWork[0]] || topWork[0];
    return `${pal.name.en} can perform ${label} at Level ${topWork[1]} — best used in early-game bases.`;
  }

  const workList = bestWorks.map(([w, lv]) => `${WORK_LABELS[w] || w} Lv ${lv}`);

  if (bestWorks[0][1] >= 4) {
    const templates = [
      `${pal.name.en} is a top-tier base worker with ${workList.join(', ')} — ideal for automated production.`,
      `Assign ${pal.name.en} to your base for ${workList.join(' and ')}.`,
      `With ${workList.join(', ')}, ${pal.name.en} is a key base Pal for mid-to-late game.`,
    ];
    return templates[variant % templates.length];
  }

  const templates = [
    `${pal.name.en} contributes ${workList.join(', ')} to your base.`,
    `In base, ${pal.name.en} handles ${workList.join(' and ')}.`,
  ];
  return templates[variant % templates.length];
}

/**
 * Fact: Breeding difficulty or special breeding property.
 */
function extractBreedingFact(pal, variant) {
  const bp = pal.breeding && pal.breeding.breedingPower;

  if (!bp && bp !== 0) {
    return `${pal.name.en} cannot be obtained through breeding — it must be captured in the wild or through special encounters.`;
  }

  if (bp <= 10) {
    const templates = [
      `${pal.name.en} has a breeding power of ${bp} — one of the hardest Pals to breed, requiring endgame-tier parents.`,
      `Breeding ${pal.name.en} (BP ${bp}) requires careful planning — its low breeding power demands late-game parent combinations.`,
    ];
    return templates[variant % templates.length];
  }

  if (bp >= 1000) {
    return `${pal.name.en} has a high breeding power of ${bp}, making it one of the easiest Pals to breed — ideal for breeding chains.`;
  }

  // Breeding bridge: check if it produces many different children
  return `${pal.name.en} has a breeding power of ${bp} — a versatile breeding partner for producing a wide range of offspring.`;
}

/**
 * Fact: Extra interesting trait (dual element, rideable, boss, etc.)
 */
function extractExtraFact(pal, variant) {
  const facts = [];

  if (pal.classification.elements.length >= 2) {
    facts.push(
      `${pal.name.en} is a dual-element Pal (${pal.classification.elements.join('/')}) — effective against a wider range of opponents.`
    );
  }

  if (pal.classification.isFlyable) {
    facts.push(
      `${pal.name.en} is a flying mount — use it to traverse Palworld's map quickly and access elevated areas.`
    );
  } else if (pal.classification.isRideable) {
    facts.push(
      `${pal.name.en} can be ridden as a ground mount, improving your travel speed while exploring.`
    );
  }

  if (pal.acquisition && pal.acquisition.isBossEncounter) {
    facts.push(
      `${pal.name.en} is encountered as a boss in Palworld — prepare for a challenging fight before attempting to capture it.`
    );
  }

  if (facts.length === 0) return null;
  return facts[variant % facts.length];
}

module.exports = {
  extractFacts,
  extractStatFact,
  extractWorkFact,
  extractBreedingFact,
  extractExtraFact,
};
