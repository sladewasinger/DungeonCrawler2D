/** Owns browser persistence and validation for HUD window layouts. */
import type { HudAnchor } from "./HudWindowLayout.js";

const STORAGE_KEY = "dc2d.three.hud.windows.v3";
const LEGACY_STORAGE_KEY = "dc2d.three.hud.windows.v2";
const anchors = new Set<HudAnchor>([
  "top-left", "top-center", "top-right",
  "center-left", "center", "center-right",
  "bottom-left", "bottom-center", "bottom-right", "free",
]);

export interface HudWindowLayout {
  anchor: HudAnchor;
  xRatio: number;
  yRatio: number;
  width: number;
  height: number;
  z: number;
  visible?: boolean;
}

interface PersistedWindows {
  version: 3;
  windows: Record<string, HudWindowLayout>;
}

interface LegacyHudWindowLayout extends Omit<HudWindowLayout, "xRatio" | "yRatio"> {
  x: number;
  y: number;
}

interface LegacyPersistedWindows {
  version: 2;
  windows: Record<string, LegacyHudWindowLayout>;
}

export interface HudViewport {
  width: number;
  height: number;
}

const ratio = (position: number, available: number): number =>
  Math.min(1, Math.max(0, position / Math.max(1, available)));

const isLayout = (value: unknown): value is HudWindowLayout => {
  if (typeof value !== "object" || value === null) return false;
  const layout = value as Record<string, unknown>;
  const baseValid = ["anchor", "xRatio", "yRatio", "width", "height", "z"]
    .every((key) => typeof layout[key] === (key === "anchor" ? "string" : "number"));
  return baseValid &&
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
): HudWindowLayout => ({
  anchor: layout.anchor,
  xRatio: ratio(layout.x, viewport.width - layout.width),
  yRatio: ratio(layout.y, viewport.height - layout.height),
  width: layout.width,
  height: layout.height,
  z: layout.z,
  ...(layout.visible === undefined ? {} : { visible: layout.visible }),
});

const parseLayouts = (raw: string): Record<string, HudWindowLayout> | null => {
  const parsed = JSON.parse(raw) as Partial<PersistedWindows>;
  if (parsed.version !== 3 || typeof parsed.windows !== "object" || parsed.windows === null) return null;
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

export const loadWindowLayouts = (
  viewport: HudViewport = { width: window.innerWidth, height: window.innerHeight },
): Record<string, HudWindowLayout> => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return parseLayouts(raw) ?? {};
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return {};
    const migrated = migrateLegacyLayouts(legacy, viewport) ?? {};
    saveWindowLayouts(migrated);
    return migrated;
  } catch {
    return {};
  }
};

export const saveWindowLayouts = (windows: Record<string, HudWindowLayout>): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, windows } satisfies PersistedWindows));
};
