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

export type HudWindowChrome = "standard" | "content-only";

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
  chrome?: HudWindowChrome;
  aspectRatio?: number;
  minWidth?: number;
  minHeight?: number;
  intrinsicMinHeight?: boolean;
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
  constraints: Pick<HudWindowSpec, "aspectRatio" | "minWidth" | "minHeight"> = {},
): { width: number; height: number } => {
  const raw = {
    width: Math.max(1, Math.round(layout.widthRatio * viewport.width)),
    height: Math.max(1, Math.round(layout.heightRatio * viewport.height)),
  };
  const ratio = constraints.aspectRatio;
  if (!ratio || ratio <= 0) {
    return {
      width: Math.min(Math.max(1, viewport.width), Math.max(constraints.minWidth ?? 1, raw.width)),
      height: Math.min(Math.max(1, viewport.height), Math.max(constraints.minHeight ?? 1, raw.height)),
    };
  }
  const minWidth = constraints.minWidth ?? 1;
  const minHeight = constraints.minHeight ?? 1;
  const minSide = Math.max(minWidth, minHeight * ratio);
  const maxSide = Math.min(viewport.width, viewport.height * ratio);
  const side = Math.min(
    maxSide,
    Math.max(Math.min(minSide, maxSide), Math.min(raw.width, raw.height * ratio)),
  );
  return { width: Math.max(1, Math.round(side)), height: Math.max(1, Math.round(side / ratio)) };
};

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
