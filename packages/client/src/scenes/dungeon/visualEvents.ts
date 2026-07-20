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
    else if (event.t === "death" && event.id === selfId) vfx.onOwnDeath(nowMs);
    else if (event.t === "fistbumpSealed") applyFistbumpSealed(conn, vfx, render, event.partnerName);
  }
}

function applyHit(
  conn: Connection,
  vfx: VfxSystem,
  render: RenderPose,
  selfId: string | undefined,
  event: { id: string; amount: number },
  nowMs: number,
): void {
  const pos = event.id === selfId ? render : conn.entities.get(event.id)?.snap;
  if (pos) vfx.spawnDamageNumber(pos.x, pos.y - 0.6, event.amount, nowMs);
  if (event.id === selfId) vfx.onOwnHit(nowMs);
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
