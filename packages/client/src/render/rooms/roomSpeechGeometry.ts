import { ROOM_SPEECH_VISUAL_STYLE } from "./roomSpeechVisualStyle.js";

export type RoomSpeakerKind = "attendant" | "spawn-intercom";

interface SpeechRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SpeechBubbleLayoutRequest {
  readonly speaker: SpeechRectangle;
  readonly bubble: Pick<SpeechRectangle, "width" | "height">;
  readonly viewport: SpeechRectangle;
  readonly speakerKind: RoomSpeakerKind;
}

export interface SpeechBubbleLayout {
  readonly x: number;
  readonly y: number;
  readonly originY: 0 | 1;
}

interface AnchorClampRequest {
  readonly value: number;
  readonly minimumEdge: number;
  readonly maximumEdge: number;
  readonly size: number;
  readonly origin: number;
}

export function speechBubbleLayout(
  request: SpeechBubbleLayoutRequest,
): SpeechBubbleLayout {
  const originY = request.speakerKind === "spawn-intercom" ? 0 : 1;
  const preferred = preferredBubblePosition(request);
  const margin = viewportMargin(request.viewport);
  return {
    x: clampAnchor({
      value: preferred.x,
      minimumEdge: request.viewport.x + margin.x,
      maximumEdge: request.viewport.x + request.viewport.width - margin.x,
      size: request.bubble.width,
      origin: 0.5,
    }),
    y: clampAnchor({
      value: preferred.y,
      minimumEdge: request.viewport.y + margin.y,
      maximumEdge: request.viewport.y + request.viewport.height - margin.y,
      size: request.bubble.height,
      origin: originY,
    }),
    originY,
  };
}

export function speechBubbleWrapWidth(viewportWidth: number): number {
  const style = ROOM_SPEECH_VISUAL_STYLE.bubble;
  const margin = Math.min(
    style.viewportMarginPx,
    Math.max(0, viewportWidth / 4),
  );
  const available = viewportWidth - margin * 2 -
    style.horizontalPaddingPx * 2;
  return Math.min(style.maximumWidthPx, Math.max(1, available));
}

function preferredBubblePosition(
  request: SpeechBubbleLayoutRequest,
): { x: number; y: number } {
  const { speaker, speakerKind } = request;
  const bubbleStyle = ROOM_SPEECH_VISUAL_STYLE.bubble;
  const below = speakerKind === "spawn-intercom";
  const edgeY = speaker.y + speaker.height / 2 * (below ? 1 : -1);
  const offsetY = below
    ? bubbleStyle.spawnIntercomOffsetYPx
    : bubbleStyle.attendantOffsetYPx;
  return { x: speaker.x, y: edgeY + offsetY };
}

function viewportMargin(
  viewport: SpeechRectangle,
): { x: number; y: number } {
  const margin = ROOM_SPEECH_VISUAL_STYLE.bubble.viewportMarginPx;
  return {
    x: Math.min(margin, Math.max(0, viewport.width / 4)),
    y: Math.min(margin, Math.max(0, viewport.height / 4)),
  };
}

function clampAnchor(request: AnchorClampRequest): number {
  const { value, minimumEdge, maximumEdge, size, origin } = request;
  const minimum = minimumEdge + size * origin;
  const maximum = maximumEdge - size * (1 - origin);
  if (minimum > maximum) return (minimum + maximum) / 2;
  return Math.min(maximum, Math.max(minimum, value));
}
