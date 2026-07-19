// Lighting facade: the small dynamic layer over the BAKED tile lighting — a
// colored halo pool (torch flames, portals, the personal cue) plus accent
// lights for live effects, and camera post-FX. Ambient darkness lives in the
// baked tile tints now; there is no screen darkness overlay to maintain.
import { CHUNK_SIZE, type World } from "@dc2d/engine";
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { chunkKey, desiredChunks, diffChunks, type ChunkCoord, type ViewRect } from "../terrain/streaming.js";
import { doorLightPositions } from "./doorLights.js";
import type { LightSource } from "./lightSource.js";
import { applyLightingPostFX } from "./postfx.js";
import { LightSpritePool } from "./pool.js";
import { selectTorchPositions, torchCandidates, type TilePos } from "./torchPlacement.js";

const LOAD_MARGIN_CHUNKS = 1;
/** Hard cap on lights composited per frame — nearest win; the personal light always survives. */
const MAX_ACTIVE_LIGHTS = 12;
const TORCH_COLOR = 0xff9e3d;
const TORCH_RADIUS_TILES = 1.5; // small halo at the flame — the BAKED tile light does the real work
const PORTAL_COLOR = 0x3dd6c3;
const PORTAL_RADIUS_TILES = 3;
const PERSONAL_COLOR = 0xfff0d2;
const PERSONAL_RADIUS_TILES = 1.6; // deliberately small: a soft cue, not a headlight

/** Small integer hash used only to spread flicker phase — not a determinism-sensitive RNG. */
function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h >>> 0;
}

export class LightingSystem {
  private readonly pool: LightSpritePool;
  private readonly chunkLights = new Map<string, LightSource[]>();
  private accentLights: readonly LightSource[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly world: World,
  ) {
    this.pool = new LightSpritePool(scene);
    applyLightingPostFX(scene.cameras.main);
  }

  /** Extra colored lights the caller owns (area VFX, showcase set-pieces) — replaces the whole set each call. */
  setAccentLights(lights: readonly LightSource[]): void {
    this.accentLights = lights;
  }

  /** Streams chunk-scanned lights around the view, then syncs the halo pool for this frame. */
  update(view: ViewRect, personalX: number, personalY: number, nowMs: number): void {
    this.streamChunks(view);
    const personal: LightSource = {
      id: "personal",
      x: personalX,
      y: personalY,
      color: PERSONAL_COLOR,
      radiusTiles: PERSONAL_RADIUS_TILES,
      kind: "personal",
      seed: 0,
    };
    // Cap anchors to what the CAMERA sees, never the personal anchor — a scene
    // viewed away from the player (gallery, spectate) must still keep its lights.
    const centerTileX = (view.x + view.width / 2) / SCREEN_TILE_PX;
    const centerTileY = (view.y + view.height / 2) / SCREEN_TILE_PX;
    const candidates = [...this.chunkLights.values()].flat().concat(this.accentLights);
    candidates.sort(
      (a, b) =>
        Math.hypot(a.x - centerTileX, a.y - centerTileY) - Math.hypot(b.x - centerTileX, b.y - centerTileY),
    );
    const all = candidates.slice(0, MAX_ACTIVE_LIGHTS - 1).concat(personal);
    this.pool.sync(all, nowMs);
  }

  /** Torch positions currently resident — vfx flame particles key off this list. */
  activeTorches(): readonly LightSource[] {
    return [...this.chunkLights.values()].flat().filter((l) => l.kind === "torch");
  }

  private streamChunks(view: ViewRect): void {
    const desired = desiredChunks(view, LOAD_MARGIN_CHUNKS);
    const { toLoad, toUnloadKeys } = diffChunks(desired, new Set(this.chunkLights.keys()));
    for (const coord of toLoad) this.chunkLights.set(chunkKey(coord), this.scanChunk(coord));
    for (const key of toUnloadKeys) this.chunkLights.delete(key);
  }

  private scanChunk(coord: ChunkCoord): LightSource[] {
    const x0 = coord.cx * CHUNK_SIZE;
    const y0 = coord.cy * CHUNK_SIZE;
    const x1 = x0 + CHUNK_SIZE;
    const y1 = y0 + CHUNK_SIZE;
    const torches = selectTorchPositions(torchCandidates(this.world, x0, y0, x1, y1)).map((p) => this.torchLight(p));
    const doors = doorLightPositions(this.world, x0, y0, x1, y1).map((p) => this.doorLight(p));
    return [...torches, ...doors];
  }

  private torchLight(p: TilePos): LightSource {
    const id = `torch:${p.wx},${p.wy}`;
    return { id, x: p.wx + 0.5, y: p.wy + 1.1, color: TORCH_COLOR, radiusTiles: TORCH_RADIUS_TILES, kind: "torch", seed: hashSeed(id) };
  }

  private doorLight(p: TilePos): LightSource {
    const id = `door:${p.wx},${p.wy}`;
    return { id, x: p.wx + 0.5, y: p.wy + 0.5, color: PORTAL_COLOR, radiusTiles: PORTAL_RADIUS_TILES, kind: "portal", seed: hashSeed(id) };
  }

  dispose(): void {
    this.pool.dispose();
  }
}

export type { LightKind, LightSource } from "./lightSource.js";
