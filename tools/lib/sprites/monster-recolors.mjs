// Fills INVENTORY.md GAPS#7's slime with recolored swampy/muddy frames. Plant creatures
// use their restored authored silhouettes in plant-creatures.mjs.
import { recolorSeries } from './recolor.mjs';
import { opaque, scaleColor } from '../color.mjs';

const SWAMPY = ['swampy_anim_f0', 'swampy_anim_f1', 'swampy_anim_f2', 'swampy_anim_f3'];
const MUDDY = ['muddy_anim_f0', 'muddy_anim_f1', 'muddy_anim_f2', 'muddy_anim_f3'];

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
    ...recolorSeries({ sheet, frameByName, sourceNames: SWAMPY, outPrefix: 'slime_idle', mapping: slimeIdleMapping(palette) }),
    ...recolorSeries({ sheet, frameByName, sourceNames: MUDDY, outPrefix: 'slime_run', mapping: slimeRunMapping(palette) }),
  ];
}
