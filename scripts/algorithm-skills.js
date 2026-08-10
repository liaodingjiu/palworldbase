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
 * @param {number} variant - rotation seed for description/strategy diversity
 */
function computeBurstBuild(skills, variant = 0) {
  if (!skills || skills.length === 0) return null;

  const valid = skills.filter(s => s.power > 0 && s.cooldown > 0);
  if (valid.length === 0) return null;

  // Sort by power descending
  const sorted = [...valid].sort((a, b) => b.power - a.power);
  const top3 = sorted.slice(0, 3);

  const totalPower = top3.reduce((sum, s) => sum + s.power, 0);
  const rotation = Math.max(...top3.map(s => s.cooldown));
  const dps = rotation > 0 ? (totalPower / rotation).toFixed(1) : 0;

  // Variant descriptions (rotated per Pal)
  const descriptions = [
    'Max damage in one rotation',
    'Highest burst damage output',
    'One-rotation power spike',
    'Frontloaded damage combo',
  ];

  // Dynamic strategy — skill names make each Pal's text unique
  // Handle Pals with fewer than 3 valid skills
  const s1 = top3[0].name;
  const s2 = top3.length >= 2 ? top3[1].name : '';
  const s3 = top3.length >= 3 ? top3[2].name : '';
  const chain = s3 ? `${s1}, chain ${s2} then ${s3}` : s2 ? `${s1} then ${s2}` : s1;

  const strategies = [
    `Open with ${chain}, wait for cooldowns.`,
    s2 ? `Lead with ${s1} (⚡${top3[0].power}), follow with ${s2}${s3 ? ' → ' + s3 : ''}.`
       : `Lead with ${s1} (⚡${top3[0].power}) — your strongest skill.`,
    s3 ? `Cast ${s1}, then ${s2}, then ${s3} — repeat on cooldown.`
       : s2 ? `Cast ${s1}, then ${s2} — repeat on cooldown.`
       : `Cast ${s1} at Lv${top3[0].level} — cycle it efficiently.`,
    `Frontload ${s1} at Lv${top3[0].level}${s2 ? ', then chain ' + s2 + (s3 ? ' + ' + s3 : '') : ' — your hardest hit.'}.`,
  ];

  return {
    name: 'Burst',
    description: descriptions[variant % descriptions.length],
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
    strategy: strategies[variant % strategies.length],
  };
}

/**
 * Compute Sustain build: best damage over time.
 * Strategy: pick top 3 skills by power/cooldown ratio, rotation = avg(cooldown).
 * @param {number} variant - rotation seed for description/strategy diversity
 */
function computeSustainBuild(skills, variant = 0) {
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

  // Variant descriptions
  const descriptions = [
    'Best damage over time',
    'Consistent DPS rotation',
    'Highest sustained damage output',
    'Cooldown-optimized DPS',
  ];

  // Dynamic strategy — actual skill names (handle <3 skills)
  const ss1 = top3[0].name;
  const ss2 = top3.length >= 2 ? top3[1].name : '';
  const ss3 = top3.length >= 3 ? top3[2].name : '';

  const strategies = [
    ss3 ? `Rotate ${ss1}, ${ss2}, ${ss3} as they come off cooldown for consistent DPS.`
        : ss2 ? `Rotate ${ss1} and ${ss2} as they come off cooldown for consistent DPS.`
        : `Spam ${ss1} on cooldown for consistent DPS.`,
    ss2 ? `Spam ${ss1} (⚡${top3[0].power}, ⏱${top3[0].cooldown}s), weave in ${ss2}${ss3 ? ' and ' + ss3 : ''}.`
        : `Spam ${ss1} (⚡${top3[0].power}, ⏱${top3[0].cooldown}s) on every available cooldown window.`,
    ss3 ? `Keep cycling ${ss1} → ${ss2} → ${ss3} — use whichever is off cooldown.`
        : ss2 ? `Keep cycling ${ss1} → ${ss2} — use whichever is off cooldown.`
        : `Cast ${ss1} whenever it's off cooldown for sustained DPS.`,
    ss2 ? `Prioritize ${ss1} for DPS, fill gaps with ${ss2}${ss3 ? ' and ' + ss3 : ''}.`
        : `Prioritize ${ss1} for sustained damage output.`,
  ];

  return {
    name: 'Sustain',
    description: descriptions[variant % descriptions.length],
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
    strategy: strategies[variant % strategies.length],
  };
}

/**
 * Compute STAB build: Same-Type Attack Bonus (+20% power for matching element).
 * Strategy: pick top 3 skills matching Pal's primary element, apply 1.2x multiplier.
 * @param {number} variant - rotation seed for description/strategy diversity
 */
function computeSTABBuild(skills, palElement, variant = 0) {
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

  // Variant descriptions
  const descriptions = [
    `Same-type ${palElement} skills with +20% bonus`,
    `STAB-boosted ${palElement} build`,
    `${palElement}-element focused loadout`,
    `Type-matched ${palElement} skills`,
  ];

  // Variant strategies
  const strategies = [
    `Use only ${palElement}-element skills for the 20% STAB bonus.`,
    `All ${palElement} skills get +20% same-type attack bonus (STAB).`,
    `Stick to ${palElement} skills — each gets a 1.2× multiplier via STAB.`,
    `Maximize STAB: every ${palElement} skill deals 20% more damage than listed.`,
  ];

  return {
    name: `STAB (${palElement})`,
    description: descriptions[variant % descriptions.length],
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
    strategy: strategies[variant % strategies.length],
  };
}

/**
 * Compute all three builds for a Pal.
 * Returns an array of non-null builds (may be fewer than 3 if conditions aren't met).
 * @param {object} pal - Full Pal JSON object (needed for data-driven insight generation)
 * @param {number} variant - rotation seed passed to each build for text diversity
 */
function computeAllBuilds(pal, variant = 0) {
  const skills = pal.skills || [];
  const palElement = (pal.classification && pal.classification.elements) ? pal.classification.elements[0] : null;
  const builds = [];

  const burst = computeBurstBuild(skills, variant);
  if (burst) {
    burst.insight = generateInsight(pal, 'burst', burst, variant);
    builds.push(burst);
  }

  const sustain = computeSustainBuild(skills, variant + 1);
  // Only add sustain if different from burst
  if (sustain && !buildsEqual(burst, sustain)) {
    sustain.insight = generateInsight(pal, 'sustain', sustain, variant + 1);
    builds.push(sustain);
  }

  if (palElement) {
    const stab = computeSTABBuild(skills, palElement, variant + 2);
    if (stab) {
      stab.insight = generateInsight(pal, 'stab', stab, variant + 2);
      builds.push(stab);
    }
  }

  return builds;
}

/**
 * Generate a data-driven Pal-specific insight for a skill build.
 * Every sentence is deterministically derived from actual Pal JSON fields —
 * no AI-generated text, no assumptions.
 *
 * @param {object} pal - Full Pal JSON
 * @param {string} buildType - 'burst' | 'sustain' | 'stab'
 * @param {object} build - The computed build object
 * @returns {string} 1-2 sentence insight unique to this Pal
 */
function generateInsight(pal, buildType, build, variant = 0) {
  const name = pal.name ? pal.name.en : 'This Pal';
  const atk = (pal.stats && pal.stats.attack) ? pal.stats.attack : 0;
  const spd = (pal.stats && pal.stats.speed) ? pal.stats.speed : 0;
  const sta = (pal.stats && pal.stats.stamina) ? pal.stats.stamina : 0;
  const elements = (pal.classification && pal.classification.elements) ? pal.classification.elements : [];
  const primaryEl = elements[0] || '';
  const skills = pal.skills || [];

  // ---- 1. ATK tier (percentile-based thresholds from actual Pal data) ----
  let atkNote = '';
  if (atk >= 115) {
    atkNote = `High base ATK (${atk}) amplifies every skill — ${name} hits harder than 75% of Pals.`;
  } else if (atk >= 95) {
    atkNote = `Above-average ATK (${atk}) — skill power and stat scaling work together.`;
  } else if (atk >= 80) {
    atkNote = `Moderate ATK (${atk}) — balanced damage, not exceptional but reliable.`;
  } else if (atk > 0) {
    atkNote = `Low base ATK (${atk}) — skill power carries the load, not stat scaling.`;
  } else {
    atkNote = `${name} has minimal ATK — this build is for self-defense only.`;
  }

  // ---- 2. Speed tier ----
  let spdNote = '';
  if (spd >= 200) {
    spdNote = `Speed ${spd} is elite — rotations cycle much faster than average (median ${80}).`;
  } else if (spd >= 120) {
    spdNote = `Speed ${spd} is fast — cooldowns feel shorter in practice.`;
  } else if (spd >= 70) {
    spdNote = `Speed ${spd} is average — standard skill pacing.`;
  } else if (spd > 0) {
    spdNote = `Speed ${spd} is slow — rotations take longer, so make each cast count.`;
  }

  // ---- 3. Element-skill matching ----
  const nativeSkills = skills.filter(s => s.element === primaryEl);
  let elemNote = '';
  if (!primaryEl) {
    elemNote = '';
  } else if (skills.length === 0) {
    elemNote = `${name} has no learnable skills — use skill fruits to teach it moves.`;
  } else if (nativeSkills.length === 0) {
    elemNote = `${name} is ${primaryEl}-element but has ZERO native ${primaryEl} skills. Use a ${primaryEl} skill fruit to enable STAB.`;
  } else if (nativeSkills.length === skills.length) {
    elemNote = `All ${skills.length} skills are ${primaryEl}-element — STAB (+20%) applies automatically.`;
  } else {
    elemNote = `${nativeSkills.length}/${skills.length} skills match its ${primaryEl} element — partial STAB coverage.`;
  }

  // ---- 4. Role context ----
  const bestFor = (pal.decision && pal.decision.bestFor) || [];
  const isCombat = bestFor.includes('combat');
  const isMount = bestFor.some(r => r === 'mount-flying' || r === 'mount-ground');
  let roleNote = '';
  if (isCombat) {
    roleNote = `${name} is built for combat — this skill loadout complements its fighting role.`;
  } else if (isMount) {
    roleNote = `${name} is a mount — skills fire while riding, so this build stays relevant in traversal.`;
  } else if (bestFor.length > 0) {
    const workRoles = bestFor.filter(r => !['combat', 'mount-flying', 'mount-ground'].includes(r));
    if (workRoles.length > 0) {
      roleNote = `${name} is a base worker (${workRoles[0]}) — this build is for self-defense while assigned to base tasks.`;
    }
  }

  // ---- 5. Game stage ----
  const stage = (pal.decision && pal.decision.gameStage) ? pal.decision.gameStage : null;
  let stageNote = '';
  if (stage) {
    if (stage.early && !stage.mid && !stage.late) {
      stageNote = `Early-game Pal — outclassed by mid-game options, but solid for starting zones.`;
    } else if (stage.late) {
      stageNote = `Late-game Pal — worth investing resources to optimize this build.`;
    }
  }

  // ---- 6. Build-type specific note (variant rotation for diversity) ----
  let buildNote = '';
  if (buildType === 'burst') {
    const longest = build.skills.reduce((a, b) => a.cooldown > b.cooldown ? a : b);
    const burstMechanics = [
      `Burst rotation waits on ${longest.name} (⏱${longest.cooldown}s) — the longest cooldown sets the pace.`,
      `Total burst: ${build.totalPower} power in one cycle. ${longest.name}'s ${longest.cooldown}s cooldown is the bottleneck.`,
      `Frontloaded damage — cast all skills, then wait ${longest.cooldown}s for ${longest.name} to refresh.`,
      `One-cycle spike: ${build.totalPower} power at ${build.dps} DPS. Gated by ${longest.name} (⏱${longest.cooldown}s).`,
    ];
    buildNote = burstMechanics[variant % burstMechanics.length];
  } else if (buildType === 'sustain') {
    const fastest = build.skills.reduce((a, b) => a.cooldown < b.cooldown ? a : b);
    const slowest = build.skills.reduce((a, b) => a.cooldown > b.cooldown ? a : b);
    const sustainMechanics = [
      `Sustain DPS: spam ${fastest.name} (⏱${fastest.cooldown}s) between ${slowest.name} casts for max uptime.`,
      `Consistent ${build.dps} DPS by cycling ${fastest.name} as often as possible — ${fastest.cooldown}s is your shortest window.`,
      `Weave ${fastest.name} (⏱${fastest.cooldown}s) between longer cooldowns — ${build.dps} sustained DPS.`,
      `Prioritize ${fastest.name} on cooldown for ${build.dps} DPS — ${slowest.name} fills the gaps.`,
    ];
    buildNote = sustainMechanics[variant % sustainMechanics.length];
  } else if (buildType === 'stab') {
    if (nativeSkills.length === 0) {
      const stabNoNative = [
        `No native ${primaryEl} skills means zero STAB from this build — add a ${primaryEl} fruit first.`,
        `Without ${primaryEl} skills, STAB is impossible. Teach ${name} a ${primaryEl} move via skill fruit.`,
      ];
      buildNote = stabNoNative[variant % stabNoNative.length];
    } else if (nativeSkills.length >= 3) {
      const stabFull = [
        `Full ${primaryEl} STAB — every skill in this rotation gets the +20% same-type bonus.`,
        `${primaryEl} STAB on all skills: +20% power across the board. Total: ${build.totalPower} (up from ${Math.round(build.totalPower / 1.2)}).`,
      ];
      buildNote = stabFull[variant % stabFull.length];
    } else {
      buildNote = `Partial STAB: only ${nativeSkills.length}/${build.skills.length} skill${nativeSkills.length > 1 ? 's' : ''} get the +20% bonus.`;
    }
  }

  // ---- Compose: prioritize MOST differentiating dimensions ----
  // Strategy: pick 2 parts. One is always the build mechanic.
  // The second is the most Pal-unique dimension: element > role > stage > stat.
  const parts = [];

  // Always include the build-specific mechanic
  if (buildNote) parts.push(buildNote);

  // Pick the MOST differentiating second part for this Pal
  // Priority: element mismatch > role > game stage > speed extreme > ATK
  const isSTABBuild = buildType === 'stab';
  const hasElemMismatch = elemNote && nativeSkills.length === 0;  // 48% of Pals — highly differentiating
  const hasRole = roleNote && roleNote.length > 0;
  const hasStage = stageNote && stageNote.length > 0;
  const hasExtremeSpeed = spdNote && (spd >= 200 || spd < 60);

  if (isSTABBuild && elemNote) {
    // STAB: element note is the primary differentiating factor
    parts.push(elemNote);
  } else if (hasElemMismatch) {
    // Pal has ZERO matching-element skills — this is the most unique thing about it
    parts.push(elemNote);
  } else if (hasRole) {
    parts.push(roleNote);
  } else if (hasStage) {
    parts.push(stageNote);
  } else if (hasExtremeSpeed) {
    parts.push(spdNote);
  } else if (elemNote && nativeSkills.length === skills.length && skills.length > 0) {
    // All skills match — still worth noting for context
    parts.push(elemNote);
  } else if (atkNote) {
    parts.push(atkNote);
  }

  // If still only 1 part, add whatever context is available
  if (parts.length < 2 && spdNote && !parts.includes(spdNote)) parts.push(spdNote);
  if (parts.length < 2 && stageNote && !parts.includes(stageNote)) parts.push(stageNote);
  if (parts.length < 2 && roleNote && !parts.includes(roleNote)) parts.push(roleNote);
  if (parts.length < 2 && atkNote && !parts.includes(atkNote)) parts.push(atkNote);
  if (parts.length < 2 && elemNote && !parts.includes(elemNote)) parts.push(elemNote);
  // Absolute fallback
  if (parts.length === 0) {
    parts.push(`${name}'s stats shape this build — see the comparison table for context.`);
  }

  return parts.slice(0, 2).join(' ');
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
