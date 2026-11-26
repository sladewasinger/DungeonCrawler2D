/** Prop specifications for structures, lighting, ruins, shrines, and POI landmarks. */
import { PropKind, type PropSpec } from "@dc2d/contracts";

const CAT_STRUCT = "structure" as const;
const CAT_LIGHT = "lighting" as const;
const CAT_FURN = "furniture" as const;
const SHAPE_CIRCLE = "circle" as const;
const SHAPE_AABB = "aabb" as const;
const SHAPE_NONE = "none" as const;
const SURF_NONE = "none" as const;
const SURF_WOOD = "wood" as const;
const SURF_STONE = "stone" as const;
const STEALTH_NONE = { groundCoverBonus: 0, canopyShadeBonus: 0 } as const;
const STEALTH_WARM_GLOW = { groundCoverBonus: 0, canopyShadeBonus: 0, lightMaxRadius: 4.2, lightIntensity: 0.45 } as const;

export const STRUCTURE_AND_POI_PROP_SPECS = {
  [PropKind.Campfire]: {
    kind: PropKind.Campfire, category: CAT_LIGHT, collision: { shape: SHAPE_CIRCLE, offsetY: -0.17 },
    blocksLineOfSight: false, stealth: { groundCoverBonus: 0, canopyShadeBonus: 0, lightMaxRadius: 6.5, lightIntensity: 0.55 },
    combatSurface: SURF_NONE, spiderWebAnchor: false, interactionKind: "campfire",
  },
  [PropKind.Torch]: {
    kind: PropKind.Torch, category: CAT_LIGHT, collision: { shape: SHAPE_NONE, offsetY: 0 },
    blocksLineOfSight: false, stealth: { groundCoverBonus: 0, canopyShadeBonus: 0, lightMaxRadius: 4.2, lightIntensity: 0.4 },
    combatSurface: SURF_NONE, spiderWebAnchor: false,
  },
  [PropKind.Palisade]: {
    kind: PropKind.Palisade, category: CAT_STRUCT, collision: { shape: SHAPE_AABB, offsetY: -0.22, halfX: 0.40, halfY: 0.24, radius: 0.13 },
    blocksLineOfSight: true, stealth: STEALTH_NONE, combatSurface: SURF_WOOD, spiderWebAnchor: true,
  },
  [PropKind.Tent]: {
    kind: PropKind.Tent, category: CAT_STRUCT, collision: { shape: SHAPE_AABB, offsetY: -0.24, halfX: 0.36, halfY: 0, radius: 0.56 },
    blocksLineOfSight: true, stealth: STEALTH_NONE, combatSurface: SURF_NONE, spiderWebAnchor: false,
  },
  [PropKind.RuinPillar]: {
    kind: PropKind.RuinPillar, category: CAT_STRUCT, collision: { shape: SHAPE_CIRCLE, offsetY: -0.20 },
    blocksLineOfSight: true, stealth: STEALTH_NONE, combatSurface: SURF_STONE, spiderWebAnchor: true,
  },
  [PropKind.Workbench]: {
    kind: PropKind.Workbench, category: CAT_FURN, collision: { shape: SHAPE_AABB, offsetY: -0.27, halfX: 0.30, halfY: 0.05, radius: 0.15 },
    blocksLineOfSight: false, stealth: STEALTH_NONE, combatSurface: SURF_NONE, spiderWebAnchor: false, interactionKind: "workbench",
  },
  [PropKind.Bed]: {
    kind: PropKind.Bed, category: CAT_FURN, collision: { shape: SHAPE_AABB, offsetY: -0.31, halfX: 0.31, halfY: 0.07, radius: 0.15 },
    blocksLineOfSight: false, stealth: STEALTH_NONE, combatSurface: SURF_NONE, spiderWebAnchor: false, interactionKind: "bedroll",
  },
  [PropKind.WoodChest]: {
    kind: PropKind.WoodChest, category: CAT_FURN, collision: { shape: SHAPE_AABB, offsetY: -0.20, halfX: 0.22, halfY: 0.04, radius: 0.16 },
    blocksLineOfSight: false, stealth: STEALTH_NONE, combatSurface: SURF_NONE, spiderWebAnchor: false, interactionKind: "chest",
  },
  [PropKind.ShrineAltar]: {
    kind: PropKind.ShrineAltar, category: CAT_STRUCT, collision: { shape: SHAPE_CIRCLE, offsetY: -0.22 },
    blocksLineOfSight: false, stealth: STEALTH_WARM_GLOW, combatSurface: SURF_NONE, spiderWebAnchor: false, interactionKind: "shrine",
  },
  [PropKind.Waystone]: {
    kind: PropKind.Waystone, category: CAT_STRUCT, collision: { shape: SHAPE_CIRCLE, offsetY: -0.22 },
    blocksLineOfSight: false, stealth: STEALTH_WARM_GLOW, combatSurface: SURF_NONE, spiderWebAnchor: false, interactionKind: "shrine",
  },
  [PropKind.Gravestone]: {
    kind: PropKind.Gravestone, category: CAT_STRUCT, collision: { shape: SHAPE_CIRCLE, offsetY: -0.18 },
    blocksLineOfSight: false, stealth: STEALTH_NONE, combatSurface: SURF_NONE, spiderWebAnchor: false, interactionKind: "lore",
  },
  [PropKind.BrokenCart]: {
    kind: PropKind.BrokenCart, category: CAT_STRUCT, collision: { shape: SHAPE_CIRCLE, offsetY: -0.24 },
    blocksLineOfSight: true, stealth: STEALTH_NONE, combatSurface: SURF_WOOD, spiderWebAnchor: false,
  },
  [PropKind.GreatStump]: {
    kind: PropKind.GreatStump, category: CAT_STRUCT, collision: { shape: SHAPE_CIRCLE, offsetY: -0.24 },
    blocksLineOfSight: true, stealth: STEALTH_NONE, combatSurface: SURF_WOOD, spiderWebAnchor: true,
  },
  [PropKind.SunkenBoat]: {
    kind: PropKind.SunkenBoat, category: CAT_STRUCT, collision: { shape: SHAPE_CIRCLE, offsetY: -0.22 },
    blocksLineOfSight: true, stealth: STEALTH_NONE, combatSurface: SURF_WOOD, spiderWebAnchor: false,
  },
  [PropKind.LoreSign]: {
    kind: PropKind.LoreSign, category: CAT_STRUCT, collision: { shape: SHAPE_CIRCLE, offsetY: -0.16 },
    blocksLineOfSight: false, stealth: STEALTH_NONE, combatSurface: SURF_NONE, spiderWebAnchor: false, interactionKind: "lore",
  },
  [PropKind.BoneTotem]: {
    kind: PropKind.BoneTotem, category: CAT_STRUCT, collision: { shape: SHAPE_CIRCLE, offsetY: -0.20 },
    blocksLineOfSight: true, stealth: STEALTH_NONE, combatSurface: SURF_WOOD, spiderWebAnchor: false,
  },
  [PropKind.RunicForge]: {
    kind: PropKind.RunicForge, category: CAT_STRUCT, collision: { shape: SHAPE_CIRCLE, offsetY: -0.24 },
    blocksLineOfSight: true, stealth: STEALTH_WARM_GLOW, combatSurface: SURF_STONE, spiderWebAnchor: false, interactionKind: "forge",
  },
  [PropKind.CursedObelisk]: {
    kind: PropKind.CursedObelisk, category: CAT_STRUCT, collision: { shape: SHAPE_CIRCLE, offsetY: -0.24 },
    blocksLineOfSight: true, stealth: STEALTH_WARM_GLOW, combatSurface: SURF_STONE, spiderWebAnchor: false, interactionKind: "lore",
  },
  [PropKind.BrazierUnlit]: {
    kind: PropKind.BrazierUnlit, category: CAT_LIGHT, collision: { shape: SHAPE_CIRCLE, offsetY: -0.18 },
    blocksLineOfSight: false, stealth: STEALTH_NONE, combatSurface: SURF_NONE, spiderWebAnchor: false, interactionKind: "puzzle",
  },
  [PropKind.BrazierLit]: {
    kind: PropKind.BrazierLit, category: CAT_LIGHT, collision: { shape: SHAPE_CIRCLE, offsetY: -0.18 },
    blocksLineOfSight: false, stealth: STEALTH_WARM_GLOW, combatSurface: SURF_NONE, spiderWebAnchor: false, interactionKind: "puzzle",
  },
  [PropKind.HermitHut]: {
    kind: PropKind.HermitHut, category: CAT_STRUCT, collision: { shape: SHAPE_CIRCLE, offsetY: -0.28 },
    blocksLineOfSight: true, stealth: STEALTH_NONE, combatSurface: SURF_WOOD, spiderWebAnchor: false,
  },
  [PropKind.FairyRing]: {
    kind: PropKind.FairyRing, category: CAT_STRUCT, collision: { shape: SHAPE_NONE, offsetY: 0 },
    blocksLineOfSight: false, stealth: STEALTH_NONE, combatSurface: SURF_NONE, spiderWebAnchor: false,
  },
} as const satisfies Partial<Record<PropKind, PropSpec>>;
