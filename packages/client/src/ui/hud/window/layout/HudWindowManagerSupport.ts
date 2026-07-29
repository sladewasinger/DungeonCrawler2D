import {
  defaultWindowLayout,
  restoreStoredLayout,
  shouldUseMobileDefault,
  type HudWindowSpec,
} from "./HudWindowLayout.js";
import { buildHudWindow, type HudWindowRecord } from "./HudWindowRecord.js";
import type { HudWindowLayout } from "./hudWindowStorage.js";

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
  return shouldUseMobileDefault({ mobile, spec, stored, desktopDefaults })
    ? defaults
    : stored ? restoreStoredLayout(stored, defaults) : defaults;
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
  };
};

const effectiveSpec = (
  spec: HudWindowSpec,
  mobile: boolean,
): HudWindowSpec => mobile && spec.mobile ? { ...spec, ...spec.mobile } : spec;

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
