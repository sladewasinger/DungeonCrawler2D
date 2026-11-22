/** Preloads artist-ready 64x64 pixel-art PNG sprites with nearest-neighbor scaling from sprite-manifest.json. */
import { Assets, Texture } from "pixi.js";

export interface SpriteManifestEntry {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly anchorX: number;
  readonly anchorY: number;
}

export interface LoadedSpriteAsset extends SpriteManifestEntry {
  readonly id: string;
  readonly texture: Texture;
}

interface ManifestFile {
  readonly tilePx: number;
  readonly assets: Readonly<Record<string, SpriteManifestEntry>>;
}

const MANIFEST_URL = "/assets/sprite-manifest.json";
const registry = new Map<string, LoadedSpriteAsset>();
let inflightLoad: Promise<void> | null = null;
let loadedOnce = false;

async function loadManifestEntry(id: string, entry: SpriteManifestEntry): Promise<void> {
  const texture = await Assets.load<Texture>(entry.path);
  texture.source.scaleMode = "nearest";
  texture.source.update();
  registry.set(id, { ...entry, id, texture });
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
