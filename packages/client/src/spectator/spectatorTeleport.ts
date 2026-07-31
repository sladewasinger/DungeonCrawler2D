import type { Connection } from "../net/connection/connection.js";
import {
  consumeDungeonTeleport,
} from "../scenes/dungeon/orchestration/dungeonSceneHelpers.js";
import type { DungeonSceneState } from "../scenes/dungeon/orchestration/state.js";
import type { VfxSystem } from "../vfx/system/index.js";

export function consumeSpectatorTeleport(input: {
  readonly connection: Connection;
  readonly state: DungeonSceneState;
  readonly vfx: VfxSystem;
  readonly nowMs: number;
}): void {
  consumeDungeonTeleport({
    conn: input.connection,
    state: input.state,
    vfx: input.vfx,
    nowMs: input.nowMs,
  });
}
