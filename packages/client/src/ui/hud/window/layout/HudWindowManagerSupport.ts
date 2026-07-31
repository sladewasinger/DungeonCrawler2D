import {
  defaultWindowLayout,
  resolveWindowPosition,
  restoreStoredLayout,
  resolveWindowSize,
  shouldUseMobileDefault,
  type HudWindowSpec,
} from "./HudWindowLayout.js";
import { buildHudWindow, type HudWindowRecord } from "./HudWindowRecord.js";
import type { HudWindowLayout } from "./hudWindowStorage.js";

export interface RenderedHudWindowGeometryRequest {
  readonly element: HTMLElement;
  readonly requestedSize: { readonly width: number; readonly height: number };
  readonly layout: HudWindowLayout;
  readonly viewport: { readonly width: number; readonly height: number };
}

export function resolveRenderedHudWindowGeometry(
  request: RenderedHudWindowGeometryRequest,
): { size: { width: number; height: number }; position: { x: number; y: number } } {
  const { element, requestedSize, layout, viewport } = request;
  const size = measuredWindowSize(element, requestedSize);
  return { size, position: resolveWindowPosition(layout, size, viewport) };
}

function measuredWindowSize(
  element: HTMLElement,
  fallback: { readonly width: number; readonly height: number },
): { width: number; height: number } {
  const bounds = element.getBoundingClientRect();
  return {
    width: bounds.width > 0 ? Math.ceil(bounds.width) : fallback.width,
    height: bounds.height > 0 ? Math.ceil(bounds.height) : fallback.height,
  };
}

export interface BuildHudWindowRequest {
  spec: HudWindowSpec;
  mobile: boolean;
  stored: HudWindowLayout | undefined;
  z: number;
  viewport: { width: number; height: number };
  scale: number;
}

export const resolveManagedHudWindowLayout = ({
  spec,
  mobile,
  stored,
  z,
  viewport,
  scale,
}: BuildHudWindowRequest): HudWindowLayout => {
  const effective = effectiveSpec(spec, mobile);
  const visible = spec.defaultVisible ?? true;
  const defaults = defaultWindowLayout({ spec: effective, visible, z, viewport, scale });
  const desktopDefaults = defaultWindowLayout({ spec, visible, z, viewport });
  const layout = shouldUseMobileDefault({ mobile, spec, stored, desktopDefaults })
    ? defaults
    : stored ? restoreStoredLayout(stored, defaults) : defaults;
  return clampLayoutToSpec(layout, effective, viewport);
};

export const buildManagedHudWindow = (
  request: BuildHudWindowRequest,
): HudWindowRecord => {
  const { spec, mobile } = request;
  return {
    ...buildHudWindow(effectiveSpec(spec, mobile)),
    id: spec.id,
    title: spec.title,
    layout: resolveManagedHudWindowLayout(request),
    interactive: Boolean(spec.interactive),
    ...(spec.aspectRatio ? { aspectRatio: spec.aspectRatio } : {}),
    ...(spec.minWidth ? { minWidth: spec.minWidth } : {}),
    ...(spec.minHeight ? { minHeight: spec.minHeight } : {}),
  };
};

const effectiveSpec = (
  spec: HudWindowSpec,
  mobile: boolean,
): HudWindowSpec => mobile && spec.mobile ? { ...spec, ...spec.mobile } : spec;

function clampLayoutToSpec(
  layout: HudWindowLayout,
  spec: HudWindowSpec,
  viewport: { width: number; height: number },
): HudWindowLayout {
  const size = resolveWindowSize(layout, viewport, spec);
  return {
    ...layout,
    xRatio: clampRatio(layout.xRatio),
    yRatio: clampRatio(layout.yRatio),
    widthRatio: size.width / Math.max(1, viewport.width),
    heightRatio: size.height / Math.max(1, viewport.height),
  };
}

const clampRatio = (value: number): number => Math.min(1, Math.max(0, value));

export const applyHudWindowChrome = (record: HudWindowRecord, editing: boolean): void => {
  const style = chromeStyle(editing, record.interactive);
  record.element.style.resize = "none";
  record.element.style.pointerEvents = "auto";
  Object.assign(record.element.style, style);
};

const chromeStyle = (editing: boolean, interactive: boolean): Partial<CSSStyleDeclaration> => {
  if (editing) return { outline: "1px solid rgba(112,118,148,.9)", background: "rgba(17,18,29,.22)", boxShadow: "0 10px 24px rgba(0,0,0,.28)", touchAction: "none" };
  return { outline: "none", background: "transparent", boxShadow: "none", touchAction: interactive ? "auto" : "manipulation" };
};
