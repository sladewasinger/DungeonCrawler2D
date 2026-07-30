// Applies queued presentation events (health, damageImpact, and flourishes) to VFX.
// Outcome-bearing events (inventory, party, chat…) are routed elsewhere by
// net/apply.ts; by the time an event reaches here it's presentation only.
import type { Connection } from "../../../net/connection/connection.js";
import type { VfxSystem } from "../../../vfx/system/index.js";
import type { PendingSwing } from "../../../vfx/combat/meleeConnect.js";
import { floorAnnouncerLine } from "../combat/floorAnnouncer.js";
import type { RenderPose } from "../orchestration/state.js";
import { healthFeedback } from "../../../ui/presentation/healthFeedback.js";
import type { WorldPresentationVisibility } from "../../../render/visibility/worldPresentationVisibility.js";
import { applyDamageImpact, resolveVisualTarget, type CapturedTarget } from "./visualEventCombat.js";
import { shouldPresentWorldVisual } from "./worldVisualVisibility.js";

type VisualEvent = ReturnType<Connection["drainVisualEvents"]>[number];

export interface VisualEventContext {
  readonly conn: Connection;
  readonly vfx: VfxSystem;
  readonly render: RenderPose;
  readonly selfId: string | undefined;
  readonly pendingSwings: Map<string, PendingSwing>;
  readonly nowMs: number;
  readonly explicitImpacts: Map<string, number>;
  readonly worldVisibility: WorldPresentationVisibility | null;
}

export interface VisualEventInput {
  readonly conn: Connection;
  readonly vfx: VfxSystem;
  readonly render: RenderPose;
  readonly pendingSwings: Map<string, PendingSwing>;
  readonly nowMs: number;
  readonly lighting?: PresentationVisibilitySource | undefined;
}

interface PresentationVisibilitySource {
  presentationVisibility(): WorldPresentationVisibility | null;
}

export function applyVisualEvents({ conn, vfx, render, pendingSwings, nowMs, lighting }: VisualEventInput): void {
  // Continuous (not event-edge-triggered): the low-hp heartbeat throb animates every
  // frame, not just on hp change, so this runs whether or not any event fired below.
  vfx.setSelfHp(conn.hp, conn.maxHp);
  const events = conn.drainVisualEvents();
  const context: VisualEventContext = {
    conn,
    vfx,
    render,
    pendingSwings,
    nowMs,
    selfId: conn.welcome?.playerId,
    explicitImpacts: countExplicitImpacts(events),
    worldVisibility: lighting?.presentationVisibility() ?? null,
  };
  for (const event of events) applyVisualEvent(context, event);
}

function applyVisualEvent(context: VisualEventContext, event: VisualEvent): void {
  applyHealthPresentation(context, event);
  switch (event.t) {
    case "damageImpact":
    case "hit":
      applyDamageImpact(context, event);
      return;
    case "fistbumpSealed":
      applyFistbumpSealed(context, event.partnerName);
      return;
    case "xpGained":
      return context.vfx.spawnXpNumber(event.amount, context.nowMs);
    case "levelUp":
      context.vfx.spawnLevelUpFlourish(event.level, context.nowMs);
      return;
    case "floorEntered":
      context.vfx.spawnFloorBanner(event.floor, floorAnnouncerLine(event.floor), context.nowMs);
      return;
    case "bossDown":
      context.vfx.spawnBossDownFlourish(event.name, context.nowMs);
      return;
    default:
      return;
  }
}

function applyHealthPresentation(context: VisualEventContext, event: VisualEvent): void {
  const healthEvent = resolveHealthEvent(event);
  if (!healthEvent) return;
  applyHealthChange(context, healthEvent);
  if (event.t !== "health" || event.kind !== "damage") return;
  if (consumeExplicitImpact(context.explicitImpacts, event.id)) return;
  // Rolling compatibility: old servers send health but not damageImpact. This
  // remains unconditional on current HP, so god-mode restoration cannot suppress
  // the same presentation ordinary damage receives.
  applyDamageImpact(context, event);
}

function countExplicitImpacts(events: readonly VisualEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.t !== "damageImpact") continue;
    counts.set(event.id, (counts.get(event.id) ?? 0) + 1);
  }
  return counts;
}

function consumeExplicitImpact(counts: Map<string, number>, id: string): boolean {
  const count = counts.get(id) ?? 0;
  if (count <= 0) return false;
  if (count === 1) counts.delete(id);
  else counts.set(id, count - 1);
  return true;
}

function resolveHealthEvent(event: VisualEvent) {
  if (event.t === "health") return event;
  if (event.t !== "hit") return null;
  return healthEventFromHit(event);
}

function healthEventFromHit(event: Extract<VisualEvent, { t: "hit" }>) {
  return {
    id: event.id,
    delta: event.amount,
    kind: event.amount > 0 ? "heal" as const : "damage" as const,
    ...(event.x === undefined ? {} : { x: event.x }),
    ...(event.y === undefined ? {} : { y: event.y }),
    ...(event.defId === undefined ? {} : { defId: event.defId }),
    ...(event.targetKind === undefined ? {} : { targetKind: event.targetKind }),
  };
}

function applyHealthChange(context: VisualEventContext, event: CapturedTarget & {
    id: string;
    delta: number;
    kind: "heal" | "damage";
    source?: "automatic" | undefined;
    x?: number;
    y?: number;
    defId?: string;
    targetKind?: "player" | "enemy";
  }): void {
  const target = resolveVisualTarget(context, event);
  if (!target.position || event.source === "automatic") return;
  if (!shouldPresentWorldVisual({ ...target.position, isSelf: target.isSelf }, context.worldVisibility)) return;
  context.vfx.spawnDamageNumber({
    x: target.position.x,
    y: target.position.y - 0.6,
    feedback: healthFeedback(event.delta, event.kind),
    nowMs: context.nowMs,
  });
}

/** Blood burst + decals at a dying entity's last known position, plus the full kill
 * moment (gib burst, corpse decal, hit-stop, kill shake) for an enemy YOU just
 * watched die — self-death keeps the plain blood treatment + its own shake instead. */
/** Flourishes both sides of a just-sealed fistbump: our own pose plus whichever
 * nearby entity's name matches the partner the seal line named. */
function applyFistbumpSealed(context: VisualEventContext, partnerName: string): void {
  context.vfx.spawnFistbumpFlourish(context.render.x, context.render.y);
  const lowerName = partnerName.toLowerCase();
  for (const remote of context.conn.entities.values()) {
    if (remote.snap.kind === "player" && remote.snap.name?.toLowerCase() === lowerName) {
      if (!shouldPresentWorldVisual(remote.snap, context.worldVisibility)) return;
      context.vfx.spawnFistbumpFlourish(remote.snap.x, remote.snap.y);
      return;
    }
  }
}
