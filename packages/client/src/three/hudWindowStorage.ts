/* eslint-disable max-lines -- versioned layout migrations are one persistence boundary. */
/** Owns browser persistence and validation for HUD window layouts. */
import type { HudAnchor } from "./HudWindowLayout.js";

const STORAGE_KEY = "dc2d.three.hud.windows.v4";
const LEGACY_STORAGE_KEY = "dc2d.three.hud.windows.v3";
const LEGACY_POSITION_STORAGE_KEY = "dc2d.three.hud.windows.v2";
const anchors = new Set<HudAnchor>([
  "top-left", "top-center", "top-right",
  "center-left", "center", "center-right",
  "bottom-left", "bottom-center", "bottom-right", "free",
]);

export interface HudWindowLayout {
  anchor: HudAnchor;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
  z: number;
  visible?: boolean;
}

interface PersistedWindows {
  version: 4;
  windows: Record<string, HudWindowLayout>;
}

interface LegacySizedHudWindowLayout {
  anchor: HudAnchor;
  xRatio: number;
  yRatio: number;
  width: number;
  height: number;
  z: number;
  visible?: boolean;
}

interface LegacyHudWindowLayout {
  anchor: HudAnchor;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  visible?: boolean;
}

interface LegacySizedPersistedWindows {
  version: 3;
  windows: Record<string, LegacySizedHudWindowLayout>;
}

interface LegacyPersistedWindows {
  version: 2;
  windows: Record<string, LegacyHudWindowLayout>;
}

export interface HudViewport {
  width: number;
  height: number;
  /** Logical-to-physical HUD scale used by the legacy pixel layout. */
  scale?: number;
}

const ratio = (position: number, available: number): number =>
  Math.min(1, Math.max(0, position / Math.max(1, available)));

const sizeRatio = (size: number, available: number, scale: number): number =>
  ratio(size * scale, available);

const isLayout = (value: unknown): value is HudWindowLayout => {
  if (typeof value !== "object" || value === null) return false;
  const layout = value as Record<string, unknown>;
  const baseValid = ["anchor", "xRatio", "yRatio", "widthRatio", "heightRatio", "z"]
    .every((key) => typeof layout[key] === (key === "anchor" ? "string" : "number"));
  return baseValid &&
    anchors.has(layout.anchor as HudAnchor) &&
    (layout.visible === undefined || typeof layout.visible === "boolean");
};

const isLegacySizedLayout = (value: unknown): value is LegacySizedHudWindowLayout => {
  if (typeof value !== "object" || value === null) return false;
  const layout = value as Record<string, unknown>;
  return ["anchor", "xRatio", "yRatio", "width", "height", "z"]
    .every((key) => typeof layout[key] === (key === "anchor" ? "string" : "number")) &&
    anchors.has(layout.anchor as HudAnchor) &&
    (layout.visible === undefined || typeof layout.visible === "boolean");
};

const isLegacyLayout = (value: unknown): value is LegacyHudWindowLayout => {
  if (typeof value !== "object" || value === null) return false;
  const layout = value as Record<string, unknown>;
  return ["anchor", "x", "y", "width", "height", "z"]
    .every((key) => typeof layout[key] === (key === "anchor" ? "string" : "number")) &&
    anchors.has(layout.anchor as HudAnchor) &&
    (layout.visible === undefined || typeof layout.visible === "boolean");
};

export const migrateLegacyWindowLayout = (
  layout: LegacyHudWindowLayout,
  viewport: HudViewport,
): HudWindowLayout => {
  const scale = viewport.scale ?? 1;
  return {
    anchor: layout.anchor,
    xRatio: ratio(layout.x, viewport.width - layout.width * scale),
    yRatio: ratio(layout.y, viewport.height - layout.height * scale),
    widthRatio: sizeRatio(layout.width, viewport.width, scale),
    heightRatio: sizeRatio(layout.height, viewport.height, scale),
    z: layout.z,
    ...(layout.visible === undefined ? {} : { visible: layout.visible }),
  };
};

/** Converts the v3 schema's pixel sizes while preserving its normalized positions. */
export const migrateSizedWindowLayout = (
  layout: LegacySizedHudWindowLayout,
  viewport: HudViewport,
): HudWindowLayout => ({
  anchor: layout.anchor,
  xRatio: layout.xRatio,
  yRatio: layout.yRatio,
  widthRatio: sizeRatio(layout.width, viewport.width, viewport.scale ?? 1),
  heightRatio: sizeRatio(layout.height, viewport.height, viewport.scale ?? 1),
  z: layout.z,
  ...(layout.visible === undefined ? {} : { visible: layout.visible }),
});

const parseLayouts = (raw: string): Record<string, HudWindowLayout> | null => {
  const parsed = JSON.parse(raw) as Partial<PersistedWindows>;
  if (parsed.version !== 4 || typeof parsed.windows !== "object" || parsed.windows === null) return null;
  return Object.fromEntries(
    Object.entries(parsed.windows)
      .filter((entry): entry is [string, HudWindowLayout] => isLayout(entry[1])),
  );
};

const migrateLegacyLayouts = (
  raw: string,
  viewport: HudViewport,
): Record<string, HudWindowLayout> | null => {
  const parsed = JSON.parse(raw) as Partial<LegacyPersistedWindows>;
  if (parsed.version !== 2 || typeof parsed.windows !== "object" || parsed.windows === null) return null;
  return Object.fromEntries(
    Object.entries(parsed.windows)
      .filter((entry): entry is [string, LegacyHudWindowLayout] => isLegacyLayout(entry[1]))
      .map(([id, layout]) => [id, migrateLegacyWindowLayout(layout, viewport)]),
  );
};

const migrateSizedLayouts = (
  raw: string,
  viewport: HudViewport,
): Record<string, HudWindowLayout> | null => {
  const parsed = JSON.parse(raw) as Partial<LegacySizedPersistedWindows>;
  if (parsed.version !== 3 || typeof parsed.windows !== "object" || parsed.windows === null) return null;
  const layouts: Record<string, HudWindowLayout> = {};
  for (const [id, layout] of Object.entries(parsed.windows)) {
    if (isLegacySizedLayout(layout)) layouts[id] = migrateSizedWindowLayout(layout, viewport);
  }
  return layouts;
};

export const loadWindowLayouts = (
  viewport: HudViewport = { width: window.innerWidth, height: window.innerHeight },
): Record<string, HudWindowLayout> => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return parseLayouts(raw) ?? {};
    return loadLegacyWindowLayouts(viewport);
  } catch {
    return {};
  }
};

const loadLegacyWindowLayouts = (viewport: HudViewport): Record<string, HudWindowLayout> => {
  const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy) return persistMigratedLayouts(migrateSizedLayouts(legacy, viewport) ?? {});
  const oldest = window.localStorage.getItem(LEGACY_POSITION_STORAGE_KEY);
  return oldest ? persistMigratedLayouts(migrateLegacyLayouts(oldest, viewport) ?? {}) : {};
};

const persistMigratedLayouts = (layouts: Record<string, HudWindowLayout>): Record<string, HudWindowLayout> => {
  saveWindowLayouts(layouts);
  return layouts;
};

export const saveWindowLayouts = (windows: Record<string, HudWindowLayout>): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 4, windows } satisfies PersistedWindows));
};
