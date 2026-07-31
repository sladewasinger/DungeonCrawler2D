import type Phaser from "phaser";
import type { Connection } from "../../../net/connection/connection.js";
import { consumeSessionEndMessage } from "../../../net/connection/lifecycle/sessionEnd.js";

export function redirectExpiredSession(scene: Phaser.Scene, conn: Connection): boolean {
  const message = consumeSessionEndMessage(conn);
  if (!message) return false;
  scene.scene.stop("hud");
  scene.scene.start("title", { endMessage: message });
  return true;
}
