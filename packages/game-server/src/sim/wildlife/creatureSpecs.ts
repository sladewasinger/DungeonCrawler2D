/** Archetype definitions and entity runtime contracts for wildlife and POI guards. */
import type { AiState, DangerTier, EntityKind, GoreStyle, GoreSubstance } from "@dc2d/engine";
import { dangerTierStatScale } from "./loot/eliteScaling.js";

export type WildlifeKind = Exclude<EntityKind, "dummy" | "slime-dummy" | "spar-dummy">;
export type SearchPhase = "move_to_clue" | "scan" | "search_area";

export interface CreatureSensorySpec {
  readonly scentRadius: number;
  readonly scentMaxAgeSec: number;
  readonly searchDurationSec: number;
  readonly postChaseSearchSec: number;
  readonly scentPatienceCapSec: number;
}

export const ITEM_RAW_MEAT = "raw-meat";

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
  readonly sensory: CreatureSensorySpec;
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
  stunnedTimer: number;
  bleedTimer: number;
  bleedTickAcc: number;
  bleedDamagePerTick: number;
  burnTimer: number;
  burnTickAcc: number;
  burnDamagePerTick: number;
  poisonTimer: number;
  poisonTickAcc: number;
  poisonDamagePerTick: number;
  poisonLocked: boolean;
  parried: boolean;
  telegraphTimer: number;
  windupDuration: number;
  strikeTimer: number;
  strikeDuration: number;
  readonly strikeHitIds: Set<string>;
  attackCooldown: number;
  aiState: AiState;
  corpse: boolean;
  corpseTimer: number;
  lastKnownX: number; lastKnownY: number;
  investigateTimer: number; suspicion: number; peekSide: number;
  hunger: number; feedTimer: number;
  chargeVx: number; chargeVy: number; chargeTimer: number; chargeRecoverTimer: number; chargeHitDealt: boolean;
  alertedTimer: number; patrolPhase: number;
  targetPlayerId: string | null; targetKind: "player" | "entity" | null;
  kbVx: number; kbVy: number;
  navPath: readonly { readonly x: number; readonly y: number }[];
  navGoalX: number; navGoalY: number; navTimer: number; navReachedGoal: boolean;
  unreachableTimer: number; provokedTimer: number;
  jumpZ: number; jumpVz: number; jumpStepped: boolean;
  patrolPauseTimer: number; patrolMoveTimer: number; patrolGoalX: number; patrolGoalY: number;
  vocalCooldown: number; howlTimer: number; howlDone: boolean;
  embeddedArrows: number; spottedPopTimer: number; peelTimer: number;
  bluffTimer: number; bluffCooldown: number; pounceUsed: boolean;
  goblinRetreatTimer: number; goblinRetreated: boolean; webShotCooldown: number;
  inWater: boolean; inDeepWater: boolean;
  huntedTargetId: string | null; huntedTargetKind: "player" | "entity" | null;
  losGraceTimer: number;
  lastSeenDirX: number; lastSeenDirY: number; lastSeenSpeed: number;
  searchPhase: SearchPhase; searchPhaseTimer: number; searchAnchorAngle: number;
  searchPointX: number; searchPointY: number;
  lastScentSeq: number; scentTrackTimer: number; scentHuntElapsed: number;
  investigateElapsed: number; passiveSniffCooldown: number;
  coldTrailSearchDone: boolean; searchStepCount: number;
  dangerTier: DangerTier; isElite: boolean; title: string | undefined; damageMult: number; speedMult: number;
}

export function createWildlifeEntity(opts: {
  readonly id: string; readonly kind: WildlifeKind; readonly x: number; readonly y: number;
  readonly elevation: number; readonly homeRadius: number; readonly poiId: string | null;
  readonly packId: string | null; readonly packSlot: number;
  readonly dangerTier?: DangerTier | undefined; readonly isElite?: boolean | undefined; readonly title?: string | undefined;
}): WildlifeEntity {
  const spec = CREATURE_SPECS[opts.kind];
  const dangerTier: DangerTier = opts.dangerTier ?? 1;
  const isElite = Boolean(opts.isElite);
  const scale = dangerTierStatScale(dangerTier, isElite);
  const scaledHp = Math.round(spec.hp * scale.hpMult);
  return {
    id: opts.id, kind: opts.kind, substance: spec.substance,
    homeX: opts.x, homeY: opts.y, homeRadius: opts.homeRadius, poiId: opts.poiId,
    packId: opts.packId, packSlot: opts.packSlot, x: opts.x, y: opts.y, elevation: opts.elevation,
    facingX: 0, facingY: 1, hp: scaledHp, maxHp: scaledHp, hitTimer: 0, staggerTimer: 0, stunnedTimer: 0,
    dangerTier, isElite, title: opts.title, damageMult: scale.dmgMult, speedMult: scale.speedMult,
    bleedTimer: 0, bleedTickAcc: 0, bleedDamagePerTick: 0, burnTimer: 0, burnTickAcc: 0, burnDamagePerTick: 0,
    poisonTimer: 0, poisonTickAcc: 0, poisonDamagePerTick: 0, poisonLocked: false, parried: false, telegraphTimer: 0, windupDuration: spec.windupSec,
    strikeTimer: 0, strikeDuration: 0.16, strikeHitIds: new Set<string>(), attackCooldown: 0.4,
    aiState: ST_PATROL, corpse: false, corpseTimer: 0, lastKnownX: opts.x, lastKnownY: opts.y,
    investigateTimer: 0, suspicion: 0, peekSide: opts.packSlot % 2 === 0 ? 1 : -1, hunger: 0.25, feedTimer: 0,
    chargeVx: 0, chargeVy: 0, chargeTimer: 0, chargeRecoverTimer: 0, chargeHitDealt: false, alertedTimer: 0,
    patrolPhase: opts.packSlot * 2.1, targetPlayerId: null, targetKind: null, kbVx: 0, kbVy: 0,
    navPath: [], navGoalX: opts.x, navGoalY: opts.y, navTimer: 0, navReachedGoal: true,
    unreachableTimer: 0, provokedTimer: 0, jumpZ: 0, jumpVz: 0, jumpStepped: false,
    patrolPauseTimer: 1.0 + (opts.packSlot % 3) * 0.9, patrolMoveTimer: 0, patrolGoalX: opts.x, patrolGoalY: opts.y,
    vocalCooldown: 0, howlTimer: 0, howlDone: false, embeddedArrows: 0, spottedPopTimer: 0, peelTimer: 0,
    bluffTimer: 0, bluffCooldown: 0, pounceUsed: false, goblinRetreatTimer: 0, goblinRetreated: false, webShotCooldown: 0, inWater: false, inDeepWater: false,
    huntedTargetId: null, huntedTargetKind: null, losGraceTimer: 0, lastSeenDirX: 0, lastSeenDirY: 0, lastSeenSpeed: 0,
    searchPhase: "move_to_clue", searchPhaseTimer: 0, searchAnchorAngle: 0, searchPointX: opts.x, searchPointY: opts.y,
    lastScentSeq: 0, scentTrackTimer: 0, scentHuntElapsed: 0, investigateElapsed: 0, passiveSniffCooldown: 0,
    coldTrailSearchDone: false, searchStepCount: 0,
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
    scavenger: true, sentryIdle: false, territorialGuard: false, knockbackResist: 0.2,
    sensory: { scentRadius: 4.2, scentMaxAgeSec: 25, searchDurationSec: 9.0, postChaseSearchSec: 15.0, scentPatienceCapSec: 24.0 },
  },
  bear: {
    kind: "bear", hp: 115, speed: 3.1, damage: 20, range: 1.65, windupSec: 0.55, cooldownSec: 1.5,
    visionRange: 8.5, hearRange: 3.6, substance: GORE_BLOOD, goreStyle: STYLE_SPLAT, fatalStyle: STYLE_CHUNK,
    scavenger: true, sentryIdle: false, territorialGuard: false, knockbackResist: 0.65,
    sensory: { scentRadius: 4.5, scentMaxAgeSec: 24, searchDurationSec: 8.0, postChaseSearchSec: 12.0, scentPatienceCapSec: 20.0 },
  },
  spider: {
    kind: "spider", hp: 42, speed: 4.1, damage: 10, range: 1.35, windupSec: 0.28, cooldownSec: 1.1,
    visionRange: 6.2, hearRange: 2.8, substance: "ichor", goreStyle: STYLE_DRIP, fatalStyle: STYLE_SPLAT,
    scavenger: false, sentryIdle: false, territorialGuard: false, knockbackResist: 0.25,
    sensory: { scentRadius: 0, scentMaxAgeSec: 0, searchDurationSec: 6.5, postChaseSearchSec: 8.0, scentPatienceCapSec: 0 },
  },
  boar: {
    kind: "boar", hp: 72, speed: 3.5, damage: 16, range: 1.45, windupSec: 0.65, cooldownSec: 1.6,
    visionRange: 8.2, hearRange: 3.4, substance: GORE_BLOOD, goreStyle: STYLE_SPLAT, fatalStyle: STYLE_CHUNK,
    scavenger: false, sentryIdle: false, territorialGuard: false, knockbackResist: 0.45,
    sensory: { scentRadius: 3.6, scentMaxAgeSec: 22, searchDurationSec: 9.0, postChaseSearchSec: 14.0, scentPatienceCapSec: 22.0 },
  },
  slime: {
    kind: "slime", hp: 38, speed: 2.3, damage: 8, range: 1.2, windupSec: 0.35, cooldownSec: 1.35,
    visionRange: 6.5, hearRange: 2.4, substance: "slime", goreStyle: STYLE_SPLAT, fatalStyle: STYLE_EXPLODE,
    scavenger: false, sentryIdle: false, territorialGuard: false, knockbackResist: 0.1,
    sensory: { scentRadius: 0, scentMaxAgeSec: 0, searchDurationSec: 4.5, postChaseSearchSec: 5.5, scentPatienceCapSec: 0 },
  },
  goblin: {
    kind: "goblin", hp: 58, speed: 3.6, damage: 11, range: 1.5, windupSec: 0.42, cooldownSec: 1.25,
    visionRange: 8.8, hearRange: 3.6, substance: GORE_BLOOD, goreStyle: STYLE_SPLAT, fatalStyle: STYLE_SPLAT,
    scavenger: false, sentryIdle: false, territorialGuard: false, knockbackResist: 0.25,
    sensory: { scentRadius: 0, scentMaxAgeSec: 0, searchDurationSec: 8.0, postChaseSearchSec: 10.0, scentPatienceCapSec: 0 },
  },
  orc: {
    kind: "orc", hp: 105, speed: 2.9, damage: 18, range: 1.75, windupSec: 0.62, cooldownSec: 1.55,
    visionRange: 9.0, hearRange: 3.8, substance: GORE_BLOOD, goreStyle: STYLE_SPLAT, fatalStyle: STYLE_CHUNK,
    scavenger: false, sentryIdle: false, territorialGuard: true, knockbackResist: 0.55,
    sensory: { scentRadius: 0, scentMaxAgeSec: 0, searchDurationSec: 8.5, postChaseSearchSec: 10.5, scentPatienceCapSec: 0 },
  },
  skeleton: {
    kind: "skeleton", hp: 50, speed: 3.3, damage: 12, range: 1.55, windupSec: 0.45, cooldownSec: 1.3,
    visionRange: 8.8, hearRange: 3.4, substance: GORE_BONE, goreStyle: STYLE_CHUNK, fatalStyle: STYLE_CHUNK,
    scavenger: false, sentryIdle: false, territorialGuard: false, knockbackResist: 0.3,
    sensory: { scentRadius: 0, scentMaxAgeSec: 0, searchDurationSec: 6.5, postChaseSearchSec: 7.5, scentPatienceCapSec: 0 },
  },
  golem: {
    kind: "golem", hp: 145, speed: 2.2, damage: 24, range: 1.85, windupSec: 0.78, cooldownSec: 1.9,
    visionRange: 8.0, hearRange: 3.2, substance: "stone", goreStyle: STYLE_CHUNK, fatalStyle: STYLE_CHUNK,
    scavenger: false, sentryIdle: true, territorialGuard: true, knockbackResist: 0.85,
    sensory: { scentRadius: 0, scentMaxAgeSec: 0, searchDurationSec: 5.5, postChaseSearchSec: 6.5, scentPatienceCapSec: 0 },
  },
};
