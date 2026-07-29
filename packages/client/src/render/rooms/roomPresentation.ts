import { CHUNK_SIZE, roomCenterAt, roomKindAt, safeRoomAttendantPosition, type RoomKind } from "@dc2d/engine";
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import type { Connection } from "../../net/connection/connection.js";
import { depthForEntityNow, worldToScreen } from "../entities/geometry/worldToScreen.js";
import { uiTextStyle } from "../../ui/foundation/font.js";
import { syncRoomDoorLabels } from "./roomDoorLabels.js";
import { createSafeRoomAttendant } from "./safeRoomAttendant.js";
import {
  createSpawnRoomIntercom,
  positionSpawnRoomIntercom,
} from "./spawnRoomIntercom.js";
import {
  SAFE_ROOM_PRESENTATION_DEPTH,
} from "./roomPresentationDepth.js";
export {
  SAFE_ROOM_BUBBLE_DEPTH,
  SAFE_ROOM_PRESENTATION_DEPTH,
} from "./roomPresentationDepth.js";
import { syncRoomSpeech } from "./roomSpeech.js";

const ROOM_LABELS: Readonly<Record<RoomKind, string>> = {
  safe: "SAFE ROOM",
  party: "PARTY ROOM",
  personal: "YOUR PERSONAL ROOM",
  spawn: "SPAWN ROOM",
};

export function roomFloorLabelPosition(
  kind: RoomKind,
  center: { x: number; y: number },
): { x: number; y: number } {
  return { x: center.x, y: center.y - (kind === "personal" ? 1.5 : 0) };
}

interface RoomObjects {
  kind: RoomKind;
  cx: number;
  cy: number;
  floorLabel: Phaser.GameObjects.Text;
  attendant?: Phaser.GameObjects.Sprite;
  counter?: Phaser.GameObjects.Rectangle;
  nameplate?: Phaser.GameObjects.Text;
  bubble?: Phaser.GameObjects.Text;
  intercom?: Phaser.GameObjects.Image;
}

export class RoomPresentation {
  private objects: RoomObjects | null = null;
  private readonly doorLabels = new Map<string, Phaser.GameObjects.Text>();

  constructor(private readonly scene: Phaser.Scene) {}

  sync(conn: Connection, nowMs: number): void {
    if (!conn.body) return this.clear();
    const cx = Math.floor(conn.body.x / CHUNK_SIZE);
    const cy = Math.floor(conn.body.y / CHUNK_SIZE);
    const kind = roomKindAt(cx, cy);
    if (!kind) return this.clear();
    if (!this.objects || this.objects.cx !== cx || this.objects.cy !== cy) {
      this.clear();
      this.objects = this.create(kind, cx, cy);
    }
    this.positionObjects();
    this.syncDoors(conn);
    this.updateSpeech(conn, nowMs);
  }

  private syncDoors(conn: Connection): void {
    const objects = this.objects;
    if (!objects) return;
    syncRoomDoorLabels({
      scene: this.scene,
      labels: this.doorLabels,
      room: objects,
      doors: conn.roomDoors,
    });
  }

  private create(kind: RoomKind, cx: number, cy: number): RoomObjects {
    const center = roomCenterAt(cx, cy);
    const labelPosition = roomFloorLabelPosition(kind, center);
    const floorPosition = worldToScreen(labelPosition.x, labelPosition.y);
    const floorLabel = this.scene.add.text(
      floorPosition.x,
      floorPosition.y,
      ROOM_LABELS[kind],
      uiTextStyle(30, "#a9b1c8", { scale: 1, weight: "emphasis" }),
    ).setOrigin(0.5).setAlpha(0.18).setDepth(depthForEntityNow(center.x, center.y) - 1);
    const objects: RoomObjects = { kind, cx, cy, floorLabel };
    if (kind === "safe") this.createAttendant(objects);
    if (kind === "spawn") objects.intercom = createSpawnRoomIntercom(this.scene);
    return objects;
  }

  private createAttendant(objects: RoomObjects): void {
    Object.assign(objects, createSafeRoomAttendant(this.scene, objects.cx, objects.cy));
  }

  private positionObjects(): void {
    const objects = this.objects;
    if (!objects) return;
    const center = roomCenterAt(objects.cx, objects.cy);
    const labelPosition = roomFloorLabelPosition(objects.kind, center);
    const floor = worldToScreen(labelPosition.x, labelPosition.y);
    objects.floorLabel.setPosition(floor.x, floor.y)
      .setDepth(depthForEntityNow(labelPosition.x, labelPosition.y) - 1);
    if (objects.intercom) positionSpawnRoomIntercom(objects.intercom);
    if (!objects.attendant) return;
    const position = safeRoomAttendantPosition(objects.cx, objects.cy);
    const screen = worldToScreen(position.x, position.y);
    const depth = depthForEntityNow(position.x, position.y);
    objects.attendant.setPosition(screen.x, screen.y).setDepth(depth);
    objects.counter?.setPosition(screen.x, screen.y + SCREEN_TILE_PX * 0.25).setDepth(depth + 0.1);
    const headY = screen.y - objects.attendant.displayHeight;
    objects.nameplate?.setPosition(screen.x, headY - 4)
      .setDepth(SAFE_ROOM_PRESENTATION_DEPTH);
  }

  private updateSpeech(conn: Connection, nowMs: number): void {
    const objects = this.objects;
    const speaker = objects?.attendant ?? objects?.intercom;
    if (!objects || !speaker) return;
    const bubble = syncRoomSpeech({
      scene: this.scene, bubble: objects.bubble, speaker,
      speech: conn.npcSpeech, nowMs, cx: objects.cx, cy: objects.cy,
      speakerKind: objects.kind === "spawn" ? "spawn-intercom" : "attendant",
    });
    if (bubble) objects.bubble = bubble;
  }

  private clear(): void {
    const objects = this.objects;
    if (!objects) return;
    objects.floorLabel.destroy();
    objects.attendant?.destroy();
    objects.counter?.destroy();
    objects.nameplate?.destroy();
    objects.bubble?.destroy();
    objects.intercom?.destroy();
    for (const label of this.doorLabels.values()) label.destroy();
    this.doorLabels.clear();
    this.objects = null;
  }

  dispose(): void {
    this.clear();
  }
}
