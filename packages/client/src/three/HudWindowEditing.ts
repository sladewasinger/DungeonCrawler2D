/** Owns pointer drag, desktop snapping, and resize persistence for one HUD window. */
import { closestAnchor } from "./HudWindowGeometry.js";
import type { HudWindowLayout } from "./hudWindowStorage.js";

export interface EditableHudWindow {
  readonly element: HTMLDivElement;
  readonly layout: HudWindowLayout;
}

export interface HudWindowEditingContext {
  readonly root: HTMLElement;
  readonly mobile: boolean;
  readonly editing: () => boolean;
  readonly scale: () => number;
  readonly apply: (record: EditableHudWindow) => void;
  readonly raise: (record: EditableHudWindow) => void;
  readonly persist: () => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const RESIZE_HANDLE_PX = 18;

export const isResizeHandle = (
  rect: Pick<DOMRect, "right" | "bottom">,
  x: number,
  y: number,
): boolean =>
  x <= rect.right &&
  y <= rect.bottom &&
  rect.right - x <= RESIZE_HANDLE_PX &&
  rect.bottom - y <= RESIZE_HANDLE_PX;

export const isInteractiveEditTarget = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest("button,input,select,textarea,[contenteditable]") !== null;

const sizeOf = (
  record: EditableHudWindow,
  scale: number,
) => ({
  width: Math.round(record.layout.width * scale),
  height: Math.round(record.layout.height * scale),
});

export const bindHudWindowEditing = (
  record: EditableHudWindow,
  context: HudWindowEditingContext,
): void => {
  record.element.addEventListener(
    "pointerdown",
    (event) => captureDrag(record, context, event),
    true,
  );
  new ResizeObserver(() => resizeWindow(record, context)).observe(record.element);
};

const captureDrag = (
  record: EditableHudWindow,
  context: HudWindowEditingContext,
  event: PointerEvent,
): void => {
  if (!context.editing()) return;
  if (isInteractiveEditTarget(event.target)) return;
  if (isResizeHandle(
    record.element.getBoundingClientRect(),
    event.clientX,
    event.clientY,
  )) return;
  event.preventDefault();
  event.stopPropagation();
  beginDrag(record, context, event);
};

const beginDrag = (
  record: EditableHudWindow,
  context: HudWindowEditingContext,
  event: PointerEvent,
): void => {
  const rootRect = context.root.getBoundingClientRect();
  const rect = record.element.getBoundingClientRect();
  record.layout.anchor = "free";
  context.raise(record);
  record.element.setPointerCapture(event.pointerId);
  const move = (next: PointerEvent) => moveWindow(
    record,
    context,
    rootRect,
    event.clientX - rect.left,
    event.clientY - rect.top,
    next,
  );
  const finish = () => finishDrag(record, context, rootRect, move);
  record.element.addEventListener("pointermove", move);
  record.element.addEventListener("pointerup", finish, { once: true });
  record.element.addEventListener("pointercancel", finish, { once: true });
};

const moveWindow = (
  record: EditableHudWindow,
  context: HudWindowEditingContext,
  rootRect: DOMRect,
  offsetX: number,
  offsetY: number,
  event: PointerEvent,
): void => {
  const size = sizeOf(record, context.scale());
  record.layout.x = clamp(
    Math.round(event.clientX - rootRect.left - offsetX),
    0,
    Math.max(0, rootRect.width - size.width),
  );
  record.layout.y = clamp(
    Math.round(event.clientY - rootRect.top - offsetY),
    0,
    Math.max(0, rootRect.height - size.height),
  );
  context.apply(record);
};

const finishDrag = (
  record: EditableHudWindow,
  context: HudWindowEditingContext,
  rootRect: DOMRect,
  move: (event: PointerEvent) => void,
): void => {
  record.element.removeEventListener("pointermove", move);
  if (!context.mobile) {
    const size = sizeOf(record, context.scale());
    record.layout.anchor = closestAnchor(
      record.layout.x,
      record.layout.y,
      size.width,
      size.height,
      rootRect.width,
      rootRect.height,
    );
  }
  context.apply(record);
  context.persist();
};

const resizeWindow = (
  record: EditableHudWindow,
  context: HudWindowEditingContext,
): void => {
  if (!context.editing()) return;
  if (record.layout.visible === false) return;
  const rect = record.element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  record.layout.width = Math.round(rect.width / context.scale());
  record.layout.height = Math.round(rect.height / context.scale());
  context.persist();
};
