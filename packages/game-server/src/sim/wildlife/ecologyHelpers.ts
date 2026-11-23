/** Pure overworld ecology combat math, POI placement helpers, and entity snapshot serialization. */
import {
  BLEED_DURATION_SEC, STEALTH_TUNING, WorldChunkCache, findTilePath, isBackstabAngle,
  type ChunkPoi, type GoreStyle, type GoreSubstance, type WorldEntitySnapshot, type WorldEvent,
} from "@dc2d/engine";
import type { CombatPlayerRef } from "../combatActions.js";
import type { CombatPlayerCandidate, EcologyFoodSource } from "./creatureBehaviors.js";
import { applyKnockbackImpulse, clearNavPath, isClearSpot } from "./creatureNavigation.js";
import {
  CREATURE_SPECS, ST_ALERT, ST_AMBUSH, ST_FEED, ST_IDLE, ST_INVESTIGATE, ST_PATROL, ST_RETURN,
  type CreatureArchetypeSpec, type WildlifeEntity, type WildlifeKind,
} from "./creatureSpecs.js";
import { wakeEntityFromHit } from "./factionTargeting.js";

const KIND_SLIME: WildlifeKind = "slime";
const BLEED_SUBSTANCES = new Set<GoreSubstance>(["blood", "slime", "ichor"]);
export const UNAWARE_STATES = new Set([ST_IDLE, ST_PATROL, ST_INVESTIGATE, ST_FEED, ST_AMBUSH]);

export function computeSectorStrike(
  attacker: CombatPlayerRef,
  e: WildlifeEntity,
  opts: { readonly baseDmg: number; readonly backstabMult?: number | undefined },
): { readonly damage: number; readonly sneakHit: boolean } {
  const unaware = e.targetPlayerId === null || UNAWARE_STATES.has(e.aiState);
  const sneakHit = unaware && (Boolean(attacker.crouching) || isBackstabAngle({ attacker, target: e, targetFacing: { x: e.facingX, y: e.facingY } }));
  const mult = opts.backstabMult ?? STEALTH_TUNING.backstabDamageMult;
  return { sneakHit, damage: sneakHit ? Math.round(opts.baseDmg * mult) : opts.baseDmg };
}

export function applyWildlifeBleed(e: WildlifeEntity, substance: GoreSubstance, goreStyle: GoreStyle): void {
  if (!BLEED_SUBSTANCES.has(substance)) return;
  if (goreStyle === "drip") { e.bleedTimer = BLEED_DURATION_SEC; return; }
  if (e.hp <= e.maxHp * 0.5) e.bleedTimer = Math.max(e.bleedTimer, BLEED_DURATION_SEC * 0.85);
}

export function resolveWildlifeGore(opts: {
  readonly e: WildlifeEntity; readonly spec: CreatureArchetypeSpec;
  readonly fatal: boolean; readonly goreStyle: GoreStyle; readonly comboStep?: number | undefined;
}): GoreStyle {
  if (!opts.fatal) return opts.goreStyle;
  if (opts.e.kind === KIND_SLIME) return "explode-away";
  return opts.comboStep === 3 ? "chunk-spray" : opts.spec.fatalStyle;
}

function isGuardSpotOpen(cache: WorldChunkCache, poi: ChunkPoi, pt: { readonly x: number; readonly y: number }): boolean {
  if (cache.tileAt(pt.x, pt.y).elevation !== poi.elevation || !isClearSpot(cache, { x: pt.x, y: pt.y, pad: 0.38 })) return false;
  return findTilePath({ cache, startX: pt.x, startY: pt.y, goalX: poi.centerX, goalY: poi.centerY + poi.radiusY - 0.4, maxRadiusTiles: 12 }).reachedGoal;
}

export function findClearGuardSpot(
  cache: WorldChunkCache,
  poi: ChunkPoi,
  raw: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } {
  const yardY = poi.centerY + 0.6;
  for (const pull of [0, 0.28, 0.55, 0.8]) {
    const pt = { x: raw.x + (poi.centerX - raw.x) * pull, y: raw.y + (yardY - raw.y) * pull };
    if (isGuardSpotOpen(cache, poi, pt)) return pt;
  }
  const fallback = { x: poi.centerX, y: poi.centerY + Math.min(1.8, Math.max(0.8, poi.radiusY - 0.8)) };
  return isClearSpot(cache, { ...fallback, pad: 0.34 }) ? fallback : { x: poi.centerX, y: poi.centerY + 1.8 };
}

export function collectScavengeFoods(
  entities: readonly WildlifeEntity[],
  loot: readonly { readonly id: string; readonly itemId: string; readonly x: number; readonly y: number }[],
  isMeat: (id: string) => boolean,
): EcologyFoodSource[] {
  return [
    ...entities.filter((m) => m.corpse).map((m) => ({ x: m.x, y: m.y, entityId: m.id })),
    ...loot.filter((g) => isMeat(g.itemId)).map((g) => ({ x: g.x, y: g.y, isMeatLoot: true, lootId: g.id })),
  ];
}

export function applyDamageToCreature(opts: {
  readonly list: readonly WildlifeEntity[]; readonly players: readonly CombatPlayerCandidate[];
  readonly entity: WildlifeEntity; readonly damage: number; readonly dirX: number; readonly dirY: number;
  readonly goreStyle: GoreStyle; readonly comboStep?: number | undefined; readonly sweepDir?: number | undefined;
  readonly actorId: string; readonly events: WorldEvent[]; readonly silentKill?: boolean;
}): { readonly dmg: number; readonly fatal: boolean } {
  const e = opts.entity;
  const spec = CREATURE_SPECS[e.kind];
  const dmg = e.stunnedTimer > 0 ? Math.round(opts.damage * 1.35) : opts.damage;
  e.hp = Math.max(0, e.hp - dmg);
  e.hitTimer = 0.24; e.alertedTimer = 6.0; e.provokedTimer = 5.0;
  if (e.aiState === ST_RETURN) { e.aiState = ST_ALERT; clearNavPath(e); }
  const fatal = e.hp <= 0;
  if (!(fatal && opts.silentKill)) {
    wakeEntityFromHit({ entity: e, dirX: opts.dirX, dirY: opts.dirY, actorId: opts.actorId, allEntities: opts.list, players: opts.players });
  }
  if (!fatal) {
    applyKnockbackImpulse(e, { dirX: opts.dirX, dirY: opts.dirY, force: dmg >= 22 ? 8.0 : 6.4 });
    e.staggerTimer = Math.max(e.staggerTimer, Math.max(0.03, 0.13 * (1 - spec.knockbackResist * 0.75)));
    applyWildlifeBleed(e, spec.substance, opts.goreStyle);
  }
  const goreStyle = resolveWildlifeGore({ e, spec, fatal, goreStyle: opts.goreStyle, comboStep: opts.comboStep });
  opts.events.push({
    kind: "hit", x: e.x, y: e.y, dirX: opts.dirX, dirY: opts.dirY, value: dmg,
    actorId: opts.actorId, targetId: e.id, comboStep: opts.comboStep, sweepDir: opts.sweepDir,
    goreStyle, substance: spec.substance, fatal, entityKind: e.kind,
  });
  return { dmg, fatal };
}

export function serializeEntitySnapshot(e: WildlifeEntity): WorldEntitySnapshot {
  const prog = e.telegraphTimer > 0 ? Math.min(1, 1 - e.telegraphTimer / Math.max(0.05, e.windupDuration)) : 0;
  return {
    id: e.id, kind: e.kind, substance: e.substance, x: e.x, y: e.y, elevation: e.elevation, jumpZ: e.jumpZ,
    facingX: e.facingX, facingY: e.facingY, hp: e.hp, maxHp: e.maxHp, hitTimer: e.hitTimer,
    staggerTimer: e.staggerTimer, bleedTimer: e.bleedTimer, aiState: e.aiState, spottedPop: e.spottedPopTimer > 0,
    corpse: e.corpse, inWater: e.inWater, inDeepWater: e.inDeepWater, telegraphProgress: prog,
    suspicion: Number(e.suspicion.toFixed(2)),
    ...(e.stunnedTimer > 0 ? { stunned: true } : {}),
    ...(e.howlTimer > 0 ? { howling: true } : {}),
    ...(e.bluffTimer > 0 ? { bluffing: true } : {}),
  };
}
