/** Shared types and pure geometry helpers for HTML HUD window editing. */
import type { HudWindowLayout } from "./hudWindowStorage.js";

export interface EditableHudWindow {
  readonly element: HTMLDivElement;
  readonly layout: HudWindowLayout;
  readonly aspectRatio?: number;
  readonly minWidth?: number;
  readonly minHeight?: number;
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

export interface HudWindowEditingBinding {
  setEditing(editing: boolean): void;
}

export interface HudWindowSize {
  width: number;
  height: number;
}

export interface HudWindowSizeBounds {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}

export interface HudWindowPoint {
  x: number;
  y: number;
}

export const RESIZE_HANDLE_PX = 44;
export const MIN_WINDOW_WIDTH = 128;
export const MIN_WINDOW_HEIGHT = 72;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export interface ResizeHandleHitTest {
  rect: Pick<DOMRect, "right" | "bottom">;
  point: HudWindowPoint;
}

export const isResizeHandle = ({ rect, point }: ResizeHandleHitTest): boolean =>
  point.x <= rect.right && point.y <= rect.bottom &&
  rect.right - point.x <= RESIZE_HANDLE_PX && rect.bottom - point.y <= RESIZE_HANDLE_PX;

export const clampWindowSize = (
  size: HudWindowSize,
  bounds: HudWindowSizeBounds,
): HudWindowSize => {
  const minWidth = Math.min(bounds.minWidth, bounds.maxWidth);
  const minHeight = Math.min(bounds.minHeight, bounds.maxHeight);
  return {
    width: Math.round(clamp(size.width, minWidth, bounds.maxWidth)),
    height: Math.round(clamp(size.height, minHeight, bounds.maxHeight)),
  };
};

export const constrainAspectRatio = (
  size: HudWindowSize,
  aspectRatio: number | undefined,
): HudWindowSize => {
  if (!aspectRatio || aspectRatio <= 0) return size;
  const width = Math.min(size.width, size.height * aspectRatio);
  return { width: Math.round(width), height: Math.round(width / aspectRatio) };
};

export const resizeWindowFromPointer = (
  start: HudWindowSize,
  delta: HudWindowPoint,
  bounds: HudWindowSizeBounds,
): HudWindowSize => clampWindowSize({
  width: start.width + delta.x,
  height: start.height + delta.y,
}, bounds);

export interface PinchResizeInput {
  start: HudWindowSize;
  startDistance: number;
  distance: number;
  bounds: HudWindowSizeBounds;
}

export const resizeWindowFromPinch = ({
  start,
  startDistance,
  distance,
  bounds,
}: PinchResizeInput): HudWindowSize => {
  const factor = startDistance <= 0 ? 1 : distance / startDistance;
  return clampWindowSize(
    {
      width: start.width * factor,
      height: start.height * factor,
    },
    bounds,
  );
};
