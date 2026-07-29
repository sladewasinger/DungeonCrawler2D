import { safeRoomAttendantPosition } from "@dc2d/engine";
import type Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";
import { uiTextStyle } from "../../ui/foundation/font.js";
import { depthForEntityNow, worldToScreen } from "../entities/geometry/worldToScreen.js";
import { SAFE_ROOM_PRESENTATION_DEPTH } from "./roomPresentationDepth.js";

export interface SafeRoomAttendantObjects {
  attendant: Phaser.GameObjects.Sprite;
  counter: Phaser.GameObjects.Rectangle;
  nameplate: Phaser.GameObjects.Text;
}

export function createSafeRoomAttendant(scene: Phaser.Scene, cx: number, cy: number): SafeRoomAttendantObjects {
  const position = safeRoomAttendantPosition(cx, cy);
  const screen = worldToScreen(position.x, position.y);
  const depth = depthForEntityNow(position.x, position.y);
  const counter = scene.add.rectangle(screen.x, screen.y + SCREEN_TILE_PX * 0.25, SCREEN_TILE_PX * 2.5, SCREEN_TILE_PX * 0.65, 0x6e4528)
    .setStrokeStyle(3, 0x2c1b13).setDepth(depth + 0.1);
  const attendant = scene.add.sprite(screen.x, screen.y, ASSET_KEYS.atlas, "goblin_idle_anim_f0")
    .setOrigin(0.5, 1).setScale(WORLD_PIXEL_SCALE).setDepth(depth);
  attendant.play("goblin_idle");
  const nameplate = scene.add.text(screen.x, screen.y - attendant.displayHeight - 4, "Nib, Safe Room Attendant", uiTextStyle(11, "#ffd98a", { scale: 1, weight: "emphasis" }))
    .setOrigin(0.5, 1).setStroke("#11111a", 3).setDepth(SAFE_ROOM_PRESENTATION_DEPTH);
  return { counter, attendant, nameplate };
}
