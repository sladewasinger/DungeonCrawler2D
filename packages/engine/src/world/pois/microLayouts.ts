/** Compact micro-scene POI layouts scattered across overworld biomes. */
import { PropKind } from "../types.js";
import type { BiomePoiLayoutSpec } from "./shrineLayouts.js";

export const MICRO_SCENE_LAYOUTS: Readonly<Record<string, BiomePoiLayoutSpec>> = {
  "fallen-knight-grave": {
    kind: "fallen-knight-grave", radiusX: 2, radiusY: 2, floor: "moss", chestOffset: [1.1, 0.2], guards: ["skeleton"],
    props: [
      { kind: PropKind.Gravestone, dx: 0, dy: -0.9, radius: 0.35, blocks: true },
      { kind: PropKind.Torch, dx: -1.1, dy: -0.7, radius: 0.2, blocks: false, light: { kind: "torch", color: 0xffb357, radiusPx: 130, intensity: 0.85 } },
    ],
  },
  "overturned-cart": {
    kind: "overturned-cart", radiusX: 3, radiusY: 2, floor: "dirt", chestOffset: [1.5, 0.3], guards: ["goblin", "goblin"],
    props: [
      { kind: PropKind.BrokenCart, dx: -0.5, dy: -0.4, radius: 0.62, blocks: true },
      { kind: PropKind.Torch, dx: 0.8, dy: -1.1, radius: 0.2, blocks: false, light: { kind: "torch", color: 0xffb357, radiusPx: 130, intensity: 0.85 } },
    ],
  },
  "fairy-ring": {
    kind: "fairy-ring", radiusX: 2, radiusY: 2, floor: "moss", chestOffset: [0, 0.1], guards: [],
    props: [
      { kind: PropKind.FairyRing, dx: 0, dy: 0, radius: 0, blocks: false, light: { kind: "firefly", color: 0x5eead4, radiusPx: 155, intensity: 0.9 } },
      { kind: PropKind.GiantMushroom, dx: -1.4, dy: -0.6, radius: 0.34, blocks: true },
      { kind: PropKind.GiantMushroom, dx: 1.4, dy: -0.6, radius: 0.34, blocks: true },
      { kind: PropKind.Wildflower, dx: -0.9, dy: 1.2, radius: 0, blocks: false },
    ],
  },
  "hollow-great-stump": {
    kind: "hollow-great-stump", radiusX: 2, radiusY: 2, floor: "moss", chestOffset: [0.9, 0.7], guards: ["spider"],
    props: [
      { kind: PropKind.GreatStump, dx: -0.3, dy: -0.5, radius: 0.68, blocks: true },
      { kind: PropKind.Torch, dx: 1.2, dy: -0.6, radius: 0.2, blocks: false, light: { kind: "torch", color: 0xffb357, radiusPx: 125, intensity: 0.85 } },
    ],
  },
  "sunken-rowboat": {
    kind: "sunken-rowboat", radiusX: 2, radiusY: 2, floor: "moss", chestOffset: [1.1, 0.4], guards: ["slime"],
    props: [
      { kind: PropKind.SunkenBoat, dx: -0.4, dy: -0.3, radius: 0.6, blocks: true },
      { kind: PropKind.BogReed, dx: -1.3, dy: 0.9, radius: 0, blocks: false },
      { kind: PropKind.BogReed, dx: 1.2, dy: -0.9, radius: 0, blocks: false },
    ],
  },
  "hunters-blind": {
    kind: "hunters-blind", radiusX: 3, radiusY: 2, floor: "dirt", chestOffset: [1.4, -0.5], guards: ["goblin"],
    props: [
      { kind: PropKind.Palisade, dx: -1.2, dy: -1.2, radius: 0.5, blocks: true },
      { kind: PropKind.Palisade, dx: 0, dy: -1.2, radius: 0.5, blocks: true },
      { kind: PropKind.Campfire, dx: 0, dy: 0.6, radius: 0.65, blocks: true, light: { kind: "campfire", color: 0xff9a3c, radiusPx: 195, intensity: 1.15 } },
      { kind: PropKind.LoreSign, dx: -1.4, dy: 0.9, radius: 0.25, blocks: true },
    ],
  },
};
