// Applies queued visual-only connection events (hit/death) to the vfx layer.
// Outcome-bearing events (inventory, party, chat…) are routed elsewhere by
// net/apply.ts; by the time an event reaches here it's presentation only.
import type { Connection } from "../../net/connection.js";
import type { VfxSystem } from "../../vfx/index.js";
import { resolveHitAgainstPending, type PendingSwing } from "../../vfx/meleeConnect.js";
import { floorAnnouncerLine } from "./floorAnnouncer.js";
import type { RenderPose } from "./state.js";

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
    if (event.t === "hit") applyHit(conn, vfx, render, selfId, event, pendingSwings, nowMs);
    else if (event.t === "death") applyDeath(conn, vfx, render, selfId, event, nowMs);
    else if (event.t === "fistbumpSealed") applyFistbumpSealed(conn, vfx, render, event.partnerName);
    else if (event.t === "xpGained") vfx.spawnXpNumber(event.amount, nowMs);
    else if (event.t === "levelUp") vfx.spawnLevelUpFlourish(event.level, nowMs);
    else if (event.t === "floorEntered") vfx.spawnFloorBanner(event.floor, floorAnnouncerLine(event.floor), nowMs);
    else if (event.t === "bossDown") vfx.spawnBossDownFlourish(event.name, nowMs);
  }
}

/** Resolves a visual-event target's rendered position, content defId (enemies only),
 * entity kind, and (self only) the knockback vector its body exposes — see bloodDirection.ts. */
function resolveTarget(conn: Connection, render: RenderPose, isSelf: boolean, id: string) {
  const targetSnap = isSelf ? undefined : conn.entities.get(id)?.snap;
  const pos = isSelf ? render : targetSnap;
  const dir = isSelf && conn.body ? { x: conn.body.kx, y: conn.body.ky } : undefined;
  return { pos, defId: targetSnap?.defId, kind: targetSnap?.kind, dir };
}

function applyHit(
  conn: Connection,
  vfx: VfxSystem,
  render: RenderPose,
  selfId: string | undefined,
  event: { id: string; amount: number },
  pendingSwings: Map<string, PendingSwing>,
  nowMs: number,
): void {
  const isSelf = event.id === selfId;
  const { pos, defId, dir } = resolveTarget(conn, render, isSelf, event.id);
  if (pos) {
    vfx.spawnDamageNumber(pos.x, pos.y - 0.6, event.amount, nowMs);
    const groundHeight = conn.world?.groundAt(pos.x, pos.y) ?? 0;
    vfx.spawnBloodHit(pos.x, pos.y, groundHeight, defId, nowMs, dir?.x, dir?.y);
    // Panel round 3b item 5 (WHIFF FEEDBACK): this hit landed somewhere — whichever
    // pending swing plausibly caused it never gets flagged a whiff (meleeConnect.ts).
    resolveHitAgainstPending(pendingSwings, pos.x, pos.y);
  }
  if (isSelf) vfx.onOwnHit(nowMs);
}

/** Blood burst + decals at a dying entity's last known position, plus the full kill
 * moment (gib burst, corpse decal, hit-stop, kill shake) for an enemy YOU just
 * watched die — self-death keeps the plain blood treatment + its own shake instead. */
function applyDeath(
  conn: Connection,
  vfx: VfxSystem,
  render: RenderPose,
  selfId: string | undefined,
  event: { id: string },
  nowMs: number,
): void {
  const isSelf = event.id === selfId;
  const { pos, defId, kind } = resolveTarget(conn, render, isSelf, event.id);
  if (!pos) return;
  const groundHeight = conn.world?.groundAt(pos.x, pos.y) ?? 0;
  vfx.spawnBloodDeath(pos.x, pos.y, groundHeight, defId, nowMs);
  if (isSelf) vfx.onOwnDeath(nowMs);
  else if (kind === "enemy") vfx.spawnKillMoment(pos.x, pos.y, groundHeight, defId, nowMs);
}

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
