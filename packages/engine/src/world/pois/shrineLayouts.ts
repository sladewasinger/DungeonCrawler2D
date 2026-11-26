/** Layout specs for interactive Shrines, Ancient Waystones, and Friendly Sanctuaries. */
import { PropKind, type PoiKind } from "../types.js";

export interface FrontierPropSpec {
  readonly kind: PropKind;
  readonly dx: number;
  readonly dy: number;
  readonly radius: number;
  readonly blocks: boolean;
  readonly light?: { readonly kind: "torch" | "campfire" | "firefly"; readonly color: number; readonly radiusPx: number; readonly intensity: number } | undefined;
}

export interface FrontierPoiLayoutSpec {
  readonly kind: PoiKind;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly floor: "stone" | "dirt" | "moss" | "cursed";
  readonly chestOffset: readonly [number, number];
  readonly guards: readonly ("goblin" | "orc" | "skeleton" | "golem" | "spider" | "slime")[];
  readonly braziers?: readonly (readonly [number, number])[];
  readonly props: readonly FrontierPropSpec[];
}

export const SHRINE_AND_FRIENDLY_LAYOUTS: Readonly<Record<string, FrontierPoiLayoutSpec>> = {
  "shrine-swiftness": {
    kind: "shrine-swiftness", radiusX: 2, radiusY: 2, floor: "stone", chestOffset: [0, 0], guards: [],
    props: [
      { kind: PropKind.ShrineAltar, dx: 0, dy: 0, radius: 0.45, blocks: true, light: { kind: "firefly", color: 0x38bdf8, radiusPx: 145, intensity: 0.9 } },
      { kind: PropKind.Torch, dx: -1.4, dy: -1.1, radius: 0.2, blocks: false, light: { kind: "torch", color: 0x7dd3fc, radiusPx: 115, intensity: 0.75 } },
      { kind: PropKind.Torch, dx: 1.4, dy: -1.1, radius: 0.2, blocks: false, light: { kind: "torch", color: 0x7dd3fc, radiusPx: 115, intensity: 0.75 } },
    ],
  },
  "shrine-vigor": {
    kind: "shrine-vigor", radiusX: 2, radiusY: 2, floor: "moss", chestOffset: [0, 0], guards: [],
    props: [
      { kind: PropKind.ShrineAltar, dx: 0, dy: 0, radius: 0.45, blocks: true, light: { kind: "firefly", color: 0x4ade80, radiusPx: 150, intensity: 0.95 } },
      { kind: PropKind.Wildflower, dx: -1.3, dy: 0.8, radius: 0, blocks: false },
      { kind: PropKind.Wildflower, dx: 1.3, dy: 0.8, radius: 0, blocks: false },
    ],
  },
  "shrine-shadow": {
    kind: "shrine-shadow", radiusX: 2, radiusY: 2, floor: "cursed", chestOffset: [0, 0], guards: [],
    props: [
      { kind: PropKind.ShrineAltar, dx: 0, dy: 0, radius: 0.45, blocks: true, light: { kind: "firefly", color: 0xa855f7, radiusPx: 150, intensity: 0.95 } },
      { kind: PropKind.RuinPillar, dx: -1.5, dy: -1.2, radius: 0.38, blocks: true },
      { kind: PropKind.RuinPillar, dx: 1.5, dy: -1.2, radius: 0.38, blocks: true },
    ],
  },
  "ancient-waystone": {
    kind: "ancient-waystone", radiusX: 2, radiusY: 2, floor: "stone", chestOffset: [0, 0], guards: [],
    props: [
      { kind: PropKind.Waystone, dx: 0, dy: 0, radius: 0.48, blocks: true, light: { kind: "firefly", color: 0x38bdf8, radiusPx: 185, intensity: 1.1 } },
      { kind: PropKind.RuinPillar, dx: -1.5, dy: 1.1, radius: 0.38, blocks: true },
      { kind: PropKind.RuinPillar, dx: 1.5, dy: 1.1, radius: 0.38, blocks: true },
    ],
  },
  "hermits-hut": {
    kind: "hermits-hut", radiusX: 3, radiusY: 3, floor: "dirt", chestOffset: [1.6, -0.5], guards: [],
    props: [
      { kind: PropKind.HermitHut, dx: 0, dy: -1.6, radius: 0.72, blocks: true },
      { kind: PropKind.Campfire, dx: 0, dy: 0.6, radius: 0.65, blocks: true, light: { kind: "campfire", color: 0xff9a3c, radiusPx: 220, intensity: 1.25 } },
      { kind: PropKind.Workbench, dx: -1.6, dy: -0.4, radius: 0.42, blocks: true },
      { kind: PropKind.LoreSign, dx: -1.2, dy: 1.5, radius: 0.25, blocks: true },
    ],
  },
  "tinker-camp": {
    kind: "tinker-camp", radiusX: 3, radiusY: 3, floor: "dirt", chestOffset: [1.5, -1.2], guards: [],
    props: [
      { kind: PropKind.Tent, dx: -1.4, dy: -1.3, radius: 0.55, blocks: true },
      { kind: PropKind.Campfire, dx: 0, dy: 0.5, radius: 0.65, blocks: true, light: { kind: "campfire", color: 0xff9a3c, radiusPx: 220, intensity: 1.25 } },
      { kind: PropKind.Workbench, dx: -1.5, dy: 0.6, radius: 0.42, blocks: true },
      { kind: PropKind.LoreSign, dx: 1.3, dy: 1.2, radius: 0.25, blocks: true },
    ],
  },
};
