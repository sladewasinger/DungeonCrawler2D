/** Defines gesture state and geometry primitives for HTML HUD window editing. */
import { closestAnchor } from "../layout/HudWindowGeometry.js";
import { resolveWindowPosition, resolveWindowSize } from "../layout/HudWindowLayout.js";
import {
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
} from "../layout/HudWindowEditingGeometry.js";
import type {
  EditableHudWindow,
  HudWindowPoint,
  HudWindowSize,
  HudWindowSizeBounds,
} from "../layout/HudWindowEditingGeometry.js";
import type { HudWindowLayout } from "../layout/hudWindowStorage.js";

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
  root: DOMRect,
): void => {
  const size = resolveWindowSize(layout, root);
  const position = resolveWindowPosition(layout, size, root);
  layout.anchor = closestAnchor({ position, size, viewport: root });
};

export interface RelativeWindowPositionInput {
  layout: HudWindowLayout;
  point: HudWindowPoint;
  size: HudWindowSize;
  root: HudWindowSize;
}

export const setRelativeWindowPosition = ({
  layout,
  point,
  size,
  root,
}: RelativeWindowPositionInput): void => {
  const maxX = Math.max(0, root.width - size.width);
  const maxY = Math.max(0, root.height - size.height);
  layout.xRatio = maxX === 0 ? 0 : clampGestureValue(point.x, 0, maxX) / maxX;
  layout.yRatio = maxY === 0 ? 0 : clampGestureValue(point.y, 0, maxY) / maxY;
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
): DOMRect => {
  const root = rootElement.getBoundingClientRect();
  const rect = record.element.getBoundingClientRect();
  record.layout.anchor = "free";
  setRelativeWindowPosition({
    layout: record.layout,
    point: { x: Math.round(rect.left - root.left), y: Math.round(rect.top - root.top) },
    size: { width: rect.width, height: rect.height },
    root,
  });
  return root;
};
