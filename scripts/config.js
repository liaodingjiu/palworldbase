/**
 * config.js — PalworldBase central configuration
 * Domain, navigation, meta templates, color system, and template rotation logic.
 */

const DOMAIN = 'https://palworldbase.net';
const SITE_NAME = 'PalworldBase';
const BUILD_DATE = new Date().toISOString().split('T')[0];
const BUILD_YEAR = new Date().getFullYear();

// ---- Navigation ----
const NAV = [
  { label: 'Breeding Calculator', href: '/breeding-calculator/', title: 'Palworld Breeding Calculator' },
  { label: 'Pal Finder', href: '/pal-finder/', title: 'Filter Pals by Element, Work & Role' },
  { label: 'All Pals', href: '/pals/', title: 'Browse All 319 Pals' },
  { label: 'Guides', href: '/guides/', title: 'Palworld Strategy Guides' },
  { label: 'About', href: '/about/', title: 'About PalworldBase' },
];

// ---- Footer links ----
const FOOTER = {
  tools: [
    { label: 'Breeding Calculator', href: '/breeding-calculator/' },
    { label: 'Pal Finder', href: '/pal-finder/' },
    { label: 'All Pals', href: '/pals/' },
    { label: 'Guides', href: '/guides/' },
  ],
  info: [
    { label: 'About', href: '/about/' },
    { label: 'Privacy', href: '/privacy/' },
    { label: 'Terms', href: '/terms/' },
    { label: 'Cookie Policy', href: '/cookie-policy/' },
    { label: 'Contact', href: 'mailto:support@palworldbase.net' },
    { label: 'Sitemap', href: '/sitemap.xml' },
  ],
};

// ---- Color System (PRD §3.6) ----
const ELEMENT_COLORS = {
  Fire: { hex: '#ff6b4a', css: '--color-element-fire' },
  Water: { hex: '#4da6ff', css: '--color-element-water' },
  Grass: { hex: '#5cd859', css: '--color-element-grass' },
  Ground: { hex: '#d4a040', css: '--color-element-ground' },
  Electric: { hex: '#ffd940', css: '--color-element-electric' },
  Ice: { hex: '#64d8e8', css: '--color-element-ice' },
  Dragon: { hex: '#b080e0', css: '--color-element-dragon' },
  Dark: { hex: '#c860a0', css: '--color-element-dark' },
  Neutral: { hex: '#9098a8', css: '--color-element-neutral' },
};

const WORK_COLORS = {
  kindling: { hex: '#f07848', css: '--color-work-kindling' },
  watering: { hex: '#58a0e8', css: '--color-work-watering' },
  planting: { hex: '#68c058', css: '--color-work-planting' },
  generating: { hex: '#f0c840', css: '--color-work-generating' },
  handiwork: { hex: '#e89840', css: '--color-work-handiwork' },
  gathering: { hex: '#80b040', css: '--color-work-gathering' },
  lumbering: { hex: '#b89050', css: '--color-work-lumbering' },
  mining: { hex: '#9098a8', css: '--color-work-mining' },
  medicine: { hex: '#e870a0', css: '--color-work-medicine' },
  cooling: { hex: '#58c0c8', css: '--color-work-cooling' },
  transporting: { hex: '#60a0d0', css: '--color-work-transporting' },
  farming: { hex: '#88b850', css: '--color-work-farming' },
};

const WORK_LABELS = {
  kindling: 'Kindling', watering: 'Watering', planting: 'Planting',
  generating: 'Generating', handiwork: 'Handiwork', gathering: 'Gathering',
  lumbering: 'Lumbering', mining: 'Mining', medicine: 'Medicine',
  cooling: 'Cooling', transporting: 'Transporting', farming: 'Farming',
};

const RARITY_ORDER = { 'Common': 1, 'Uncommon': 2, 'Rare': 3, 'Epic': 4, 'Legendary': 5 };
const RARITY_BONUS = { 'Common': 0, 'Uncommon': 5, 'Rare': 10, 'Epic': 20, 'Legendary': 30 };
const RARITY_BREEDING = { 'Common': 1, 'Uncommon': 2, 'Rare': 3, 'Epic': 4, 'Legendary': 5 };

// ---- Title Templates (PRD §5.1) ----
const TITLE_TEMPLATES = {
  home: `${SITE_NAME} — Pal Stats, Builds & Breeding Compared`,
  calculator: `Palworld Breeding Calculator — Shortest Path to Any Pal`,
  palFinder: `${SITE_NAME} Pal Finder — Filter 319 Pals by Element, Work & Role`,
  palsIndex: `All 319 Pals — Browse by Element, Work & Rarity`,
  guides: `Palworld Guides — Best Pals, Breeding & Strategy`,
  guide1: `Best Base Workers — Mining, Kindling & Every Role Ranked`,
  guide2: `Fastest Flying Mounts — Speed Ranking for All Ridable Pals`,
  guide3: `Best Combat Pals — DPS Ranking by Element`,
  guide4: `Palworld Breeding Explained — Formula, Paths & Calculator`,
  palS: (pal) => {
    const name = pal.name.en;
    const el = pal.classification.elements[0];
    const t = `${name} Stats & Breeding — vs All ${el} Pals`;
    return t.length <= 60 ? t : `${name} Stats & Breeding — vs ${el} Pals`;
  },
  palA: (pal) => {
    const name = pal.name.en;
    const el = pal.classification.elements[0];
    const t = `${name} | ${el} Pal: Stats & Breeding Path`;
    return t.length <= 60 ? t : `${name} | ${el}: Stats & Breeding Path`;
  },
  palB: (pal) => {
    const name = pal.name.en;
    const num = pal.number;
    const el = pal.classification.elements[0];
    const t = `${name} | #${num} ${el} Stats & Location`;
    return t.length <= 60 ? t : `${name} | #${num} ${el} Stats`;
  },
};

// ---- Description Template Rotation (PRD §5.5 items 1-2) ----
const DESC_TEMPLATES = {
  // S-tier: ranking type
  sRanking: (pal, rank, topStat, statVal) => {
    const unique = getUniqueSellingPoint(pal);
    return `${pal.name.en} ranks #${rank} in ${topStat} among all ${pal.classification.elements[0]} Pals. Compare stats, skill loadout, and every breeding path that produces ${pal.name.en}. ${unique}`.substring(0, 155);
  },
  // S-tier: work type
  sWork: (pal, comboCount) => {
    const works = Object.entries(pal.workSuitability).filter(([k, v]) => v >= 3).map(([k, v]) => `${WORK_LABELS[k]} Lv ${v}`).join(', ');
    const unique = getUniqueSellingPoint(pal);
    return `${pal.name.en}: ${works} — top base worker. ${comboCount} breeding pairs that produce ${pal.name.en}. Compared to every ${pal.classification.elements[0]} Pal.`.substring(0, 155);
  },
  // A-tier: 4 rotation templates
  aRanking: (pal, rank, stat, comboCount) =>
    `${pal.name.en} ranks #${rank} in ${stat} among ${pal.classification.elements[0]} Pals. ${comboCount} breeding pairs, stats breakdown, and best breeding path — verified.`.substring(0, 155),
  aVersatile: (pal, roles, comboCount) =>
    `${pal.name.en} is a top ${roles.join(' and ')} in Palworld. See how it stacks up against other ${pal.classification.elements[0]} Pals — stats, skills, and ${comboCount} breeding pairs.`.substring(0, 155),
  aBreeding: (pal, comboCount) =>
    `${comboCount} possible parent pairs can produce ${pal.name.en}. Compare stats vs other ${pal.classification.elements[0]} Pals, and find the easiest breeding path.`.substring(0, 155),
  aDefault: (pal, comboCount) =>
    `${pal.name.en} stats, breeding paths, and how it compares to every ${pal.classification.elements[0]} Pal. Paldeck #${pal.number}. ${comboCount} parent combos verified.`.substring(0, 155),
  // B-tier: 3 rotation templates
  bDefault: (pal) =>
    `Every breeding pair that makes ${pal.name.en} — Paldeck #${pal.number}. ${pal.classification.elements[0]} · ${pal.classification.rarity}. HP ${pal.stats.hp}, ATK ${pal.stats.attack}. All ${pal.classification.elements[0]} Pals ranked.`.substring(0, 155),
  bAcquisition: (pal) =>
    `Where to find ${pal.name.en} and every way to breed it. Paldeck #${pal.number}. ${pal.classification.elements[0]} · ${pal.classification.rarity}. Stats, locations, and all ${pal.classification.elements[0]} Pals compared.`.substring(0, 155),
  bData: (pal, comboCount) =>
    `${pal.name.en} (#${pal.number}) stats: HP ${pal.stats.hp}, ATK ${pal.stats.attack}, DEF ${pal.stats.defense}. ${pal.classification.elements[0]} · ${pal.classification.rarity}. All ${comboCount} parent pairs that produce ${pal.name.en}.`.substring(0, 155),
};

function getUniqueSellingPoint(pal) {
  // Find the most interesting fact about this Pal
  const works = Object.entries(pal.workSuitability);
  const uniqueLv4 = works.find(([k, v]) => v === 4);
  if (uniqueLv4) return `Only Pal with ${WORK_LABELS[uniqueLv4[0]]} Lv 4.`;
  if (pal.classification.rarity === 'Legendary') return `Legendary ${pal.classification.elements[0]} Pal.`;
  if (pal.stats.speed >= 200) return `One of the fastest Pals at ${pal.stats.speed} Speed.`;
  if (pal.breeding && pal.breeding.breedingPower && pal.breeding.breedingPower < 100)
    return `Breeding Power ${pal.breeding.breedingPower} — hard to breed.`;
  return '';
}

// ---- Section Heading Variants (PRD §5.5 item 3) ----
const SECTION_HEADINGS = {
  roleDashboard: { S: (pal) => `How ${pal.name.en} Performs`, A: (pal) => `${pal.name.en} at a Glance` },
  peerComparison: { S: (pal) => `${pal.name.en} vs ${pal.classification.elements[0]} Pals`, A: (pal) => `${pal.name.en} Stats Compared` },
  skillBuilds: { S: (pal) => `Best Skills for ${pal.name.en}`, A: (pal) => `Skill Builds for ${pal.name.en}` },
  breedingPath: { S: (pal) => `How to Breed ${pal.name.en}`, A: (pal) => `How to Breed ${pal.name.en}`, B: (pal) => `Breeding ${pal.name.en}` },
  workEfficiency: { S: (pal) => `${pal.name.en} Base Work`, A: (pal) => `${pal.name.en} Base Work`, B: () => 'Work Suitability' },
  acquisition: { S: (pal) => `How to Get ${pal.name.en}`, A: (pal) => `How to Get ${pal.name.en}`, B: (pal) => `Where to Find ${pal.name.en}` },
  drops: { S: (pal) => `What ${pal.name.en} Drops`, A: (pal) => `What ${pal.name.en} Drops`, B: () => 'Drops & Materials' },
  comparison: { S: (pal) => `Compare ${pal.name.en} Side-by-Side`, A: (pal) => `Compare ${pal.name.en}`, B: () => 'Compare Pals' },
  fullSkillPool: (pal) => `All ${pal.name.en}'s Skills`,
  allParentCombos: (pal, count) => `All ${count} Parent Pairs for ${pal.name.en}`,
  whatsNext: (pal) => `What to Breed After ${pal.name.en}`,
};

// ---- Alt Text Rotation (PRD §5.5 item 5) ----
const ALT_TEMPLATES = [
  (pal) => `${pal.name.en} — ${pal.classification.elements[0]} ${pal.classification.rarity} Pal in Palworld`,
  (pal) => `${pal.name.en} (${pal.classification.elements[0]}) · Paldeck #${pal.number} · Palworld`,
  (pal) => `${pal.name.en} Palworld — ${pal.classification.elements[0]} type, ${pal.classification.rarity} rarity`,
];

// ---- CTA Text Rotation (PRD §5.5 item 4) ----
const CTA_TEMPLATES = [
  (pal, comboCount) => `You just saw the shortest path. Want to see ALL combinations — including ones that use Pals you already own?`,
  (pal, comboCount) => `That's one path. But ${pal.name.en} has ${comboCount} possible parent pairs. Find the one that fits your roster.`,
  (pal, comboCount) => `There are ${comboCount} ways to breed ${pal.name.en}. Open the Calculator to find the easiest pair you can make right now.`,
];

module.exports = {
  DOMAIN, SITE_NAME, BUILD_DATE, BUILD_YEAR,
  NAV, FOOTER,
  ELEMENT_COLORS, WORK_COLORS, WORK_LABELS,
  RARITY_ORDER, RARITY_BONUS, RARITY_BREEDING,
  TITLE_TEMPLATES, DESC_TEMPLATES,
  SECTION_HEADINGS, ALT_TEMPLATES, CTA_TEMPLATES,
  getUniqueSellingPoint,
};
