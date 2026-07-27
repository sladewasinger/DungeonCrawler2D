/** Builds the 2D session-menu actions while keeping scene transitions scene-owned. */
import type Phaser from "phaser";
import type { Connection } from "../../../net/connection/connection.js";

export const createSessionActions = (
  scene: Phaser.Scene,
  connection: Connection,
): {
  respawn(): void;
  quitToTitle(): void;
} => ({
  respawn: () => connection.suicide(),
  quitToTitle: () => {
    connection.disconnect();
    scene.scene.stop("hud");
    scene.scene.start("title");
  },
});
