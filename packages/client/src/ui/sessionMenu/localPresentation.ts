const STORAGE_KEY = "dc2d-local-presentation";
const SCHEMA_VERSION = 1;
export const MIN_BRIGHTNESS = 0.6, MAX_BRIGHTNESS = 1.4; export const MIN_FONT_SCALE = 0.8, MAX_FONT_SCALE = 1.4;
export interface LocalPresentation {
  schemaVersion: 1;
  brightness: number;
  fontScale: number;
  motion: "system" | "reduce" | "full";
}
export const DEFAULT_LOCAL_PRESENTATION: LocalPresentation = {
  schemaVersion: SCHEMA_VERSION,
  brightness: 1,
  fontScale: 1,
  motion: "system",
};
const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value));
const finite = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const motionPreference = (value: unknown): LocalPresentation["motion"] =>
  value === "reduce" || value === "full" ? value : "system";
export const reducedMotionEnabled = (
  value: Pick<LocalPresentation, "motion">,
  systemPrefersReducedMotion: boolean,
): boolean =>
  value.motion === "reduce" ||
  (value.motion === "system" && systemPrefersReducedMotion);
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
    motion: motionPreference(record.motion),
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
const scaleInlineFonts = (root: HTMLElement): void => { scaleInlineFont(root);
root.querySelectorAll<HTMLElement>("*").forEach(scaleInlineFont);
};
export class LocalPresentationController {
  private value = loadLocalPresentation();
  private readonly observer: MutationObserver | null;
  private readonly pausedAnimations = new Set<Animation>();
  constructor(
    private readonly appRoot: HTMLElement,
    private readonly hudRoot: HTMLElement,
  ) {
    scaleInlineFonts(hudRoot);
    this.observer = typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver((records) => this.handleMutations(records));
    this.observer?.observe(hudRoot, { childList: true, subtree: true });
    this.apply();
  }
  current(): Readonly<LocalPresentation> { return this.value;
}
  setBrightness(brightness: number): void {
    this.value = parseLocalPresentation({ ...this.value, brightness });
    this.persistAndApply();
  }
  setFontScale(fontScale: number): void {
    this.value = parseLocalPresentation({ ...this.value, fontScale });
    this.persistAndApply();
  }
  setMotion(motion: LocalPresentation["motion"]): void {
    this.value = parseLocalPresentation({ ...this.value, motion });
    this.persistAndApply();
  }
  dispose(): void {
    this.observer?.disconnect();
    this.resumePausedAnimations();
  }
  private persistAndApply(): void {
    saveLocalPresentation(this.value);
    this.apply();
  }
  private handleMutations(records: MutationRecord[]): void {
    for (const record of records) this.scaleAddedNodes(record.addedNodes);
    this.applyMotion();
  }
  private scaleAddedNodes(nodes: NodeList): void {
    for (const node of nodes) if (node instanceof HTMLElement) scaleInlineFonts(node);
  }
  private apply(): void {
    this.hudRoot.style.setProperty("--dc2d-font-scale", String(this.value.fontScale));
    const canvas = this.appRoot.querySelector("canvas");
    if (canvas instanceof HTMLCanvasElement) {
      canvas.style.filter = `brightness(${this.value.brightness})`;
    }
    this.applyMotion();
  }
  private applyMotion(): void {
    const systemPrefersReducedMotion =
      typeof globalThis.matchMedia === "function" &&
      globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reduce = reducedMotionEnabled(this.value, systemPrefersReducedMotion);
    this.appRoot.dataset.reducedMotion = String(reduce);
    this.hudRoot.dataset.reducedMotion = String(reduce);
    if (!reduce) {
      this.resumePausedAnimations();
      return;
    }
    for (const animation of this.hudRoot.getAnimations?.({ subtree: true }) ?? []) {
      if (animation.playState !== "running") continue;
      animation.pause();
      this.pausedAnimations.add(animation);
    }
  }
  private resumePausedAnimations(): void {
    for (const animation of this.pausedAnimations) {
      if (animation.playState === "paused") animation.play();
    }
    this.pausedAnimations.clear();
  }
}
