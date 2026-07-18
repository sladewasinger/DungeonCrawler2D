// Fills INVENTORY.md GAPS#7: plant_creeper (recolor of goblin) and slime (recolor of
// swampy/muddy). Source hex values below are the sampled, verified-consistent palette of
// those specific sheet frames (goblin: outline/skin/clothing/eye; swampy & muddy: outline/
// mid/dark/dark2) — replaced 1:1 with tones from `palette` so results stay in-pack.
import { recolorSeries } from './recolor.mjs';
import { opaque, scaleColor } from '../color.mjs';

const GOBLIN_IDLE = ['goblin_idle_anim_f0', 'goblin_idle_anim_f1', 'goblin_idle_anim_f2', 'goblin_idle_anim_f3'];
const GOBLIN_RUN = ['goblin_run_anim_f0', 'goblin_run_anim_f1', 'goblin_run_anim_f2', 'goblin_run_anim_f3'];
const SWAMPY = ['swampy_anim_f0', 'swampy_anim_f1', 'swampy_anim_f2', 'swampy_anim_f3'];
const MUDDY = ['muddy_anim_f0', 'muddy_anim_f1', 'muddy_anim_f2', 'muddy_anim_f3'];

function creeperMapping(p) {
  return new Map([
    ['#3d734f', opaque(p.LEAF_MID)], // goblin base-green skin -> leafy green
    ['#314152', opaque(p.BERRY_RED)], // goblin dark clothing/belt -> red berry accent
  ]);
}

function slimeIdleMapping(p) {
  return new Map([
    ['#49a790', opaque(p.LEAF_MID)], // swampy teal-mid -> poison-green mid
    ['#417089', opaque(p.LEAF_SHADOW)], // swampy blue-teal shadow -> poison-green shadow
  ]);
}

function slimeRunMapping(p) {
  const darkest = scaleColor(p.LEAF_SHADOW, 0.6);
  return new Map([
    ['#775c55', opaque(p.LEAF_MID)], // muddy mid brown -> poison-green mid
    ['#483b3a', opaque(p.LEAF_SHADOW)], // muddy dark brown -> poison-green shadow
    ['#5f2d56', opaque(darkest)], // muddy purple shadow detail -> deepest poison-green
  ]);
}

export function generateMonsterRecolors(sheet, palette, frameByName) {
  return [
    ...recolorSeries(sheet, frameByName, GOBLIN_IDLE, 'plant_creeper_idle', creeperMapping(palette)),
    ...recolorSeries(sheet, frameByName, GOBLIN_RUN, 'plant_creeper_run', creeperMapping(palette)),
    ...recolorSeries(sheet, frameByName, SWAMPY, 'slime_idle', slimeIdleMapping(palette)),
    ...recolorSeries(sheet, frameByName, MUDDY, 'slime_run', slimeRunMapping(palette)),
  ];
}
