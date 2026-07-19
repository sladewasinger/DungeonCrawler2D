// Applies queued visual-only connection events (hit/death) to the vfx layer.
// Outcome-bearing events (inventory, party, chat…) are routed elsewhere by
// net/apply.ts; by the time an event reaches here it's presentation only.
import type { Connection } from "../../net/connection.js";
import type { VfxSystem } from "../../vfx/index.js";
import type { RenderPose } from "./state.js";

export function applyVisualEvents(conn: Connection, vfx: VfxSystem, render: RenderPose, nowMs: number): void {
  const selfId = conn.welcome?.playerId;
  for (const event of conn.drainVisualEvents()) {
    if (event.t === "hit") {
      const pos = event.id === selfId ? render : conn.entities.get(event.id)?.snap;
      if (pos) vfx.spawnDamageNumber(pos.x, pos.y - 0.6, event.amount, nowMs);
      if (event.id === selfId) vfx.onOwnHit(nowMs);
    } else if (event.t === "death" && event.id === selfId) {
      vfx.onOwnDeath(nowMs);
    }
  }
}
