/** Preloads lossless WebP/PNG sprites and sliced spritesheet animations from sprite-manifest.json. */
import { Assets, Rectangle, Texture } from "pixi.js";
import { preloadPlayerAssets, type AssetProgressCallback } from "../character/playerAssets.js";

export interface PreloadManifestOptions {
  readonly includePlayer?: boolean | undefined;
  readonly onProgress?: AssetProgressCallback | undefined;
}

export type SpriteDirection = "south" | "se" | "side" | "ne" | "north";
export type SpriteAnimState = "idle" | "walk" | "run" | "attack" | "corpse";

export interface SpriteAnimClipSpec {
  readonly fps: number;
  readonly frames: readonly (readonly [col: number, row: number])[];
  readonly loopStart?: number | undefined;
  readonly loopEnd?: number | undefined;
}

export interface SpriteSheetAnimSpec {
  readonly sheetPath: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly clips: Partial<Record<SpriteAnimState, Partial<Record<SpriteDirection, SpriteAnimClipSpec>>>>;
}

export interface SpriteManifestEntry {
  readonly path?: string | undefined;
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
  readonly loopStart?: number | undefined;
  readonly loopEnd?: number | undefined;
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
const progressListeners = new Set<AssetProgressCallback>();
let lastProgress = { loaded: 0, total: 0 };

function emitManifestProgress(loaded: number, total: number): void {
  lastProgress = { loaded, total };
  for (const listener of progressListeners) listener(loaded, total);
}

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
    out[dir] = { fps: clip.fps, frames, loopStart: clip.loopStart, loopEnd: clip.loopEnd };
  }
  return out;
}

async function loadSheetAnimations(spec: SpriteSheetAnimSpec, onStep?: () => void): Promise<LoadedSpriteAnimations> {
  const sheet = await Assets.load<Texture>(spec.sheetPath);
  sheet.source.scaleMode = "nearest";
  sheet.source.update();
  onStep?.();
  const clips: LoadedSpriteAnimations["clips"] = {};
  for (const [state, dirClips] of Object.entries(spec.clips) as [
    SpriteAnimState,
    Partial<Record<SpriteDirection, SpriteAnimClipSpec>>,
  ][]) {
    clips[state] = sliceDirectionClips(sheet, spec, dirClips);
  }
  return { frameWidth: spec.frameWidth, frameHeight: spec.frameHeight, clips };
}

function pickFirstAnimationFrame(anims: LoadedSpriteAnimations): Texture | null {
  const idleFirst = anims.clips.idle?.south?.frames[0];
  if (idleFirst) return idleFirst;
  for (const dirClips of Object.values(anims.clips)) {
    const first = Object.values(dirClips ?? {}).find((clip) => Boolean(clip?.frames[0]));
    if (first?.frames[0]) return first.frames[0];
  }
  return null;
}

async function loadManifestEntry(
  id: string,
  entry: SpriteManifestEntry,
  onStep?: () => void,
): Promise<void> {
  if (entry.animations) {
    const loadedAnimations = await loadSheetAnimations(entry.animations, onStep);
    const frame = pickFirstAnimationFrame(loadedAnimations);
    if (!frame) throw new Error(`No animation frames found for manifest asset '${id}'`);
    registry.set(id, { ...entry, id, texture: frame, loadedAnimations });
    return;
  }
  if (!entry.path) throw new Error(`Missing texture path for manifest asset '${id}'`);
  const texture = await Assets.load<Texture>(entry.path);
  texture.source.scaleMode = "nearest";
  texture.source.update();
  onStep?.();
  registry.set(id, { ...entry, id, texture });
}

async function fetchAndLoadManifest(includePlayer: boolean): Promise<void> {
  if (typeof fetch !== "function") return;
  try {
    const res = await fetch(MANIFEST_URL);
    if (!res.ok) return;
    const data = (await res.json()) as ManifestFile;
    const entries = Object.entries(data.assets ?? {});
    const total = entries.length + (includePlayer ? 1 : 0);
    let done = 0;
    emitManifestProgress(0, total);
    const bump = (): void => emitManifestProgress(++done, total);
    const jobs = entries.map(([id, entry]) => loadManifestEntry(id, entry, bump));
    if (includePlayer) jobs.push(preloadPlayerAssets().then(bump));
    await Promise.all(jobs);
    loadedOnce = registry.size > 0;
  } catch (err) {
    console.warn("Sprite manifest preload skipped:", err);
  }
}

function attachProgressListener(cb: AssetProgressCallback | undefined): void {
  if (!cb) return;
  progressListeners.add(cb);
  if (lastProgress.total > 0) cb(lastProgress.loaded, lastProgress.total);
}

export function preloadSpriteManifest(opts?: PreloadManifestOptions): Promise<void> {
  const cb = opts?.onProgress;
  if (loadedOnce) {
    if (cb && lastProgress.total > 0) cb(lastProgress.total, lastProgress.total);
    return Promise.resolve();
  }
  attachProgressListener(cb);
  inflightLoad ??= fetchAndLoadManifest(opts?.includePlayer ?? true).finally(() => {
    inflightLoad = null;
    progressListeners.clear();
  });
  return inflightLoad;
}

export function getLoadedSpriteAsset(id: string): LoadedSpriteAsset | null {
  return registry.get(id) ?? null;
}

export function getLoadedSpriteIds(): readonly string[] {
  return [...registry.keys()];
}
