/** Owns pure layout construction and geometry for persistent HTML HUD windows. */
import { anchoredPosition } from "./HudWindowGeometry.js";
import type { HudWindowLayout } from "./hudWindowStorage.js";

export type HudAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "free";

export interface HudWindowSpec {
  id: string;
  title: string;
  width: number;
  height: number;
  anchor: Exclude<HudAnchor, "free">;
  content: HTMLElement;
  mobile?: Pick<HudWindowSpec, "width" | "height" | "anchor">;
  interactive?: boolean;
  defaultVisible?: boolean;
}

export const defaultWindowLayout = (
  spec: HudWindowSpec,
  visible: boolean,
  z: number,
): HudWindowLayout => ({
  anchor: spec.anchor,
  x: 0,
  y: 0,
  width: spec.width,
  height: spec.height,
  z,
  visible,
});

export const restoreStoredLayout = (
  stored: HudWindowLayout,
  defaults: HudWindowLayout,
): HudWindowLayout => ({
  ...stored,
  width: stored.width > 0 ? stored.width : defaults.width,
  height: stored.height > 0 ? stored.height : defaults.height,
  visible: stored.visible ?? defaults.visible ?? true,
});

export const shouldUseMobileDefault = (
  mobile: boolean,
  spec: HudWindowSpec,
  stored: HudWindowLayout | undefined,
): boolean => {
  if (!mobile || !spec.mobile || !stored) return false;
  return stored.anchor === spec.anchor &&
    stored.x === 0 &&
    stored.y === 0 &&
    stored.width === spec.width &&
    stored.height === spec.height;
};

export const scaledWindowSize = (
  layout: HudWindowLayout,
  scale: number,
): { width: number; height: number } => ({
  width: Math.round(layout.width * scale),
  height: Math.round(layout.height * scale),
});

export const resolveWindowPosition = (
  layout: HudWindowLayout,
  size: { width: number; height: number },
  root: { width: number; height: number },
): { x: number; y: number } => {
  if (layout.anchor === "free") return { x: layout.x, y: layout.y };
  return anchoredPosition(
    layout.anchor,
    size.width,
    size.height,
    root.width,
    root.height,
  );
};
