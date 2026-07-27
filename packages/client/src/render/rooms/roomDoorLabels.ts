import type Phaser from "phaser";
import type { Connection } from "../../net/connection/connection.js";
import { uiTextStyle } from "../../ui/foundation/font.js";
import { depthForEntityNow, worldToScreen } from "../entities/geometry/worldToScreen.js";

export function syncRoomDoorLabels(
  scene: Phaser.Scene,
  labels: Map<string, Phaser.GameObjects.Text>,
  doors: Connection["roomDoors"],
): void {
  const seen = new Set<string>();
  for (const door of doors ?? []) syncRoomDoorLabel({ scene, labels, seen, door });
  removeMissingRoomDoorLabels(labels, seen);
}

interface RoomDoorLabelRequest {
  scene: Phaser.Scene;
  labels: Map<string, Phaser.GameObjects.Text>;
  seen: Set<string>;
  door: NonNullable<Connection["roomDoors"]>[number];
}

function syncRoomDoorLabel({ scene, labels, seen, door }: RoomDoorLabelRequest): void {
  const key = `${door.x},${door.y}`;
  seen.add(key);
  const label = labels.get(key) ?? createRoomDoorLabel({ scene, labels, key, door });
  const screen = worldToScreen(door.x + 0.5, door.y);
  label.setText(door.label ?? "ROOM").setPosition(screen.x, screen.y - 4)
    .setDepth(depthForEntityNow(door.x, door.y) + 0.6);
}

function createRoomDoorLabel({ scene, labels, key, door }: Omit<RoomDoorLabelRequest, "seen"> & { key: string }): Phaser.GameObjects.Text {
  const screen = worldToScreen(door.x + 0.5, door.y);
  const label = scene.add.text(screen.x, screen.y - 4, door.label ?? "ROOM", uiTextStyle(10, "#ffffff", { scale: 1, weight: "emphasis" }))
    .setOrigin(0.5, 1).setStroke("#11111a", 3).setDepth(depthForEntityNow(door.x, door.y) + 0.6);
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
