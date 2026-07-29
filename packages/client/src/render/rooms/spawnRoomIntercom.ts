import { spawnRoomSpeakerPosition } from "@dc2d/engine";
import type Phaser from "phaser";
import {
  ASSET_KEYS,
  SCREEN_TILE_PX,
  WORLD_PIXEL_SCALE,
} from "../../boot/assetManifest.js";
import { worldToScreen } from "../entities/geometry/worldToScreen.js";
import { SAFE_ROOM_PRESENTATION_DEPTH } from "./roomPresentationDepth.js";

export function createSpawnRoomIntercom(
  scene: Phaser.Scene,
): Phaser.GameObjects.Image {
  const image = scene.add.image(
    0,
    0,
    ASSET_KEYS.spawnRoomMegaphone,
  );
  image.setOrigin(0.5).setScale(WORLD_PIXEL_SCALE)
    .setDepth(SAFE_ROOM_PRESENTATION_DEPTH);
  positionSpawnRoomIntercom(image);
  return image;
}

export function positionSpawnRoomIntercom(
  image: Phaser.GameObjects.Image,
): void {
  const position = spawnRoomSpeakerPosition();
  const screen = worldToScreen(position.x, position.y);
  image.setPosition(screen.x, screen.y - position.z * SCREEN_TILE_PX);
}
