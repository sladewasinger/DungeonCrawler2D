/** Elite mini-boss lair layouts and Torch-Brazier puzzle vault layouts. */
import { PropKind } from "../types.js";
import type { FrontierPoiLayoutSpec } from "./shrineLayouts.js";

export const LAIR_AND_PUZZLE_LAYOUTS: Readonly<Record<string, FrontierPoiLayoutSpec>> = {
  "broodmother-hollow": {
    kind: "broodmother-hollow", radiusX: 4, radiusY: 3, floor: "moss", chestOffset: [0, -1.7], guards: ["spider", "spider"],
    props: [
      { kind: PropKind.Boulder, dx: -2.6, dy: -1.8, radius: 0.42, blocks: true },
      { kind: PropKind.Boulder, dx: 2.6, dy: -1.8, radius: 0.42, blocks: true },
      { kind: PropKind.GiantMushroom, dx: -2.4, dy: 1.5, radius: 0.34, blocks: true },
      { kind: PropKind.Torch, dx: -1.4, dy: 0.8, radius: 0.2, blocks: false, light: { kind: "torch", color: 0x2dd4bf, radiusPx: 145, intensity: 0.9 } },
    ],
  },
  "orc-totem-ring": {
    kind: "orc-totem-ring", radiusX: 4, radiusY: 3, floor: "dirt", chestOffset: [0, -1.8], guards: ["goblin", "goblin"],
    props: [
      { kind: PropKind.BoneTotem, dx: -2.5, dy: -1.4, radius: 0.38, blocks: true },
      { kind: PropKind.BoneTotem, dx: 2.5, dy: -1.4, radius: 0.38, blocks: true },
      { kind: PropKind.BoneTotem, dx: -2.5, dy: 1.6, radius: 0.38, blocks: true },
      { kind: PropKind.Campfire, dx: 0, dy: 0.4, radius: 0.72, blocks: true, light: { kind: "campfire", color: 0xff9a3c, radiusPx: 230, intensity: 1.25 } },
    ],
  },
  "golem-forge": {
    kind: "golem-forge", radiusX: 4, radiusY: 3, floor: "stone", chestOffset: [0, -1.8], guards: ["skeleton", "skeleton"],
    props: [
      { kind: PropKind.RunicForge, dx: -1.4, dy: -1.3, radius: 0.55, blocks: true, light: { kind: "campfire", color: 0xf97316, radiusPx: 210, intensity: 1.2 } },
      { kind: PropKind.RuinPillar, dx: 2.6, dy: -1.7, radius: 0.4, blocks: true },
      { kind: PropKind.RuinPillar, dx: -2.6, dy: 1.7, radius: 0.4, blocks: true },
      { kind: PropKind.Torch, dx: 1.6, dy: 1.2, radius: 0.2, blocks: false, light: { kind: "torch", color: 0xffb357, radiusPx: 145, intensity: 0.9 } },
    ],
  },
  "cursed-obelisk": {
    kind: "cursed-obelisk", radiusX: 4, radiusY: 3, floor: "cursed", chestOffset: [0, -1.9], guards: ["skeleton", "skeleton"],
    props: [
      { kind: PropKind.CursedObelisk, dx: 0, dy: 0.2, radius: 0.52, blocks: true, light: { kind: "firefly", color: 0xa855f7, radiusPx: 210, intensity: 1.15 } },
      { kind: PropKind.CursedCrystal, dx: -2.4, dy: -1.3, radius: 0.38, blocks: true },
      { kind: PropKind.CursedCrystal, dx: 2.4, dy: -1.3, radius: 0.38, blocks: true },
    ],
  },
  "brazier-vault": {
    kind: "brazier-vault", radiusX: 3, radiusY: 3, floor: "stone", chestOffset: [0, -0.4], guards: ["skeleton", "skeleton"],
    braziers: [[-1.7, -1.3], [1.7, -1.3], [0, 1.5]],
    props: [
      { kind: PropKind.RuinPillar, dx: -2.3, dy: 1.6, radius: 0.4, blocks: true },
      { kind: PropKind.RuinPillar, dx: 2.3, dy: 1.6, radius: 0.4, blocks: true },
    ],
  },
  "sun-dial-ruin": {
    kind: "sun-dial-ruin", radiusX: 3, radiusY: 3, floor: "stone", chestOffset: [0, 0], guards: ["skeleton"],
    braziers: [[-1.6, 0.3], [1.6, 0.3]],
    props: [
      { kind: PropKind.RuinPillar, dx: -1.8, dy: -1.8, radius: 0.4, blocks: true },
      { kind: PropKind.RuinPillar, dx: 1.8, dy: -1.8, radius: 0.4, blocks: true },
    ],
  },
};
