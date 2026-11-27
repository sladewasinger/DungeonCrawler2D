/** Persistent client preferences for FPS/ping overlays, camera zoom, mobile auto-aim, quality, and hitboxes. */
import type { QualityPresetId } from "@dc2d/content";
import { z } from "zod";
import { BASE_CAMERA_ZOOM, sanitizeCameraZoom } from "./cameraZoom.js";

const StoredSettingsSchema = z.object({
  showFps: z.boolean().optional(),
  showPing: z.boolean().optional(),
  cameraZoom: z.number().finite().optional(),
  autoAim: z.boolean().optional(),
  showHitboxes: z.boolean().optional(),
  crouchMode: z.enum(["toggle", "hold"]).optional(),
  quality: z.enum(["high", "balanced", "performance"]).optional(),
});

export interface SettingsPrefs {
  readonly showFps: boolean;
  readonly showPing: boolean;
  readonly cameraZoom: number;
  readonly autoAim: boolean;
  readonly showHitboxes: boolean;
  readonly crouchMode: "toggle" | "hold";
  readonly quality: QualityPresetId;
}

const STORAGE_KEY = "dc2d_settings_prefs_v1";

export function isLocalDebugOrigin(hostname = typeof window === "undefined" ? "" : window.location.hostname): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isCoarseMobileDefault(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.matchMedia?.("(hover: none), (pointer: coarse), (max-width: 900px)")?.matches,
  );
}

export function defaultQualityPreset(): QualityPresetId {
  return isCoarseMobileDefault() ? "balanced" : "high";
}

function sanitizeQuality(raw: unknown, fallback: QualityPresetId): QualityPresetId {
  return raw === "high" || raw === "balanced" || raw === "performance" ? raw : fallback;
}

function applyParsedSettings(
  parsed: z.infer<typeof StoredSettingsSchema>,
  defaults: SettingsPrefs,
): SettingsPrefs {
  return {
    showFps: parsed.showFps ?? defaults.showFps,
    showPing: parsed.showPing ?? defaults.showPing,
    cameraZoom: sanitizeCameraZoom(parsed.cameraZoom),
    autoAim: parsed.autoAim ?? defaults.autoAim,
    showHitboxes: parsed.showHitboxes ?? defaults.showHitboxes,
    crouchMode: parsed.crouchMode ?? defaults.crouchMode,
    quality: sanitizeQuality(parsed.quality, defaults.quality),
  };
}

export function loadSettingsPrefs(): SettingsPrefs {
  const defaultMetric = !isCoarseMobileDefault();
  const defQuality = defaultQualityPreset();
  const defaults: SettingsPrefs = {
    showFps: defaultMetric, showPing: defaultMetric, cameraZoom: BASE_CAMERA_ZOOM,
    autoAim: true, showHitboxes: false, crouchMode: "toggle", quality: defQuality,
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length > 2048) return defaults;
    const res = StoredSettingsSchema.safeParse(JSON.parse(raw));
    return res.success ? applyParsedSettings(res.data, defaults) : defaults;
  } catch {
    return defaults;
  }
}

export function saveSettingsPrefs(prefs: SettingsPrefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota or private browsing errors.
  }
}