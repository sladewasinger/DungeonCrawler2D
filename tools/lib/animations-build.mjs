// Builds animations.json: {animKey: {frames, frameRate, repeat}} for every multi-frame group
// (heroes idle/run, monsters, chests, fountains, spikes, coin, and the generated recolors —
// hero *_hit groups are single-frame in the source pack and are correctly excluded).
const RULES = [
  { test: (k) => k.includes('chest') && k.includes('open'), frameRate: 8, repeat: 0 },
  { test: (k) => k.includes('bomb'), frameRate: 8, repeat: 0 },
  { test: (k) => k.includes('fountain'), frameRate: 4, repeat: -1 },
  { test: (k) => k.includes('spikes'), frameRate: 6, repeat: -1 },
  { test: (k) => k.includes('coin'), frameRate: 8, repeat: -1 },
  { test: (k) => k.endsWith('_run'), frameRate: 10, repeat: -1 },
  { test: (k) => k.endsWith('_idle'), frameRate: 5, repeat: -1 },
];
const DEFAULT_TIMING = { frameRate: 6, repeat: -1 };

function timingFor(groupKey) {
  const rule = RULES.find((r) => r.test(groupKey));
  return rule ? { frameRate: rule.frameRate, repeat: rule.repeat } : DEFAULT_TIMING;
}

export function buildAnimations(groups) {
  const animations = {};
  for (const [groupKey, frameNames] of groups) {
    if (frameNames.length <= 1) continue;
    animations[groupKey] = { frames: frameNames, ...timingFor(groupKey) };
  }
  return animations;
}
