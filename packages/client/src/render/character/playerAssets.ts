/** Async loader and 8-direction shoulder-socket sampler for baked 3D Hero layer sheets. */
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
}

const RIG_META_URL = "/assets/player/player-rig.json";
let rigMeta: PlayerRigMeta | null = null;
const layerImages = new Map<string, HTMLImageElement>();
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

async function fetchPlayerAssets(): Promise<void> {
  if (typeof fetch !== "function" || typeof Image === "undefined") return;
  try {
    const res = await fetch(RIG_META_URL);
    if (!res.ok) return;
    const meta = (await res.json()) as PlayerRigMeta;
    const loaded = await Promise.all(
      meta.layers.map(async (id) => ({ id, img: await loadImage(`/assets/player/${id}.png`) })),
    );
    if (loaded.some((entry) => entry.img === null)) return;
    for (const entry of loaded) {
      if (entry.img) layerImages.set(entry.id, entry.img);
    }
    rigMeta = meta;
    loadedReady = true;
  } catch (err) {
    console.warn("Player 3D layer preload skipped:", err);
  }
}

export function preloadPlayerAssets(): Promise<void> {
  if (loadedReady) return Promise.resolve();
  inflightPreload ??= fetchPlayerAssets().finally(() => {
    inflightPreload = null;
  });
  return inflightPreload;
}

export function isPlayer3dReady(): boolean {
  return loadedReady && rigMeta !== null;
}

export function getPlayerRigMeta(): PlayerRigMeta | null {
  return rigMeta;
}

export function getPlayerLayerImage(layerId: string): HTMLImageElement | null {
  return layerImages.get(layerId) ?? null;
}

function mirrorSocket(s: ShoulderSocket): ShoulderSocket {
  return { x: -s.x, y: s.y, behind: s.behind };
}

export function sampleShoulderSockets(opts: {
  readonly body: "male" | "female";
  readonly clip: string;
  readonly dir: FacingDir;
  readonly frameIdx: number;
  readonly flipX: boolean;
}): FrameSockets | null {
  if (!rigMeta) return null;
  const frames = rigMeta.sockets[opts.body][opts.clip]?.[opts.dir];
  if (!frames?.length) return null;
  const raw = frames[opts.frameIdx % frames.length];
  if (!raw) return null;
  return opts.flipX ? { left: mirrorSocket(raw.right), right: mirrorSocket(raw.left) } : raw;
}
