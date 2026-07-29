import { CHUNK_SIZE } from "@dc2d/engine";
import type Phaser from "phaser";
import type { NpcSpeech } from "../../net/connection/connection.js";
import { uiTextStyle } from "../../ui/foundation/font.js";
import { SAFE_ROOM_BUBBLE_DEPTH } from "./roomPresentationDepth.js";
import {
  speechBubbleLayout,
  speechBubbleWrapWidth,
  type RoomSpeakerKind,
} from "./roomSpeechGeometry.js";
import { ROOM_SPEECH_VISUAL_STYLE } from "./roomSpeechVisualStyle.js";

interface RoomSpeechRequest {
  readonly scene: Phaser.Scene;
  readonly bubble: Phaser.GameObjects.Text | undefined;
  readonly speaker: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  readonly speech: NpcSpeech | null;
  readonly nowMs: number;
  readonly cx: number;
  readonly cy: number;
  readonly speakerKind: RoomSpeakerKind;
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
  next.setText(speech!.text).setVisible(true);
  positionSpeechBubble(request, next);
  return next;
}

function speechIsActive(request: RoomSpeechRequest): boolean {
  const { speech, nowMs, cx, cy } = request;
  if (!speech || speech.untilMs <= nowMs) return false;
  return Math.floor(speech.x / CHUNK_SIZE) === cx &&
    Math.floor(speech.y / CHUNK_SIZE) === cy;
}

function positionSpeechBubble(
  request: RoomSpeechRequest,
  bubble: Phaser.GameObjects.Text,
): void {
  const viewport = request.scene.cameras.main.worldView;
  bubble.setWordWrapWidth(speechBubbleWrapWidth(viewport.width));
  const layout = speechBubbleLayout({
    speaker: {
      x: request.speaker.x,
      y: request.speaker.y,
      width: request.speaker.displayWidth,
      height: request.speaker.displayHeight,
    },
    bubble: { width: bubble.displayWidth, height: bubble.displayHeight },
    viewport,
    speakerKind: request.speakerKind,
  });
  bubble.setOrigin(0.5, layout.originY)
    .setPosition(layout.x, layout.y)
    .setDepth(SAFE_ROOM_BUBBLE_DEPTH);
}

function createSpeechBubble(
  scene: Phaser.Scene,
  speaker: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
): Phaser.GameObjects.Text {
  const style = ROOM_SPEECH_VISUAL_STYLE.bubble;
  return scene.add.text(
    speaker.x,
    speaker.y,
    "",
    uiTextStyle(12, "#ffffff"),
  ).setOrigin(0.5, 1).setAlign("center")
    .setPadding(
      style.horizontalPaddingPx,
      style.verticalPaddingPx,
      style.horizontalPaddingPx,
      style.verticalPaddingPx,
    )
    .setBackgroundColor("rgba(20,20,28,0.92)")
    .setWordWrapWidth(style.maximumWidthPx)
    .setDepth(SAFE_ROOM_BUBBLE_DEPTH);
}
