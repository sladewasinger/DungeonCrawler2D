/** Defines gesture state and geometry primitives for HTML HUD window editing. */
import { closestAnchor } from "./HudWindowGeometry.js";
import {
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
} from "./HudWindowEditingGeometry.js";
import type {
  EditableHudWindow,
  HudWindowPoint,
  HudWindowSize,
  HudWindowSizeBounds,
} from "./HudWindowEditingGeometry.js";
import type { HudWindowLayout } from "./hudWindowStorage.js";

export interface DragGesture {
  kind: "drag";
  pointerId: number;
  offset: HudWindowPoint;
  point: HudWindowPoint;
  rootRect: DOMRect;
}

export interface ResizeGesture {
  kind: "resize";
  pointerId: number;
  origin: HudWindowPoint;
  point: HudWindowPoint;
  start: HudWindowSize;
  bounds: HudWindowSizeBounds;
}

export interface PinchGesture {
  kind: "pinch";
  pointerIds: readonly [number, number];
  points: Map<number, HudWindowPoint>;
  startDistance: number;
  start: HudWindowSize;
  bounds: HudWindowSizeBounds;
}

export type HudWindowGesture =
  | DragGesture
  | ResizeGesture
  | PinchGesture;

export const clampGestureValue = (
  value: number,
  minimum: number,
  maximum: number,
): number => Math.min(Math.max(value, minimum), maximum);

export const pointerPoint = (
  event: PointerEvent,
): HudWindowPoint => ({
  x: event.clientX,
  y: event.clientY,
});

export const pointDistance = (
  first: HudWindowPoint,
  second: HudWindowPoint,
): number => Math.hypot(
  first.x - second.x,
  first.y - second.y,
);

export const releaseGesturePointers = (
  element: HTMLElement,
  gesture: HudWindowGesture,
): void => {
  const pointers = gesture.kind === "pinch"
    ? gesture.pointerIds
    : [gesture.pointerId];
  for (const pointerId of pointers) {
    if (element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  }
};

export const snapWindowAnchor = (
  layout: HudWindowLayout,
  scale: number,
  root: DOMRect,
): void => {
  layout.anchor = closestAnchor(
    layout.x,
    layout.y,
    Math.round(layout.width * scale),
    Math.round(layout.height * scale),
    root.width,
    root.height,
  );
};

export const hudWindowGestureBounds = (
  record: EditableHudWindow,
  rootElement: HTMLElement,
  scale: number,
): HudWindowSizeBounds => {
  const rect = record.element.getBoundingClientRect();
  const root = rootElement.getBoundingClientRect();
  return {
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    maxWidth: Math.max(
      1,
      (root.width - Math.max(0, rect.left - root.left)) / scale,
    ),
    maxHeight: Math.max(
      1,
      (root.height - Math.max(0, rect.top - root.top)) / scale,
    ),
  };
};

export const makeHudWindowFree = (
  record: EditableHudWindow,
  rootElement: HTMLElement,
  scale: number,
): DOMRect => {
  const root = rootElement.getBoundingClientRect();
  const rect = record.element.getBoundingClientRect();
  record.layout.anchor = "free";
  record.layout.x = clampGestureValue(
    Math.round(rect.left - root.left),
    0,
    Math.max(0, root.width - record.layout.width * scale),
  );
  record.layout.y = clampGestureValue(
    Math.round(rect.top - root.top),
    0,
    Math.max(0, root.height - record.layout.height * scale),
  );
  return root;
};
