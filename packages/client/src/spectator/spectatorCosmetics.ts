import type { Connection } from "../net/connection/connection.js";
import type { DungeonSceneState } from "../scenes/dungeon/orchestration/state.js";

export function syncSpectatorCosmetics(
  state: DungeonSceneState,
  connection: Connection,
  nowMs: number,
): void {
  const { cosmetics } = state;
  const { spectatorFacingX: x, spectatorFacingY: y } = connection;
  cosmetics.faceX = x;
  cosmetics.faceY = y;
  if (x !== 0) cosmetics.spriteFaceX = x;
  cosmetics.attackDirX = x;
  cosmetics.attackDirY = y;
  cosmetics.attackingUntilMs = connection.spectatorAttacking ? nowMs + 60 : 0;
}
