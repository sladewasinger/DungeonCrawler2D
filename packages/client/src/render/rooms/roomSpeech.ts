import { CHUNK_SIZE } from "@dc2d/engine";
import type Phaser from "phaser";
import type { NpcSpeech } from "../../net/connection/connection.js";
import { uiTextStyle } from "../../ui/foundation/font.js";
import { SAFE_ROOM_BUBBLE_DEPTH } from "./roomPresentationDepth.js";

interface RoomSpeechRequest {
  readonly scene: Phaser.Scene;
  readonly bubble: Phaser.GameObjects.Text | undefined;
  readonly speaker: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  readonly speech: NpcSpeech | null;
  readonly nowMs: number;
  readonly cx: number;
  readonly cy: number;
}

export function syncRoomSpeech(
  request: RoomSpeechRequest,
): Phaser.GameObjects.Text | undefined {
  const { bubble, speech } = request;
  if (!speechIsActive(request)) {
    bubble?.setVisible(false);
    return bubble;
  }
  const next = bubble ?? createSpeechBubble(request.scene, request.speaker);
  const headY = request.speaker.y - request.speaker.displayHeight / 2;
  next.setText(speech!.text).setVisible(true)
    .setPosition(request.speaker.x, headY - 28)
    .setDepth(SAFE_ROOM_BUBBLE_DEPTH);
  return next;
}

function speechIsActive(request: RoomSpeechRequest): boolean {
  const { speech, nowMs, cx, cy } = request;
  if (!speech || speech.untilMs <= nowMs) return false;
  return Math.floor(speech.x / CHUNK_SIZE) === cx &&
    Math.floor(speech.y / CHUNK_SIZE) === cy;
}

function createSpeechBubble(
  scene: Phaser.Scene,
  speaker: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
): Phaser.GameObjects.Text {
  return scene.add.text(
    speaker.x,
    speaker.y,
    "",
    uiTextStyle(12, "#ffffff"),
  ).setOrigin(0.5, 1).setAlign("center").setPadding(8, 5, 8, 5)
    .setBackgroundColor("rgba(20,20,28,0.92)")
    .setWordWrapWidth(260)
    .setDepth(SAFE_ROOM_BUBBLE_DEPTH);
}
