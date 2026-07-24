/** Persists and applies renderer-neutral local accessibility presentation settings. */

const STORAGE_KEY = "dc2d-local-presentation";
const SCHEMA_VERSION = 1;

export const MIN_BRIGHTNESS = 0.6;
export const MAX_BRIGHTNESS = 1.4;
export const MIN_FONT_SCALE = 0.8;
export const MAX_FONT_SCALE = 1.4;

export interface LocalPresentation {
  schemaVersion: 1;
  brightness: number;
  fontScale: number;
}

export const DEFAULT_LOCAL_PRESENTATION: LocalPresentation = {
  schemaVersion: SCHEMA_VERSION,
  brightness: 1,
  fontScale: 1,
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const finite = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const parseLocalPresentation = (value: unknown): LocalPresentation => {
  if (!value || typeof value !== "object") return { ...DEFAULT_LOCAL_PRESENTATION };
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== SCHEMA_VERSION) return { ...DEFAULT_LOCAL_PRESENTATION };
  return {
    schemaVersion: SCHEMA_VERSION,
    brightness: clamp(
      finite(record.brightness, DEFAULT_LOCAL_PRESENTATION.brightness),
      MIN_BRIGHTNESS,
      MAX_BRIGHTNESS,
    ),
    fontScale: clamp(
      finite(record.fontScale, DEFAULT_LOCAL_PRESENTATION.fontScale),
      MIN_FONT_SCALE,
      MAX_FONT_SCALE,
    ),
  };
};

export const loadLocalPresentation = (): LocalPresentation => {
  if (typeof globalThis.localStorage === "undefined") return { ...DEFAULT_LOCAL_PRESENTATION };
  try {
    return parseLocalPresentation(JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return { ...DEFAULT_LOCAL_PRESENTATION };
  }
};

const saveLocalPresentation = (value: LocalPresentation): void => {
  if (typeof globalThis.localStorage === "undefined") return;
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Browsing remains playable when storage is unavailable or full.
  }
};

const scaleInlineFont = (element: HTMLElement): void => {
  if (element.dataset.dc2dFontSize) return;
  const inlineSize = element.style.fontSize;
  const match = /^([0-9.]+)px$/.exec(inlineSize);
  if (!match) return;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return;
  element.dataset.dc2dFontSize = inlineSize;
  element.style.fontSize = `calc(${base}px * var(--dc2d-font-scale, 1))`;
};

const scaleInlineFonts = (root: HTMLElement): void => {
  scaleInlineFont(root);
  root.querySelectorAll<HTMLElement>("*").forEach(scaleInlineFont);
};

export class LocalPresentationController {
  private value = loadLocalPresentation();
  private readonly observer: MutationObserver | null;

  constructor(
    private readonly appRoot: HTMLElement,
    private readonly hudRoot: HTMLElement,
  ) {
    scaleInlineFonts(hudRoot);
    this.observer = typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof HTMLElement) scaleInlineFonts(node);
          }
        }
      });
    this.observer?.observe(hudRoot, { childList: true, subtree: true });
    this.apply();
  }

  current(): Readonly<LocalPresentation> {
    return this.value;
  }

  setBrightness(brightness: number): void {
    this.value = parseLocalPresentation({ ...this.value, brightness });
    this.persistAndApply();
  }

  setFontScale(fontScale: number): void {
    this.value = parseLocalPresentation({ ...this.value, fontScale });
    this.persistAndApply();
  }

  dispose(): void {
    this.observer?.disconnect();
  }

  private persistAndApply(): void {
    saveLocalPresentation(this.value);
    this.apply();
  }

  private apply(): void {
    this.hudRoot.style.setProperty("--dc2d-font-scale", String(this.value.fontScale));
    const canvas = this.appRoot.querySelector("canvas");
    if (canvas instanceof HTMLCanvasElement) {
      canvas.style.filter = `brightness(${this.value.brightness})`;
    }
  }
}
