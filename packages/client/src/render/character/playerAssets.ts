/** Async loader, bounded LRU image cache, and 8-dir shoulder/hand-socket samplers for 3D Hero sheets. */
import type { FacingDir } from "./characterTypes.js";

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
  readonly sockets: Readonly<
    Record<"male" | "female", Readonly<Record<string, Readonly<Record<FacingDir, readonly FrameSockets[]>>>>>
  >;
  readonly handSockets?: Readonly<
    Record<"male" | "female", Readonly<Record<string, Readonly<Record<FacingDir, readonly FrameHandSockets[]>>>>>
  >;
}

const RIG_META_URL = "/assets/player/player-rig.json";
const MAX_CACHED_LAYER_IMAGES = 64;
const INITIAL_PRELOAD_CAP = 20;

let rigMeta: PlayerRigMeta | null = null;
const layerImages = new Map<string, HTMLImageElement>();
const inflightLayers = new Map<string, Promise<HTMLImageElement | null>>();
let inflightPreload: Promise<void> | null = null;
let loadedReady = false;

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
  while (layerImages.size > MAX_CACHED_LAYER_IMAGES) {
    const oldest = layerImages.keys().next().value;
    if (oldest !== undefined) layerImages.delete(oldest);
  }
}

function loadSingleLayer(id: string): Promise<HTMLImageElement | null> {
  const existing = layerImages.get(id);
  if (existing) { storeLayerLru(id, existing); return Promise.resolve(existing); }
  const inflight = inflightLayers.get(id);
  if (inflight) return inflight;
  const p = loadImage(`/assets/player/${id}.png`).then((img) => {
    inflightLayers.delete(id);
    if (img) storeLayerLru(id, img);
    return img;
  });
  inflightLayers.set(id, p);
  return p;
}

async function fetchPlayerAssets(): Promise<void> {
  if (typeof fetch !== "function" || typeof Image === "undefined") return;
  try {
    const res = await fetch(RIG_META_URL);
    if (!res.ok) return;
    const meta = (await res.json()) as PlayerRigMeta;
    const bootIds = meta.layers.slice(0, INITIAL_PRELOAD_CAP);
    const loaded = await Promise.all(bootIds.map(async (id) => ({ id, img: await loadSingleLayer(id) })));
    if (loaded.some((entry) => entry.img === null)) return;
    rigMeta = meta;
    loadedReady = true;
  } catch (err) {
    console.warn("Player 3D layer preload skipped:", err);
  }
}

export function preloadPlayerAssets(): Promise<void> {
  if (loadedReady) return Promise.resolve();
  inflightPreload ??= fetchPlayerAssets().finally(() => { inflightPreload = null; });
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
