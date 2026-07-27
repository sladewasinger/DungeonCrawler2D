// Samples named palette tones from the frozen 0x72 sheet so every generated sprite stays
// strictly in-pack. Each region below is a real sprite on the sheet; colors are picked by
// rank-by-frequency within that region (not hardcoded hex) so the values trace to real pixels.

function countPixel({ counts, sheet, x, y }) {
  const [r, g, b, a] = sheet.getPixel(x, y);
  if (a === 0) return;
  const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  counts.set(hex, (counts.get(hex) || 0) + 1);
}

function dominantColors(sheet, { x, y, w, h }) {
  const counts = new Map();
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) countPixel({ counts, sheet, x: xx, y: yy });
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
}

function sampleRegions(sheet) {
  const sample = (region) => dominantColors(sheet, region);
  return {
    crate: sample({ x: 288, y: 408, w: 16, h: 24 }),
    banner: sample({ x: 16, y: 32, w: 16, h: 16 }),
    skull: sample({ x: 288, y: 432, w: 16, h: 16 }),
    chest: sample({ x: 304, y: 416, w: 16, h: 16 }),
    goblin: sample({ x: 368, y: 40, w: 16, h: 16 }),
    wallGoo: sample({ x: 64, y: 96, w: 16, h: 16 }),
    swampy: sample({ x: 432, y: 112, w: 16, h: 16 }),
    floor: sample({ x: 16, y: 64, w: 16, h: 16 }),
    heart: sample({ x: 289, y: 370, w: 13, h: 12 }),
  };
}

export function buildPalette(sheet) {
  const { crate, banner, skull, chest, goblin, wallGoo, swampy, floor, heart } = sampleRegions(sheet);

  return {
    OUTLINE: crate[1], // #222222 — shared outline ink across the whole pack
    WOOD_MID: crate[0], // #8f4029 — crate/door plank
    WOOD_DARK: crate[2], // #62232f — crate/door plank shadow
    WOOD_HILITE: crate[3], // #ee8e2e — lit wood/metal edge
    CLOTH_DARK: banner[1], // #483b3a — banner/stone backing cloth
    CLOTH_MID: banner[2], // #775c55 — banner/stone backing cloth mid
    BERRY_RED: banner[4], // #9f294e — banner red accent, reused for creeper berries
    BONE_LIGHT: skull[0], // #d3bfa9 — skull bone
    BONE_SHADOW: skull[2], // #aa8d7a — skull bone shadow
    WHITE_HILITE: goblin[3], // #fdf7ed — pack's shared eye/specular white
    MEAT_RED: heart[0], // #da4e38 — ui_heart red
    LEAF_SHADOW: goblin[1], // #3d734f — goblin's base green, reused as deep leaf/poison shadow
    LEAF_MID: wallGoo[3], // #4ba747 — wall_goo leafy green
    LEAF_BRIGHT: swampy[1], // #97da3f — swampy's lime highlight, already poison-green
    TORCH_FLAME_MID: chest[2], // #c56025 — chest ember orange
    TORCH_FLAME_BRIGHT: chest[5], // #facb3e — chest gold highlight
    FLOOR_BASE: floor[0], // #483b3a — floor_1 base stone
    FLOOR_MID: floor[1], // #775c55 — floor_1 crack/edge highlight
    // The two accents below are the doc's own named exceptions ("accents only for glows"):
    // fire/torch and sanctuary/portal teal. Everything else here is sampled, not invented.
    TORCH_FLAME_OUTER: '#ff9e3d',
    SANCTUARY_TEAL: '#3dd6c3',
  };
}
