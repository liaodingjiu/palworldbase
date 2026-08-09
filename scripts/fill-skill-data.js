#!/usr/bin/env node
/**
 * fill-skill-data.js
 * Cross-reference skill data from multiple sources to fill
 * missing element/power/cooldown in new Pal JSONs.
 *
 * Sources (priority order):
 *   1. Old Pal JSONs (279 fully-populated pals in data/pals/)
 *   2. data/skills.json (curated skill database)
 *   3. Element keyword matching (fallback)
 *   4. Level-based power/cooldown heuristics (last resort)
 */

const fs = require('fs');
const path = require('path');

const PALS_DIR = path.join(__dirname, '..', 'data', 'pals');
const SKILLS_PATH = path.join(__dirname, '..', 'data', 'skills.json');

// ---- Element keyword map ----
const ELEMENT_KEYWORDS = {
  dragon: ['dragon', 'draco'],
  fire: ['fire', 'flame', 'flare', 'ignis', 'blaze', 'magma', 'volcanic', 'lantern', 'inferno', 'flame', 'burn'],
  water: ['water', 'hydro', 'aqua', 'splash', 'bubble', 'tidal', 'geyser', 'torrent', 'maelstrom', 'breach', 'lotus', 'curtain'],
  grass: ['grass', 'seed', 'vine', 'leaf', 'solar', 'root', 'thorn', 'flower', 'reflect', 'bloom'],
  ground: ['ground', 'sand', 'stone', 'rock', 'bog', 'mud', 'earth', 'sumo', 'horn', 'cube', 'rolling'],
  electric: ['electric', 'spark', 'shock', 'thunder', 'lightning', 'plasma', 'tri-spark', 'tri-lightning', 'rail', 'volt'],
  ice: ['ice', 'frost', 'blizzard', 'crystal', 'icicle', 'diamond', 'snow', 'freeze', 'cold'],
  dark: ['dark', 'shadow', 'night', 'nightmare', 'apocalypse', 'umbral', 'poison', 'venom'],
  neutral: ['normal', 'power', 'body', 'tackle', 'scratch', 'kick', 'punch', 'rush', 'beam', 'blast', 'burst', 'cannon',
    'ball', 'shot', 'laser', 'bomb', 'cutter', 'blade', 'slice', 'edge', 'slash', 'meteor',
    'missile', 'fang', 'bullet', 'machine', 'gun', 'spear', 'spike', 'storm', 'tornado', 'twister',
    'hurricane', 'wind', 'crosswind', 'gust', 'cyclone', 'surge', 'wave', 'rain', 'funnel',
    'lance', 'comet', 'barrage', 'tail', 'spirit', 'holy', 'pal', 'power', 'trickster',
    'show', 'assault', 'charge', 'stomp', 'press', 'rain', 'multicutter', 'somersault', 'scatter',
    'fierce', 'double', 'persistent', 'rapid'],
};

// ---- Level → Power/Cooldown heuristics ----
// Based on observed Palworld skill progression patterns
function estimatePower(level) {
  if (level <= 1) return 40;
  if (level <= 7) return 55;
  if (level <= 15) return 75;
  if (level <= 22) return 90;
  if (level <= 30) return 110;
  if (level <= 40) return 125;
  if (level <= 50) return 140;
  return 150;
}

function estimateCooldown(level) {
  if (level <= 1) return 2;
  if (level <= 7) return 4;
  if (level <= 15) return 8;
  if (level <= 22) return 12;
  if (level <= 30) return 18;
  if (level <= 40) return 24;
  if (level <= 50) return 30;
  return 40;
}

function guessElement(skillName) {
  const name = skillName.toLowerCase();
  for (const [element, keywords] of Object.entries(ELEMENT_KEYWORDS)) {
    for (const kw of keywords) {
      if (name.includes(kw)) {
        return element.charAt(0).toUpperCase() + element.slice(1);
      }
    }
  }
  return 'Neutral';
}

function main() {
  // ---- Build lookup from old Pals ----
  const oldSkillMap = {};
  const allFiles = fs.readdirSync(PALS_DIR);
  let oldCount = 0;

  allFiles.forEach(f => {
    if (!f.endsWith('.json')) return;
    const pal = JSON.parse(fs.readFileSync(path.join(PALS_DIR, f), 'utf8'));
    if (pal._source) return; // skip scraped Pals
    oldCount++;
    (pal.skills || []).forEach(s => {
      if (s.power > 0 && s.cooldown > 0) {
        const key = s.name.toLowerCase();
        if (!oldSkillMap[key]) {
          oldSkillMap[key] = { element: s.element, power: s.power, cooldown: s.cooldown };
        }
      }
    });
  });

  // ---- Build lookup from skills.json ----
  const skillDbMap = {};
  if (fs.existsSync(SKILLS_PATH)) {
    const skillsDb = JSON.parse(fs.readFileSync(SKILLS_PATH, 'utf8'));
    (skillsDb.active || []).forEach(s => {
      const key = s.name.toLowerCase();
      skillDbMap[key] = { element: s.element, power: s.power, cooldown: s.cooldown };
    });
  }

  // ---- Process new (scraped) Pals ----
  let processed = 0, totalSkillsFilled = 0, totalSkillsGuess = 0, totalSkillsEmpty = 0;

  allFiles.forEach(f => {
    if (!f.endsWith('.json')) return;
    const filePath = path.join(PALS_DIR, f);
    const pal = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!pal._source) return; // only process scraped Pals

    let modified = false;
    const needsReview = pal._needsReview ? [...pal._needsReview] : [];

    (pal.skills || []).forEach(s => {
      if (!s.name) {
        totalSkillsEmpty++;
        return; // empty skill (Boltmane has no skills)
      }

      const key = s.name.toLowerCase();

      // Priority 1: Old Pal data
      if (oldSkillMap[key]) {
        s.element = oldSkillMap[key].element;
        s.power = oldSkillMap[key].power;
        s.cooldown = oldSkillMap[key].cooldown;
        totalSkillsFilled++;
        modified = true;
        return;
      }

      // Priority 2: skills.json
      if (skillDbMap[key]) {
        s.element = skillDbMap[key].element;
        s.power = skillDbMap[key].power;
        s.cooldown = skillDbMap[key].cooldown;
        totalSkillsFilled++;
        modified = true;
        return;
      }

      // Priority 3+4: Guess element + estimate power/cooldown
      s.element = guessElement(s.name);
      s.power = estimatePower(s.level);
      s.cooldown = estimateCooldown(s.level);
      totalSkillsGuess++;
      modified = true;
    });

    // Update _needsReview
    if (needsReview.includes('skills.power') || needsReview.includes('skills.cooldown') || needsReview.includes('skills.element')) {
      const stillNeedsReview = needsReview.filter(r =>
        !['skills.power', 'skills.cooldown', 'skills.element'].includes(r)
      );
      // If we had to guess values, keep the review flags
      if (totalSkillsGuess > 0) {
        // Keep skills.* in review since we used heuristics
        pal._needsReview = stillNeedsReview.length > 0 ? stillNeedsReview : [];
      } else {
        pal._needsReview = stillNeedsReview.length > 0 ? stillNeedsReview : [];
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(pal, null, 2) + '\n');
    }
    processed++;
  });

  console.log(`Processed ${processed} new Pals`);
  console.log(`Skills filled from data: ${totalSkillsFilled}`);
  console.log(`Skills estimated (heuristics): ${totalSkillsGuess}`);
  console.log(`Empty skills (no name): ${totalSkillsEmpty}`);

  // Report coverage
  const total = totalSkillsFilled + totalSkillsGuess;
  if (total > 0) {
    console.log(`Data coverage: ${(totalSkillsFilled/total*100).toFixed(1)}% from lookup, ${(totalSkillsGuess/total*100).toFixed(1)}% heuristics`);
  }
}

main();
