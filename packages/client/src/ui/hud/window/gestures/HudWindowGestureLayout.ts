import {
  makeHudWindowFree,
  setRelativeWindowPosition,
  type DragGesture,
} from "./HudWindowGestureState.js";
import type {
  EditableHudWindow,
  HudWindowEditingContext,
  HudWindowSize,
  HudWindowSizeBounds,
} from "../layout/HudWindowEditingGeometry.js";
import { constrainAspectRatio } from "../layout/HudWindowEditingGeometry.js";
import { hudWindowGestureBounds } from "./HudWindowGestureState.js";

interface GestureLayoutRequest {
  record: EditableHudWindow;
  context: HudWindowEditingContext;
}

export const hudWindowSize = ({ record, context }: GestureLayoutRequest): HudWindowSize => {
  const rect = record.element.getBoundingClientRect();
  return { width: rect.width / context.scale(), height: rect.height / context.scale() };
};

export const hudWindowBounds = ({ record, context }: GestureLayoutRequest): HudWindowSizeBounds =>
  hudWindowGestureBounds(record, context.root, context.scale());

export const makeFreeHudWindow = ({ record, context }: GestureLayoutRequest): DOMRect =>
  makeHudWindowFree(record, context.root);

export const applyHudWindowSize = ({ record, context, size }: GestureLayoutRequest & {
  size: HudWindowSize;
}): void => {
  const constrained = constrainAspectRatio(size, record.aspectRatio);
  const root = context.root.getBoundingClientRect();
  const scale = context.scale();
  record.layout.widthRatio = Math.min(1, Math.max(0, constrained.width * scale / Math.max(1, root.width)));
  record.layout.heightRatio = Math.min(1, Math.max(0, constrained.height * scale / Math.max(1, root.height)));
  context.apply(record);
};

export const moveHudWindow = ({ record, context, gesture, event }: GestureLayoutRequest & {
  gesture: DragGesture;
  event: PointerEvent;
}): void => {
  const rect = record.element.getBoundingClientRect();
  setRelativeWindowPosition({
    layout: record.layout,
    point: {
      x: Math.round(event.clientX - gesture.rootRect.left - gesture.offset.x),
      y: Math.round(event.clientY - gesture.rootRect.top - gesture.offset.y),
    },
    size: { width: rect.width, height: rect.height },
    root: gesture.rootRect,
  });
  context.apply(record);
};
