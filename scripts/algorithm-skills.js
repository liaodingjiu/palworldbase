/**
 * algorithm-skills.js — Skill build calculations (§8.3)
 *
 * Three builds per Pal:
 *   Burst   — Top 3 skills by raw power, rotation = max(cooldown)
 *   Sustain — Top 3 skills by power/cooldown ratio, rotation = avg(cooldown)
 *   STAB    — Top 3 same-element skills (power × 1.2), rotation = max(cooldown)
 *
 * Usage: const skills = require('./algorithm-skills');
 */

/**
 * Compute Burst build: highest raw damage in one rotation.
 * Strategy: pick top 3 skills by power, rotation time = longest cooldown.
 */
function computeBurstBuild(skills) {
  if (!skills || skills.length === 0) return null;

  const valid = skills.filter(s => s.power > 0 && s.cooldown > 0);
  if (valid.length === 0) return null;

  // Sort by power descending
  const sorted = [...valid].sort((a, b) => b.power - a.power);
  const top3 = sorted.slice(0, 3);

  const totalPower = top3.reduce((sum, s) => sum + s.power, 0);
  const rotation = Math.max(...top3.map(s => s.cooldown));
  const dps = rotation > 0 ? (totalPower / rotation).toFixed(1) : 0;

  return {
    name: 'Burst',
    description: 'Max damage in one rotation',
    skills: top3.map(s => ({
      name: s.name,
      element: s.element,
      power: s.power,
      cooldown: s.cooldown,
      level: s.level,
    })),
    totalPower,
    rotationCooldown: rotation,
    dps: parseFloat(dps),
    strategy: 'Open with strongest skill, chain remaining two, wait for cooldowns.',
  };
}

/**
 * Compute Sustain build: best damage over time.
 * Strategy: pick top 3 skills by power/cooldown ratio, rotation = avg(cooldown).
 */
function computeSustainBuild(skills) {
  if (!skills || skills.length === 0) return null;

  const valid = skills.filter(s => s.power > 0 && s.cooldown > 0);
  if (valid.length === 0) return null;

  // Sort by power/cooldown ratio descending
  const sorted = [...valid].sort((a, b) => {
    const ratioA = a.power / a.cooldown;
    const ratioB = b.power / b.cooldown;
    return ratioB - ratioA;
  });
  const top3 = sorted.slice(0, 3);

  const totalPower = top3.reduce((sum, s) => sum + s.power, 0);
  const avgCooldown = top3.reduce((sum, s) => sum + s.cooldown, 0) / top3.length;
  const dps = avgCooldown > 0 ? (totalPower / avgCooldown).toFixed(1) : 0;

  return {
    name: 'Sustain',
    description: 'Best damage over time',
    skills: top3.map(s => ({
      name: s.name,
      element: s.element,
      power: s.power,
      cooldown: s.cooldown,
      level: s.level,
    })),
    totalPower,
    rotationCooldown: parseFloat(avgCooldown.toFixed(1)),
    dps: parseFloat(dps),
    strategy: 'Rotate through skills as they come off cooldown for consistent DPS.',
  };
}

/**
 * Compute STAB build: Same-Type Attack Bonus (+20% power for matching element).
 * Strategy: pick top 3 skills matching Pal's primary element, apply 1.2x multiplier.
 */
function computeSTABBuild(skills, palElement) {
  if (!skills || skills.length === 0 || !palElement) return null;

  const stab = skills.filter(s =>
    s.power > 0 &&
    s.cooldown > 0 &&
    s.element &&
    s.element.toLowerCase() === palElement.toLowerCase()
  );

  if (stab.length === 0) return null; // No matching element skills

  // Sort by adjusted power (×1.2) descending
  const sorted = [...stab].sort((a, b) => (b.power * 1.2) - (a.power * 1.2));
  const top3 = sorted.slice(0, 3);

  const totalPower = top3.reduce((sum, s) => sum + Math.round(s.power * 1.2), 0);
  const rotation = Math.max(...top3.map(s => s.cooldown));
  const dps = rotation > 0 ? (totalPower / rotation).toFixed(1) : 0;

  return {
    name: `STAB (${palElement})`,
    description: `Same-type ${palElement} skills with +20% bonus`,
    skills: top3.map(s => ({
      name: s.name,
      element: s.element,
      power: s.power,
      adjustedPower: Math.round(s.power * 1.2),
      cooldown: s.cooldown,
      level: s.level,
    })),
    totalPower,
    rotationCooldown: rotation,
    dps: parseFloat(dps),
    strategy: `Use only ${palElement}-element skills for the 20% STAB bonus.`,
  };
}

/**
 * Compute all three builds for a Pal.
 * Returns an array of non-null builds (may be fewer than 3 if conditions aren't met).
 */
function computeAllBuilds(skills, palElement) {
  const builds = [];

  const burst = computeBurstBuild(skills);
  if (burst) builds.push(burst);

  const sustain = computeSustainBuild(skills);
  // Only add sustain if different from burst
  if (sustain && !buildsEqual(burst, sustain)) {
    builds.push(sustain);
  }

  if (palElement) {
    const stab = computeSTABBuild(skills, palElement);
    if (stab) builds.push(stab);
  }

  return builds;
}

/**
 * Check if two builds are effectively identical (same skills, same order).
 */
function buildsEqual(a, b) {
  if (!a || !b) return false;
  if (a.skills.length !== b.skills.length) return false;
  return a.skills.every((s, i) =>
    s.name === b.skills[i].name && s.power === b.skills[i].power
  );
}

module.exports = {
  computeBurstBuild,
  computeSustainBuild,
  computeSTABBuild,
  computeAllBuilds,
};
