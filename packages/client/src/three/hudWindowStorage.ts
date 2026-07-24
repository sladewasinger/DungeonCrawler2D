/** Owns browser persistence and validation for HUD window layouts. */
import type { HudAnchor } from "./HudWindows.js";

const STORAGE_KEY = "dc2d.three.hud.windows.v2";

export interface HudWindowLayout {
  anchor: HudAnchor;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  visible?: boolean;
}

interface PersistedWindows {
  version: 2;
  windows: Record<string, HudWindowLayout>;
}

const isLayout = (value: unknown): value is HudWindowLayout => {
  if (typeof value !== "object" || value === null) return false;
  const layout = value as Record<string, unknown>;
  const baseValid = ["anchor", "x", "y", "width", "height", "z"]
    .every((key) => typeof layout[key] === (key === "anchor" ? "string" : "number"));
  return baseValid && (layout.visible === undefined || typeof layout.visible === "boolean");
};

export const loadWindowLayouts = (): Record<string, HudWindowLayout> => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedWindows>;
    if (parsed.version !== 2 || typeof parsed.windows !== "object" || parsed.windows === null) return {};
    return Object.fromEntries(
      Object.entries(parsed.windows)
        .filter((entry): entry is [string, HudWindowLayout] => isLayout(entry[1])),
    );
  } catch {
    return {};
  }
};

export const saveWindowLayouts = (windows: Record<string, HudWindowLayout>): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, windows } satisfies PersistedWindows));
};
