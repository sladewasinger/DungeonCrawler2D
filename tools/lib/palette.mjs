// Samples named palette tones from the frozen 0x72 sheet so every generated sprite stays
// strictly in-pack. Each region below is a real sprite on the sheet; colors are picked by
// rank-by-frequency within that region (not hardcoded hex) so the values trace to real pixels.

function dominantColors(sheet, x, y, w, h) {
  const counts = new Map();
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const [r, g, b, a] = sheet.getPixel(xx, yy);
      if (a === 0) continue;
      const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
      counts.set(hex, (counts.get(hex) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
}

export function buildPalette(sheet) {
  const crate = dominantColors(sheet, 288, 408, 16, 24); // crate: wood browns
  const banner = dominantColors(sheet, 16, 32, 16, 16); // wall_banner_red: cloth + red accent
  const skull = dominantColors(sheet, 288, 432, 16, 16); // skull: bone tones
  const chest = dominantColors(sheet, 304, 416, 16, 16); // chest_full_open_f0: ember/gold tones
  const goblin = dominantColors(sheet, 368, 40, 16, 16); // goblin_idle_f0: base green + white eye
  const wallGoo = dominantColors(sheet, 64, 96, 16, 16); // wall_goo_base: leafy green family
  const swampy = dominantColors(sheet, 432, 112, 16, 16); // swampy_anim_f0: poison-green highlight
  const floor = dominantColors(sheet, 16, 64, 16, 16); // floor_1: stone tones to retint teal
  const heart = dominantColors(sheet, 289, 370, 13, 12); // ui_heart_full: pack red + white

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
