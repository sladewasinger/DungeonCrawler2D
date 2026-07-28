import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import type { Connection } from "../../net/connection/connection.js";
import { uiTextStyle } from "../../ui/foundation/font.js";
import { depthForEntityNow, worldToScreen } from "../entities/geometry/worldToScreen.js";
import { getViewOrientation } from "../view/transform/viewState.js";
import {
  isRoomDoorScreenFacing,
  roomDoorMount,
  type RoomLocation,
} from "./roomDoorPlacement.js";

export interface RoomDoorLabelSync {
  readonly scene: Phaser.Scene;
  readonly labels: Map<string, Phaser.GameObjects.Text>;
  readonly doors: Connection["roomDoors"];
  readonly room: RoomLocation;
}

export function syncRoomDoorLabels(request: RoomDoorLabelSync): void {
  const { scene, labels, doors, room } = request;
  const seen = new Set<string>();
  for (const door of doors ?? []) {
    const mount = roomDoorMount(room, door);
    if (mount && isRoomDoorScreenFacing(mount, getViewOrientation())) {
      syncRoomDoorLabel({ scene, labels, seen, door, anchor: mount.anchor });
    }
  }
  removeMissingRoomDoorLabels(labels, seen);
}

interface RoomDoorLabelRequest {
  scene: Phaser.Scene;
  labels: Map<string, Phaser.GameObjects.Text>;
  seen: Set<string>;
  door: NonNullable<Connection["roomDoors"]>[number];
  anchor: { readonly x: number; readonly y: number };
}

function syncRoomDoorLabel({ scene, labels, seen, door, anchor }: RoomDoorLabelRequest): void {
  const key = `${door.x},${door.y}`;
  seen.add(key);
  const label = labels.get(key) ?? createRoomDoorLabel({ scene, labels, key, door, anchor });
  const screen = worldToScreen(anchor.x, anchor.y);
  label.setText(door.label ?? "ROOM").setPosition(screen.x, screen.y - SCREEN_TILE_PX - 4)
    .setDepth(depthForEntityNow(anchor.x, anchor.y) + 0.7);
}

function createRoomDoorLabel({ scene, labels, key, door }: Omit<RoomDoorLabelRequest, "seen"> & { key: string }): Phaser.GameObjects.Text {
  const label = scene.add.text(0, 0, door.label ?? "ROOM", uiTextStyle(10, "#ffffff", { scale: 1, weight: "emphasis" }))
    .setOrigin(0.5, 1).setStroke("#11111a", 3);
  labels.set(key, label);
  return label;
}

function removeMissingRoomDoorLabels(labels: Map<string, Phaser.GameObjects.Text>, seen: ReadonlySet<string>): void {
  for (const [key, label] of labels) {
    if (seen.has(key)) continue;
    label.destroy();
    labels.delete(key);
  }
}
