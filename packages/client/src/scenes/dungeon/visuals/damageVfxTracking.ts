import type { WorldView } from "@dc2d/engine";
import type {
  MonsterEntityView,
  PlayerEntityView,
} from "../../../render/entities/geometry/index.js";
import type { DeathVisualEvent } from "../../../net/connection/connection.js";
import { playerSkinFor } from "../../../render/entities/visuals/spriteMap.js";
import type { VfxSystem } from "../../../vfx/system/index.js";
import {
  hitPlausiblyFromSwing,
  resolveHitAgainstPending,
  type PendingSwing,
} from "../../../vfx/combat/melee/meleeConnect.js";
import { restoreRetainedDeathPresentation } from "./death/retainedDeathPresentation.js";

// Death presentation keeps a small combatant registry so a just-removed target can
// still be classified. Hit blood deliberately does not live here: visualEvents.ts
// consumes the authoritative damageImpact signal for both ordinary and god-mode hits.

interface TrackedHealth {
  hp: number;
}

type CombatantView = PlayerEntityView | MonsterEntityView;
type GroundReader = Pick<WorldView, "groundAt">;

interface DamageVfxContext {
  readonly tracked: Map<string, TrackedHealth>;
  readonly seen: Set<string>;
  readonly world: GroundReader;
  readonly vfx: VfxSystem;
  readonly pendingSwings: Map<string, PendingSwing>;
  readonly selfId: string;
  readonly nowMs: number;
}

function impactAngleFor(
  pendingSwings: ReadonlyMap<string, PendingSwing>,
  x: number,
  y: number,
): number | undefined {
  let newest: PendingSwing | undefined;
  for (const swing of pendingSwings.values()) {
    if (!hitPlausiblyFromSwing(swing, x, y)) continue;
    if (!newest || swing.startedAtMs > newest.startedAtMs) newest = swing;
  }
  return newest?.angleRad;
}

function trackCombatant(
  view: CombatantView,
  tracked: Map<string, TrackedHealth>,
  seen: Set<string>,
): void {
  seen.add(view.id);
  const previous = tracked.get(view.id);
  if (previous) previous.hp = view.hp;
  else tracked.set(view.id, { hp: view.hp });
}

function trackViews(
  views: readonly CombatantView[],
  context: DamageVfxContext,
): void {
  for (const view of views) {
    trackCombatant(view, context.tracked, context.seen);
  }
}

function spawnDeathVfx(death: DeathVisualEvent, context: DamageVfxContext): void {
  const x = death.x;
  const y = death.y;
  if (x === undefined || y === undefined) return;
  const groundHeight = context.world.groundAt(x, y);
  const impactAngle = impactAngleFor(context.pendingSwings, x, y);
  const trackedTarget = context.tracked.get(death.id);
  const presentation = deathPresentation(death, trackedTarget);
  if (death.persistentOnly) {
    return restoreRetainedDeathPresentation({
      death,
      vfx: context.vfx,
      nowMs: context.nowMs,
      x,
      y,
      groundHeight,
      impactAngle,
      ...presentation,
    });
  }
  context.vfx.spawnBloodDeath({ x, y, groundHeight, defId: death.defId, nowMs: context.nowMs });
  spawnDeathPresentation({ death, context, x, y, groundHeight, impactAngle, ...presentation });
  resolveHitAgainstPending(context.pendingSwings, x, y);
}

function deathPresentation(death: DeathVisualEvent, trackedTarget: TrackedHealth | undefined) {
  const targetKind = death.targetKind ?? (trackedTarget ? "enemy" : undefined);
  return { targetKind, spritePrefix: targetKind === "player" ? playerSkinFor(death.id, death.skin) : undefined };
}

interface DeathPresentationRequest {
  readonly death: DeathVisualEvent;
  readonly context: DamageVfxContext;
  readonly x: number;
  readonly y: number;
  readonly groundHeight: number;
  readonly impactAngle: number | undefined;
  readonly targetKind: "player" | "enemy" | undefined;
  readonly spritePrefix: string | undefined;
}

function spawnDeathPresentation(request: DeathPresentationRequest): void {
  const { death, context, x, y, groundHeight, impactAngle, targetKind, spritePrefix } = request;
  if (death.id === context.selfId) return spawnOwnDeath({ death, context, x, y, groundHeight, impactAngle, spritePrefix });
  if (targetKind !== undefined) context.vfx.spawnKillMoment({ x, y, groundHeight, defId: death.defId, nowMs: context.nowMs, appearance: { targetKind }, spritePrefix, impactAngle });
}

function spawnOwnDeath(request: Omit<DeathPresentationRequest, "targetKind">): void {
  const { death, context, x, y, groundHeight, impactAngle, spritePrefix } = request;
  context.vfx.spawnDeathGore({ x, y, groundHeight, defId: death.defId, nowMs: context.nowMs, appearance: { targetKind: "player" }, spritePrefix: spritePrefix ?? playerSkinFor(death.id, death.skin), impactAngle });
  context.vfx.onOwnDeath(context.nowMs);
}

function removeMissingHealth(context: DamageVfxContext): void {
  for (const id of context.tracked.keys()) {
    if (!context.seen.has(id)) context.tracked.delete(id);
  }
}

export interface DamageVfxSyncRequest {
  readonly tracked: Map<string, TrackedHealth>;
  readonly seen: Set<string>;
  readonly world: GroundReader;
  readonly vfx: VfxSystem;
  readonly players: readonly PlayerEntityView[];
  readonly monsters: readonly MonsterEntityView[];
  readonly pendingSwings: Map<string, PendingSwing>;
  readonly selfId: string;
  readonly nowMs: number;
  readonly deaths?: readonly DeathVisualEvent[];
}

type LegacyDamageVfxArgs = [Map<string, TrackedHealth>, Set<string>, GroundReader, VfxSystem, readonly PlayerEntityView[], readonly MonsterEntityView[], Map<string, PendingSwing>, string, number, ReadonlyArray<DeathVisualEvent>?];

export function syncDamageVfx(...args: [DamageVfxSyncRequest] | LegacyDamageVfxArgs): void {
  const request = normalizeDamageVfxRequest(args);
  const { tracked, seen, world, vfx, players, monsters, pendingSwings, selfId, nowMs, deaths = [] } = request;
  const context: DamageVfxContext = {
    tracked,
    seen,
    world,
    vfx,
    pendingSwings,
    selfId,
    nowMs,
  };
  seen.clear();
  trackViews(players, context);
  trackViews(monsters, context);
  for (const death of deaths) spawnDeathVfx(death, context);
  removeMissingHealth(context);
}

function normalizeDamageVfxRequest(args: [DamageVfxSyncRequest] | LegacyDamageVfxArgs): DamageVfxSyncRequest {
  const [first] = args;
  if ("tracked" in first) return first;
  const [tracked, seen, world, vfx, players, monsters, pendingSwings, selfId, nowMs, deaths] = args as LegacyDamageVfxArgs;
  return { tracked, seen, world, vfx, players, monsters, pendingSwings, selfId, nowMs, ...(deaths === undefined ? {} : { deaths }) };
}
