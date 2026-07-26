// Applies queued visual-only connection events (hit/death) to the vfx layer.
// Outcome-bearing events (inventory, party, chat…) are routed elsewhere by
// net/apply.ts; by the time an event reaches here it's presentation only.
import type { Connection } from "../../net/connection.js";
import type { VfxSystem } from "../../vfx/index.js";
import { resolveHitAgainstPending, type PendingSwing } from "../../vfx/meleeConnect.js";
import { floorAnnouncerLine } from "./floorAnnouncer.js";
import type { RenderPose } from "./state.js";
import { healthFeedback } from "../../ui/healthFeedback.js";

type VisualEvent = ReturnType<Connection["drainVisualEvents"]>[number];

export function applyVisualEvents(
  conn: Connection,
  vfx: VfxSystem,
  render: RenderPose,
  pendingSwings: Map<string, PendingSwing>,
  nowMs: number,
): void {
  // Continuous (not event-edge-triggered): the low-hp heartbeat throb animates every
  // frame, not just on hp change, so this runs whether or not any event fired below.
  vfx.setSelfHp(conn.hp, conn.maxHp);
  const selfId = conn.welcome?.playerId;
  for (const event of conn.drainVisualEvents()) {
    const healthEvent = resolveHealthEvent(event);
    if (healthEvent) applyHealthChange(conn, vfx, render, selfId, healthEvent, pendingSwings, nowMs);
    else if (event.t === "fistbumpSealed") applyFistbumpSealed(conn, vfx, render, event.partnerName);
    else if (event.t === "xpGained") vfx.spawnXpNumber(event.amount, nowMs);
    else if (event.t === "levelUp") vfx.spawnLevelUpFlourish(event.level, nowMs);
    else if (event.t === "floorEntered") vfx.spawnFloorBanner(event.floor, floorAnnouncerLine(event.floor), nowMs);
    else if (event.t === "bossDown") vfx.spawnBossDownFlourish(event.name, nowMs);
  }
}

function resolveHealthEvent(event: VisualEvent) {
  if (event.t === "health") return event;
  if (event.t !== "hit") return null;
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

/** Resolves a visual-event target's rendered position, content defId (enemies only),
 * entity kind, and (self only) the knockback vector its body exposes — see bloodDirection.ts. */
interface CapturedTarget {
  x?: number;
  y?: number;
  defId?: string;
  targetKind?: "player" | "enemy";
}

function capturedPosition(captured: CapturedTarget) {
  if (captured.x === undefined || captured.y === undefined) return undefined;
  return { x: captured.x, y: captured.y };
}

function selfKnockback(conn: Connection, isSelf: boolean) {
  if (!isSelf || !conn.body) return undefined;
  return { x: conn.body.kx, y: conn.body.ky };
}

function resolveTarget(
  conn: Connection,
  render: RenderPose,
  isSelf: boolean,
  id: string,
  captured: CapturedTarget,
) {
  const targetSnap = isSelf ? undefined : conn.entities.get(id)?.snap;
  const pos = isSelf ? render : capturedPosition(captured) ?? targetSnap;
  return {
    pos,
    defId: captured.defId ?? targetSnap?.defId,
    kind: captured.targetKind ?? targetSnap?.kind,
    dir: selfKnockback(conn, isSelf),
  };
}

function applyHealthChange(
  conn: Connection,
  vfx: VfxSystem,
  render: RenderPose,
  selfId: string | undefined,
  event: {
    id: string;
    delta: number;
    kind: "heal" | "damage";
    source?: "automatic" | undefined;
    x?: number;
    y?: number;
    defId?: string;
    targetKind?: "player" | "enemy";
  },
  pendingSwings: Map<string, PendingSwing>,
  nowMs: number,
): void {
  const isSelf = event.id === selfId;
  const { pos } = resolveTarget(
    conn,
    render,
    isSelf,
    event.id,
    event,
  );
  if (pos) {
    if (event.source !== "automatic") {
      vfx.spawnDamageNumber(pos.x, pos.y - 0.6, healthFeedback(event.delta, event.kind), nowMs);
    }
    if (event.kind === "heal") return;
    // Panel round 3b item 5 (WHIFF FEEDBACK): this hit landed somewhere — whichever
    // pending swing plausibly caused it never gets flagged a whiff (meleeConnect.ts).
    resolveHitAgainstPending(pendingSwings, pos.x, pos.y);
  }
  if (isSelf) vfx.onOwnHit(nowMs);
}

/** Blood burst + decals at a dying entity's last known position, plus the full kill
 * moment (gib burst, corpse decal, hit-stop, kill shake) for an enemy YOU just
 * watched die — self-death keeps the plain blood treatment + its own shake instead. */
/** Flourishes both sides of a just-sealed fistbump: our own pose plus whichever
 * nearby entity's name matches the partner the seal line named. */
function applyFistbumpSealed(conn: Connection, vfx: VfxSystem, render: RenderPose, partnerName: string): void {
  vfx.spawnFistbumpFlourish(render.x, render.y);
  const lowerName = partnerName.toLowerCase();
  for (const remote of conn.entities.values()) {
    if (remote.snap.kind === "player" && remote.snap.name?.toLowerCase() === lowerName) {
      vfx.spawnFistbumpFlourish(remote.snap.x, remote.snap.y);
      return;
    }
  }
}
