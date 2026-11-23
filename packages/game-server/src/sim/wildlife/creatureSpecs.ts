/** Archetype definitions and entity runtime contracts for wildlife and POI guards. */
import type { AiState, EntityKind, GoreStyle, GoreSubstance } from "@dc2d/engine";

export type WildlifeKind = Exclude<EntityKind, "dummy" | "slime-dummy" | "spar-dummy">;

export const ITEM_RAW_MEAT = "raw-meat";
export const ITEM_COOKED_MEAT = "cooked-meat";
export const ITEM_BANDAGE = "bandage";
export const ITEM_ARROW = "arrow";
export const ITEM_FLINT = "flint";
export const ITEM_STONE = "stone";
export const ITEM_HERB = "herb";
export const ITEM_TORCH = "torch";
export const ITEM_WOOD = "wood";

export const ST_IDLE: AiState = "idle";
export const ST_PATROL: AiState = "patrol";
export const ST_ALERT: AiState = "alert";
export const ST_INVESTIGATE: AiState = "investigate";
export const ST_CHASE: AiState = "chase";
export const ST_FLANK: AiState = "flank";
export const ST_CHARGE: AiState = "charge";
export const ST_AMBUSH: AiState = "ambush";
export const ST_FEED: AiState = "feed";
export const ST_RETURN: AiState = "return";
export const ST_DEAD: AiState = "dead";

export interface LootDropSpec {
  readonly itemId: string;
  readonly min: number;
  readonly max: number;
}

export interface CreatureArchetypeSpec {
  readonly kind: WildlifeKind;
  readonly hp: number;
  readonly speed: number;
  readonly damage: number;
  readonly range: number;
  readonly windupSec: number;
  readonly cooldownSec: number;
  readonly visionRange: number;
  readonly hearRange: number;
  readonly substance: GoreSubstance;
  readonly goreStyle: GoreStyle;
  readonly fatalStyle: GoreStyle;
  readonly scavenger: boolean;
  readonly sentryIdle: boolean;
  readonly territorialGuard: boolean;
  readonly knockbackResist: number;
  readonly lootDrops: readonly LootDropSpec[];
}

export interface WildlifeEntity {
  readonly id: string;
  readonly kind: WildlifeKind;
  readonly substance: GoreSubstance;
  readonly homeX: number;
  readonly homeY: number;
  readonly homeRadius: number;
  readonly poiId: string | null;
  readonly packId: string | null;
  readonly packSlot: number;
  x: number;
  y: number;
  elevation: number;
  facingX: number;
  facingY: number;
  hp: number;
  maxHp: number;
  hitTimer: number;
  staggerTimer: number;
  bleedTimer: number;
  telegraphTimer: number;
  windupDuration: number;
  attackCooldown: number;
  aiState: AiState;
  corpse: boolean;
  corpseTimer: number;
  lastKnownX: number;
  lastKnownY: number;
  investigateTimer: number;
  peekSide: number;
  hunger: number;
  feedTimer: number;
  chargeVx: number;
  chargeVy: number;
  chargeTimer: number;
  chargeRecoverTimer: number;
  chargeHitDealt: boolean;
  alertedTimer: number;
  patrolPhase: number;
  targetPlayerId: string | null;
  kbVx: number;
  kbVy: number;
  navPath: readonly { readonly x: number; readonly y: number }[];
  navGoalX: number;
  navGoalY: number;
  navTimer: number;
  navReachedGoal: boolean;
  unreachableTimer: number;
  provokedTimer: number;
  jumpZ: number;
  jumpVz: number;
  jumpStepped: boolean;
  patrolPauseTimer: number;
  patrolMoveTimer: number;
  patrolGoalX: number;
  patrolGoalY: number;
}

export function createWildlifeEntity(opts: {
  readonly id: string; readonly kind: WildlifeKind; readonly x: number; readonly y: number;
  readonly elevation: number; readonly homeRadius: number; readonly poiId: string | null;
  readonly packId: string | null; readonly packSlot: number;
}): WildlifeEntity {
  const spec = CREATURE_SPECS[opts.kind];
  return {
    id: opts.id, kind: opts.kind, substance: spec.substance,
    homeX: opts.x, homeY: opts.y, homeRadius: opts.homeRadius, poiId: opts.poiId,
    packId: opts.packId, packSlot: opts.packSlot, x: opts.x, y: opts.y, elevation: opts.elevation,
    facingX: 0, facingY: 1, hp: spec.hp, maxHp: spec.hp, hitTimer: 0, staggerTimer: 0,
    bleedTimer: 0, telegraphTimer: 0, windupDuration: spec.windupSec, attackCooldown: 0.4,
    aiState: ST_PATROL, corpse: false, corpseTimer: 0, lastKnownX: opts.x, lastKnownY: opts.y,
    investigateTimer: 0, peekSide: opts.packSlot % 2 === 0 ? 1 : -1, hunger: 0.25, feedTimer: 0,
    chargeVx: 0, chargeVy: 0, chargeTimer: 0, chargeRecoverTimer: 0, chargeHitDealt: false, alertedTimer: 0,
    patrolPhase: opts.packSlot * 2.1, targetPlayerId: null, kbVx: 0, kbVy: 0,
    navPath: [], navGoalX: opts.x, navGoalY: opts.y, navTimer: 0, navReachedGoal: true,
    unreachableTimer: 0, provokedTimer: 0, jumpZ: 0, jumpVz: 0, jumpStepped: false,
    patrolPauseTimer: 1.0 + (opts.packSlot % 3) * 0.9, patrolMoveTimer: 0, patrolGoalX: opts.x, patrolGoalY: opts.y,
  };
}

const GORE_BLOOD: GoreSubstance = "blood";
const GORE_BONE: GoreSubstance = "bone";
const STYLE_SPLAT: GoreStyle = "splatter";
const STYLE_DRIP: GoreStyle = "drip";
const STYLE_CHUNK: GoreStyle = "chunk-spray";
const STYLE_EXPLODE: GoreStyle = "explode-away";

export const CREATURE_SPECS: Readonly<Record<WildlifeKind, CreatureArchetypeSpec>> = {
  wolf: {
    kind: "wolf", hp: 52, speed: 4.3, damage: 11, range: 1.35, windupSec: 0.35, cooldownSec: 1.15,
    visionRange: 9.0, hearRange: 4.0, substance: GORE_BLOOD, goreStyle: STYLE_SPLAT, fatalStyle: STYLE_SPLAT,
    scavenger: true, sentryIdle: false, territorialGuard: false, knockbackResist: 0.2, lootDrops: [{ itemId: ITEM_RAW_MEAT, min: 1, max: 2 }],
  },
  bear: {
    kind: "bear", hp: 115, speed: 3.1, damage: 20, range: 1.65, windupSec: 0.55, cooldownSec: 1.5,
    visionRange: 8.5, hearRange: 3.6, substance: GORE_BLOOD, goreStyle: STYLE_SPLAT, fatalStyle: STYLE_CHUNK,
    scavenger: true, sentryIdle: false, territorialGuard: false, knockbackResist: 0.65, lootDrops: [{ itemId: ITEM_RAW_MEAT, min: 2, max: 3 }],
  },
  spider: {
    kind: "spider", hp: 42, speed: 4.1, damage: 10, range: 1.35, windupSec: 0.28, cooldownSec: 1.1,
    visionRange: 6.2, hearRange: 2.8, substance: "ichor", goreStyle: STYLE_DRIP, fatalStyle: STYLE_SPLAT,
    scavenger: false, sentryIdle: false, territorialGuard: false, knockbackResist: 0.25, lootDrops: [{ itemId: ITEM_HERB, min: 1, max: 2 }],
  },
  boar: {
    kind: "boar", hp: 72, speed: 3.5, damage: 16, range: 1.45, windupSec: 0.65, cooldownSec: 1.6,
    visionRange: 8.2, hearRange: 3.4, substance: GORE_BLOOD, goreStyle: STYLE_SPLAT, fatalStyle: STYLE_CHUNK,
    scavenger: false, sentryIdle: false, territorialGuard: false, knockbackResist: 0.45, lootDrops: [{ itemId: ITEM_RAW_MEAT, min: 2, max: 2 }],
  },
  slime: {
    kind: "slime", hp: 38, speed: 2.3, damage: 8, range: 1.2, windupSec: 0.35, cooldownSec: 1.35,
    visionRange: 6.5, hearRange: 2.4, substance: "slime", goreStyle: STYLE_SPLAT, fatalStyle: STYLE_EXPLODE,
    scavenger: false, sentryIdle: false, territorialGuard: false, knockbackResist: 0.1, lootDrops: [{ itemId: ITEM_HERB, min: 1, max: 1 }],
  },
  goblin: {
    kind: "goblin", hp: 58, speed: 3.6, damage: 11, range: 1.5, windupSec: 0.42, cooldownSec: 1.25,
    visionRange: 8.8, hearRange: 3.6, substance: GORE_BLOOD, goreStyle: STYLE_SPLAT, fatalStyle: STYLE_SPLAT,
    scavenger: false, sentryIdle: false, territorialGuard: false, knockbackResist: 0.25, lootDrops: [{ itemId: ITEM_ARROW, min: 2, max: 5 }, { itemId: ITEM_BANDAGE, min: 0, max: 1 }],
  },
  orc: {
    kind: "orc", hp: 105, speed: 2.9, damage: 18, range: 1.75, windupSec: 0.62, cooldownSec: 1.55,
    visionRange: 9.0, hearRange: 3.8, substance: GORE_BLOOD, goreStyle: STYLE_SPLAT, fatalStyle: STYLE_CHUNK,
    scavenger: false, sentryIdle: false, territorialGuard: true, knockbackResist: 0.55, lootDrops: [{ itemId: ITEM_COOKED_MEAT, min: 1, max: 1 }, { itemId: ITEM_FLINT, min: 1, max: 2 }],
  },
  skeleton: {
    kind: "skeleton", hp: 50, speed: 3.3, damage: 12, range: 1.55, windupSec: 0.45, cooldownSec: 1.3,
    visionRange: 8.8, hearRange: 3.4, substance: GORE_BONE, goreStyle: STYLE_CHUNK, fatalStyle: STYLE_CHUNK,
    scavenger: false, sentryIdle: false, territorialGuard: false, knockbackResist: 0.3, lootDrops: [{ itemId: ITEM_ARROW, min: 2, max: 4 }, { itemId: ITEM_STONE, min: 1, max: 2 }],
  },
  golem: {
    kind: "golem", hp: 145, speed: 2.2, damage: 24, range: 1.85, windupSec: 0.78, cooldownSec: 1.9,
    visionRange: 8.0, hearRange: 3.2, substance: "stone", goreStyle: STYLE_CHUNK, fatalStyle: STYLE_CHUNK,
    scavenger: false, sentryIdle: true, territorialGuard: true, knockbackResist: 0.85, lootDrops: [{ itemId: ITEM_STONE, min: 2, max: 4 }, { itemId: ITEM_FLINT, min: 1, max: 3 }],
  },
};
