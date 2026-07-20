// Applies queued visual-only connection events (hit/death) to the vfx layer.
// Outcome-bearing events (inventory, party, chat…) are routed elsewhere by
// net/apply.ts; by the time an event reaches here it's presentation only.
import type { Connection } from "../../net/connection.js";
import type { VfxSystem } from "../../vfx/index.js";
import type { RenderPose } from "./state.js";

export function applyVisualEvents(conn: Connection, vfx: VfxSystem, render: RenderPose, nowMs: number): void {
  const selfId = conn.welcome?.playerId;
  for (const event of conn.drainVisualEvents()) {
    if (event.t === "hit") applyHit(conn, vfx, render, selfId, event, nowMs);
    else if (event.t === "death") applyDeath(conn, vfx, render, selfId, event, nowMs);
    else if (event.t === "fistbumpSealed") applyFistbumpSealed(conn, vfx, render, event.partnerName);
  }
}

/** Resolves a visual-event target's rendered position, content defId (enemies only),
 * and (self only) the knockback vector its body exposes — see bloodDirection.ts. */
function resolveTarget(conn: Connection, render: RenderPose, isSelf: boolean, id: string) {
  const targetSnap = isSelf ? undefined : conn.entities.get(id)?.snap;
  const pos = isSelf ? render : targetSnap;
  const dir = isSelf && conn.body ? { x: conn.body.kx, y: conn.body.ky } : undefined;
  return { pos, defId: targetSnap?.defId, dir };
}

function applyHit(
  conn: Connection,
  vfx: VfxSystem,
  render: RenderPose,
  selfId: string | undefined,
  event: { id: string; amount: number },
  nowMs: number,
): void {
  const isSelf = event.id === selfId;
  const { pos, defId, dir } = resolveTarget(conn, render, isSelf, event.id);
  if (pos) {
    vfx.spawnDamageNumber(pos.x, pos.y - 0.6, event.amount, nowMs);
    vfx.spawnBloodHit(pos.x, pos.y, defId, nowMs, dir?.x, dir?.y);
  }
  if (isSelf) vfx.onOwnHit(nowMs);
}

/** Blood burst + decals at a dying entity's last known position; shake stays own-death-only. */
function applyDeath(
  conn: Connection,
  vfx: VfxSystem,
  render: RenderPose,
  selfId: string | undefined,
  event: { id: string },
  nowMs: number,
): void {
  const isSelf = event.id === selfId;
  const { pos, defId } = resolveTarget(conn, render, isSelf, event.id);
  if (pos) vfx.spawnBloodDeath(pos.x, pos.y, defId, nowMs);
  if (isSelf) vfx.onOwnDeath(nowMs);
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
