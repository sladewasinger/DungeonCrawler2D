/** Preloads pixel-art PNG sprites and sliced spritesheet animations from sprite-manifest.json. */
import { Assets, Rectangle, Texture } from "pixi.js";

export type SpriteDirection = "south" | "side" | "north";
export type SpriteAnimState = "idle" | "walk" | "attack" | "corpse";

export interface SpriteAnimClipSpec {
  readonly fps: number;
  readonly frames: readonly (readonly [col: number, row: number])[];
}

export interface SpriteSheetAnimSpec {
  readonly sheetPath: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly clips: Partial<Record<SpriteAnimState, Partial<Record<SpriteDirection, SpriteAnimClipSpec>>>>;
}

export interface SpriteManifestEntry {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly contentWidth?: number;
  readonly contentHeight?: number;
  readonly scale: number;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly animations?: SpriteSheetAnimSpec | undefined;
}

export interface LoadedSpriteClip {
  readonly fps: number;
  readonly frames: readonly Texture[];
}

export interface LoadedSpriteAnimations {
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly clips: Partial<Record<SpriteAnimState, Partial<Record<SpriteDirection, LoadedSpriteClip>>>>;
}

export interface LoadedSpriteAsset extends SpriteManifestEntry {
  readonly id: string;
  readonly texture: Texture;
  readonly loadedAnimations?: LoadedSpriteAnimations | undefined;
}

interface ManifestFile {
  readonly tilePx: number;
  readonly assets: Readonly<Record<string, SpriteManifestEntry>>;
}

const MANIFEST_URL = "/assets/sprite-manifest.json";
const registry = new Map<string, LoadedSpriteAsset>();
let inflightLoad: Promise<void> | null = null;
let loadedOnce = false;

function sliceDirectionClips(
  sheet: Texture,
  spec: SpriteSheetAnimSpec,
  dirClips: Partial<Record<SpriteDirection, SpriteAnimClipSpec>>,
): Partial<Record<SpriteDirection, LoadedSpriteClip>> {
  const out: Partial<Record<SpriteDirection, LoadedSpriteClip>> = {};
  const { frameWidth: fw, frameHeight: fh } = spec;
  for (const [dir, clip] of Object.entries(dirClips) as [SpriteDirection, SpriteAnimClipSpec][]) {
    const frames = clip.frames.map(
      ([col, row]) => new Texture({ source: sheet.source, frame: new Rectangle(col * fw, row * fh, fw, fh) }),
    );
    out[dir] = { fps: clip.fps, frames };
  }
  return out;
}

async function loadSheetAnimations(spec: SpriteSheetAnimSpec): Promise<LoadedSpriteAnimations> {
  const sheet = await Assets.load<Texture>(spec.sheetPath);
  sheet.source.scaleMode = "nearest";
  sheet.source.update();
  const clips: LoadedSpriteAnimations["clips"] = {};
  for (const [state, dirClips] of Object.entries(spec.clips) as [
    SpriteAnimState,
    Partial<Record<SpriteDirection, SpriteAnimClipSpec>>,
  ][]) {
    clips[state] = sliceDirectionClips(sheet, spec, dirClips);
  }
  return { frameWidth: spec.frameWidth, frameHeight: spec.frameHeight, clips };
}

async function loadManifestEntry(id: string, entry: SpriteManifestEntry): Promise<void> {
  const texture = await Assets.load<Texture>(entry.path);
  texture.source.scaleMode = "nearest";
  texture.source.update();
  const loadedAnimations = entry.animations ? await loadSheetAnimations(entry.animations) : undefined;
  registry.set(id, { ...entry, id, texture, loadedAnimations });
}

async function fetchAndLoadManifest(): Promise<void> {
  if (typeof fetch !== "function") return;
  try {
    const res = await fetch(MANIFEST_URL);
    if (!res.ok) return;
    const data = (await res.json()) as ManifestFile;
    const entries = Object.entries(data.assets ?? {});
    await Promise.all(entries.map(([id, entry]) => loadManifestEntry(id, entry)));
    loadedOnce = registry.size > 0;
  } catch (err) {
    console.warn("Sprite manifest preload skipped:", err);
  }
}

export function preloadSpriteManifest(): Promise<void> {
  if (loadedOnce) return Promise.resolve();
  inflightLoad ??= fetchAndLoadManifest().finally(() => { inflightLoad = null; });
  return inflightLoad;
}

export function getLoadedSpriteAsset(id: string): LoadedSpriteAsset | null {
  return registry.get(id) ?? null;
}

export function isSpriteManifestLoaded(): boolean {
  return loadedOnce;
}

export function getLoadedSpriteIds(): readonly string[] {
  return [...registry.keys()];
}
