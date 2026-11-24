/** Async loader, bounded LRU image cache, pre-sliced portrait cells, 8-dir 3D bow overlay, and socket samplers. */
import { Rectangle, Texture } from "pixi.js";
import { createPixelCanvas } from "../textures/pixelCanvas.js";
import type { FacingDir } from "./characterTypes.js";

export type AssetProgressCallback = (loaded: number, total: number) => void;

export interface ShoulderSocket {
  readonly x: number;
  readonly y: number;
  readonly behind: boolean;
}

export interface FrameSockets {
  readonly left: ShoulderSocket;
  readonly right: ShoulderSocket;
}

export interface HandSocket {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly behind: boolean;
}

export interface FrameHandSockets {
  readonly left: HandSocket;
  readonly right: HandSocket;
}

export interface PlayerClipLayout {
  readonly startRow: number;
  readonly frames: number;
  readonly fps: number;
}

export interface PlayerRigMeta {
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly cols: number;
  readonly rows: number;
  readonly groundY: number;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly scale: number;
  readonly portraitRow: number;
  readonly portraitCol: number;
  readonly directions: readonly FacingDir[];
  readonly clips: Readonly<Record<string, PlayerClipLayout>>;
  readonly layers: readonly string[];
  readonly bowOverlay?: { readonly path: string; readonly cols: number; readonly rows: number; readonly frameWidth: number; readonly frameHeight: number } | undefined;
  readonly bakeVersion?: number | undefined;
  readonly sockets: Readonly<
    Record<"male" | "female", Readonly<Record<string, Readonly<Record<FacingDir, readonly FrameSockets[]>>>>>
  >;
  readonly handSockets?: Readonly<
    Record<"male" | "female", Readonly<Record<string, Readonly<Record<FacingDir, readonly FrameHandSockets[]>>>>>
  >;
}

const RIG_META_URL = "/assets/player/player-rig.json";
const MAX_CACHED_LAYER_IMAGES = 64;

let rigMeta: PlayerRigMeta | null = null;
let rigBakeVersion = 0;
let maxCachedLayers = MAX_CACHED_LAYER_IMAGES;
const layerImages = new Map<string, HTMLImageElement>();
const portraitLayerCanvases = new Map<string, HTMLCanvasElement>();
const inflightLayers = new Map<string, Promise<HTMLImageElement | null>>();
let bowOverlayFrames: readonly (readonly Texture[])[] | null = null;
let inflightPreload: Promise<void> | null = null;
let loadedReady = false;
const progressListeners = new Set<AssetProgressCallback>();
let lastProgress = { loaded: 0, total: 0 };

function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (typeof Image === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function storeLayerLru(id: string, img: HTMLImageElement): void {
  layerImages.delete(id);
  layerImages.set(id, img);
  while (layerImages.size > maxCachedLayers) {
    const oldest = layerImages.keys().next().value;
    if (oldest !== undefined) layerImages.delete(oldest);
  }
}

function prebakePortraitLayer(id: string, img: HTMLImageElement, meta: PlayerRigMeta): void {
  if (typeof document === "undefined") return;
  const fw = meta.frameWidth;
  const fh = meta.frameHeight;
  const { canvas, ctx } = createPixelCanvas(fw, fh);
  ctx.drawImage(img, meta.portraitCol * fw, meta.portraitRow * fh, fw, fh, 0, 0, fw, fh);
  portraitLayerCanvases.set(id, canvas);
}

function loadSingleLayer(id: string, metaOverride?: PlayerRigMeta): Promise<HTMLImageElement | null> {
  const existing = layerImages.get(id);
  const meta = metaOverride ?? rigMeta;
  if (existing) {
    storeLayerLru(id, existing);
    if (meta && !portraitLayerCanvases.has(id)) prebakePortraitLayer(id, existing, meta);
    return Promise.resolve(existing);
  }
  const inflight = inflightLayers.get(id);
  if (inflight) return inflight;
  const p = loadImage(`/assets/player/${id}.webp${rigBakeVersion ? `?v=${rigBakeVersion}` : ""}`).then((img) => {
    inflightLayers.delete(id);
    if (img) {
      storeLayerLru(id, img);
      const activeMeta = metaOverride ?? rigMeta;
      if (activeMeta) prebakePortraitLayer(id, img, activeMeta);
    }
    return img;
  });
  inflightLayers.set(id, p);
  return p;
}

function emitPlayerProgress(loaded: number, total: number): void {
  lastProgress = { loaded, total };
  for (const listener of progressListeners) listener(loaded, total);
}

function sliceBowOverlayFrames(img: HTMLImageElement, overlay: NonNullable<PlayerRigMeta["bowOverlay"]>): Texture[][] {
  const source = Texture.from({ resource: img, scaleMode: "nearest" }).source;
  return Array.from({ length: overlay.rows }, (_, r) =>
    Array.from({ length: overlay.cols }, (__, c) => new Texture({
      source, frame: new Rectangle(c * overlay.frameWidth, r * overlay.frameHeight, overlay.frameWidth, overlay.frameHeight),
    })),
  );
}

async function fetchBowOverlay(meta: PlayerRigMeta): Promise<void> {
  if (!meta.bowOverlay) return;
  const vSuffix = rigBakeVersion ? `?v=${rigBakeVersion}` : "";
  const img = await loadImage(`${meta.bowOverlay.path}${vSuffix}`);
  if (img) bowOverlayFrames = sliceBowOverlayFrames(img, meta.bowOverlay);
}

async function fetchAllPlayerAssets(meta: PlayerRigMeta): Promise<boolean> {
  const total = meta.layers.length + (meta.bowOverlay ? 1 : 0);
  let done = 0;
  emitPlayerProgress(0, total);
  const bump = (): void => emitPlayerProgress(++done, total);
  const layerPromises = meta.layers.map(async (id) => {
    const img = await loadSingleLayer(id, meta);
    bump();
    return img;
  });
  const bowPromise = fetchBowOverlay(meta).then(() => { if (meta.bowOverlay) bump(); });
  const [loaded] = await Promise.all([Promise.all(layerPromises), bowPromise]);
  return !loaded.some((img) => img === null);
}

async function fetchPlayerAssets(): Promise<void> {
  if (typeof fetch !== "function" || typeof Image === "undefined") return;
  try {
    const res = await fetch(RIG_META_URL, { cache: "no-cache" });
    if (!res.ok) return;
    const meta = (await res.json()) as PlayerRigMeta;
    rigBakeVersion = meta.bakeVersion ?? 0;
    maxCachedLayers = Math.max(MAX_CACHED_LAYER_IMAGES, meta.layers.length + 16);
    if (!(await fetchAllPlayerAssets(meta))) return;
    rigMeta = meta;
    loadedReady = true;
  } catch (err) {
    console.warn("Player 3D layer preload skipped:", err);
  }
}

export function getBowOverlayTexture(dir: FacingDir, frameIdx: number): Texture | null {
  if (!rigMeta || !bowOverlayFrames) return null;
  const row = bowOverlayFrames[Math.max(0, rigMeta.directions.indexOf(dir))];
  if (!row?.length) return null;
  return row[Math.max(0, Math.min(row.length - 1, frameIdx))] ?? null;
}

export function preloadPlayerAssets(onProgress?: AssetProgressCallback): Promise<void> {
  if (loadedReady) {
    if (onProgress && lastProgress.total > 0) onProgress(lastProgress.total, lastProgress.total);
    return Promise.resolve();
  }
  if (onProgress) {
    progressListeners.add(onProgress);
    if (lastProgress.total > 0) onProgress(lastProgress.loaded, lastProgress.total);
  }
  inflightPreload ??= fetchPlayerAssets().finally(() => {
    inflightPreload = null;
    progressListeners.clear();
  });
  return inflightPreload;
}

export function ensurePlayerLayersLoaded(layerIds: readonly string[], onReady: () => void): void {
  if (!rigMeta) return;
  const allowed = new Set(rigMeta.layers);
  const missing = layerIds.filter((id) => !layerImages.has(id) && allowed.has(id));
  if (missing.length === 0) return;
  void Promise.all(missing.map((id) => loadSingleLayer(id))).then((imgs) => {
    if (imgs.some(Boolean)) onReady();
  });
}

export function isPlayer3dReady(): boolean {
  return loadedReady && rigMeta !== null;
}

export function getPlayerRigMeta(): PlayerRigMeta | null {
  return rigMeta;
}

export function getPlayerLayerImage(layerId: string): HTMLImageElement | null {
  const img = layerImages.get(layerId) ?? null;
  if (img) storeLayerLru(layerId, img);
  return img;
}

export function getPlayerPortraitLayer(layerId: string): HTMLCanvasElement | null {
  return portraitLayerCanvases.get(layerId) ?? null;
}

function mirrorSocket(s: ShoulderSocket): ShoulderSocket {
  return { x: -s.x, y: s.y, behind: s.behind };
}

function mirrorHandSocket(h: HandSocket): HandSocket {
  return {
    x: -h.x, y: h.y,
    angle: Math.atan2(Math.sin(h.angle), -Math.cos(h.angle)),
    behind: h.behind,
  };
}

type BodyTrackMap<T> = Readonly<Record<"male" | "female", Readonly<Record<string, Readonly<Record<FacingDir, readonly T[]>>>>>>;

function pickTrackFrame<T>(
  byBody: BodyTrackMap<T> | undefined,
  opts: { readonly body: "male" | "female"; readonly clip: string; readonly dir: FacingDir; readonly frameIdx: number },
): T | null {
  const frames = byBody?.[opts.body]?.[opts.clip]?.[opts.dir];
  if (!frames?.length) return null;
  return frames[opts.frameIdx % frames.length] ?? null;
}

export function sampleShoulderSockets(opts: {
  readonly body: "male" | "female"; readonly clip: string; readonly dir: FacingDir;
  readonly frameIdx: number; readonly flipX: boolean;
}): FrameSockets | null {
  const raw = pickTrackFrame(rigMeta?.sockets, opts);
  if (!raw) return null;
  return opts.flipX ? { left: mirrorSocket(raw.right), right: mirrorSocket(raw.left) } : raw;
}

export function sampleHandSockets(opts: {
  readonly body: "male" | "female"; readonly clip: string; readonly dir: FacingDir;
  readonly frameIdx: number; readonly flipX: boolean;
}): FrameHandSockets | null {
  const raw = pickTrackFrame(rigMeta?.handSockets, opts);
  if (!raw) return null;
  return opts.flipX ? { left: mirrorHandSocket(raw.right), right: mirrorHandSocket(raw.left) } : raw;
}
