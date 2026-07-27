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

export interface HudWindowViewport {
  width: number;
  height: number;
}

export interface DefaultWindowLayoutInput {
  spec: HudWindowSpec;
  visible: boolean;
  z: number;
  viewport?: HudWindowViewport;
  scale?: number;
}

const viewportRatio = (size: number, viewportSize: number, scale: number): number =>
  Math.min(1, Math.max(0, size * scale / Math.max(1, viewportSize)));

export const defaultWindowLayout = ({
  spec,
  visible,
  z,
  viewport = { width: spec.width, height: spec.height },
  scale = 1,
}: DefaultWindowLayoutInput): HudWindowLayout => ({
  anchor: spec.anchor,
  xRatio: 0,
  yRatio: 0,
  widthRatio: viewportRatio(spec.width, viewport.width, scale),
  heightRatio: viewportRatio(spec.height, viewport.height, scale),
  z,
  visible,
});

export const restoreStoredLayout = (
  stored: HudWindowLayout,
  defaults: HudWindowLayout,
): HudWindowLayout => ({
  ...stored,
  widthRatio: stored.widthRatio > 0 ? stored.widthRatio : defaults.widthRatio,
  heightRatio: stored.heightRatio > 0 ? stored.heightRatio : defaults.heightRatio,
  visible: stored.visible ?? defaults.visible ?? true,
});

export interface MobileDefaultInput {
  mobile: boolean;
  spec: HudWindowSpec;
  stored?: HudWindowLayout | undefined;
  desktopDefaults?: HudWindowLayout | undefined;
}

export const shouldUseMobileDefault = ({
  mobile,
  spec,
  stored,
  desktopDefaults,
}: MobileDefaultInput): boolean => {
  if (!mobile || !spec.mobile || !stored || !desktopDefaults) return false;
  return matchesDefaultPosition(stored, spec) && matchesDefaultSize(stored, desktopDefaults);
};

const matchesDefaultPosition = (stored: HudWindowLayout, spec: HudWindowSpec): boolean =>
  stored.anchor === spec.anchor && stored.xRatio === 0 && stored.yRatio === 0;

const matchesDefaultSize = (stored: HudWindowLayout, defaults: HudWindowLayout): boolean =>
  stored.widthRatio === defaults.widthRatio && stored.heightRatio === defaults.heightRatio;

export const resolveWindowSize = (
  layout: HudWindowLayout,
  viewport: HudWindowViewport,
): { width: number; height: number } => ({
  width: Math.max(1, Math.round(layout.widthRatio * viewport.width)),
  height: Math.max(1, Math.round(layout.heightRatio * viewport.height)),
});

export const resolveWindowPosition = (
  layout: HudWindowLayout,
  size: { width: number; height: number },
  root: { width: number; height: number },
): { x: number; y: number } => {
  if (layout.anchor === "free") {
    return {
      x: Math.round(layout.xRatio * Math.max(0, root.width - size.width)),
      y: Math.round(layout.yRatio * Math.max(0, root.height - size.height)),
    };
  }
  return anchoredPosition({ anchor: layout.anchor, size, viewport: root });
};
