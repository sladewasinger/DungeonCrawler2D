import type { WorldView } from "@dc2d/engine";
import type {
  MonsterEntityView,
  PlayerEntityView,
} from "../../render/entities/index.js";
import type { DeathVisualEvent } from "../../net/connection.js";
import { playerSkinFor } from "../../render/entities/spriteMap.js";
import type { VfxSystem } from "../../vfx/index.js";
import {
  hitPlausiblyFromSwing,
  resolveHitAgainstPending,
  type PendingSwing,
} from "../../vfx/meleeConnect.js";

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
  readonly selfKnockback: { x: number; y: number };
  readonly nowMs: number;
}

function monsterDefId(view: CombatantView): string | undefined {
  return "defId" in view ? view.defId : undefined;
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
  world: GroundReader,
  vfx: VfxSystem,
  pendingSwings: Map<string, PendingSwing>,
  selfId: string,
  selfKnockback: { x: number; y: number },
  nowMs: number,
): void {
  seen.add(view.id);
  const previous = tracked.get(view.id);
  if (previous && view.hp < previous.hp) {
    const groundHeight = world.groundAt(view.x, view.y);
    const direction = view.id === selfId ? selfKnockback : undefined;
    vfx.spawnBloodHit(
      view.x,
      view.y,
      groundHeight,
      monsterDefId(view),
      nowMs,
      direction?.x,
      direction?.y,
    );
    resolveHitAgainstPending(pendingSwings, view.x, view.y);
  }
  if (previous) previous.hp = view.hp;
  else tracked.set(view.id, { hp: view.hp });
}

function trackViews(
  views: readonly CombatantView[],
  context: DamageVfxContext,
): void {
  for (const view of views) {
    trackCombatant(
      view,
      context.tracked,
      context.seen,
      context.world,
      context.vfx,
      context.pendingSwings,
      context.selfId,
      context.selfKnockback,
      context.nowMs,
    );
  }
}

function spawnDeathVfx(
  death: DeathVisualEvent,
  context: DamageVfxContext,
): void {
  const x = death.x;
  const y = death.y;
  if (x === undefined || y === undefined) return;
  const groundHeight = context.world.groundAt(x, y);
  const impactAngle = impactAngleFor(context.pendingSwings, x, y);
  const trackedTarget = context.tracked.get(death.id);
  const targetKind = death.targetKind ?? (trackedTarget ? "enemy" : undefined);
  const spritePrefix = targetKind === "player"
    ? playerSkinFor(death.id, death.skin)
    : undefined;
  context.vfx.spawnBloodDeath(x, y, groundHeight, death.defId, context.nowMs);
  if (death.id === context.selfId) {
    context.vfx.spawnDeathGore(
      x, y, groundHeight, death.defId, context.nowMs,
      { targetKind: "player" },
      spritePrefix ?? playerSkinFor(death.id, death.skin),
      impactAngle,
    );
    context.vfx.onOwnDeath(context.nowMs);
  } else if (targetKind !== undefined) {
    context.vfx.spawnKillMoment(
      x, y, groundHeight, death.defId, context.nowMs,
      { targetKind }, spritePrefix, impactAngle,
    );
  }
  resolveHitAgainstPending(context.pendingSwings, x, y);
}

function removeMissingHealth(context: DamageVfxContext): void {
  for (const id of context.tracked.keys()) {
    if (!context.seen.has(id)) context.tracked.delete(id);
  }
}

export function syncDamageVfx(
  tracked: Map<string, TrackedHealth>,
  seen: Set<string>,
  world: GroundReader,
  vfx: VfxSystem,
  players: readonly PlayerEntityView[],
  monsters: readonly MonsterEntityView[],
  pendingSwings: Map<string, PendingSwing>,
  selfId: string,
  selfKnockback: { x: number; y: number },
  nowMs: number,
  deaths: readonly DeathVisualEvent[] = [],
): void {
  const context: DamageVfxContext = {
    tracked,
    seen,
    world,
    vfx,
    pendingSwings,
    selfId,
    selfKnockback,
    nowMs,
  };
  seen.clear();
  trackViews(players, context);
  trackViews(monsters, context);
  for (const death of deaths) spawnDeathVfx(death, context);
  removeMissingHealth(context);
}
