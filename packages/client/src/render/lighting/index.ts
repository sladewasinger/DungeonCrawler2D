// Lighting facade: the small dynamic layer over the BAKED tile lighting — a
// colored halo pool (torch flames, portals, the personal cue) plus accent
// lights for live effects, and camera post-FX. Ambient darkness lives in the
// baked tile tints now; there is no screen darkness overlay to maintain.
import { CHUNK_SIZE, type World } from "@dc2d/engine";
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { viewChunkWorldOrigin } from "../terrain/viewWorld.js";
import { chunkKey, desiredChunks, diffChunks, type ChunkCoord, type ViewRect } from "../terrain/streaming.js";
import { getViewOrientation } from "../view/viewState.js";
import { viewToWorld } from "../view/viewTransform.js";
import { doorLightPositions } from "./doorLights.js";
import { hashSeed, type LightSource } from "./lightSource.js";
import { LightSpritePool } from "./pool.js";
import { TORCH_COLOR, TORCH_RADIUS_TILES } from "./torchLightStyle.js";
import { selectTorchPositions, torchCandidates, type TilePos } from "./torchPlacement.js";

const LOAD_MARGIN_CHUNKS = 1;
/** Hard cap on lights composited per frame — nearest win; the personal light always survives. */
/** Wide viewports show more than 12 torches, so at 12 the nearest-N set churns
 * MID-SCREEN as the camera moves — torches visibly blink in (user playtest
 * 2026-07-20). 24 pushes the swap boundary past the visible edge in practice. */
const MAX_ACTIVE_LIGHTS = 24;
const PORTAL_COLOR = 0x3dd6c3;
const PORTAL_RADIUS_TILES = 3;
const PERSONAL_COLOR = 0xfff0d2;
const PERSONAL_RADIUS_TILES = 1.6; // deliberately small: a soft cue, not a headlight

export class LightingSystem {
  private readonly pool: LightSpritePool;
  private readonly chunkLights = new Map<string, LightSource[]>();
  private accentLights: readonly LightSource[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly world: World,
  ) {
    this.pool = new LightSpritePool(scene);
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
      // GROUND-anchored (section 5): the halo sits on the shifted ground beneath the
      // player, coinciding with their own absolute-z lift once grounded.
      groundHeight: this.world.groundAt(personalX, personalY),
    };
    // Cap anchors to what the CAMERA sees, never the personal anchor — a scene
    // viewed away from the player (gallery, spectate) must still keep its lights.
    // `view` is the camera's on-screen rect, which is in VIEW-pixel space once
    // worldToScreen routes through the seam — convert its center back to a REAL world
    // tile position before comparing against light.x/y, which stay real-world (torch/
    // door positions are scanned straight off the real world in scanChunk below).
    const centerView = { x: (view.x + view.width / 2) / SCREEN_TILE_PX, y: (view.y + view.height / 2) / SCREEN_TILE_PX };
    const centerWorld = viewToWorld(centerView, getViewOrientation());
    const candidates = [...this.chunkLights.values()].flat().concat(this.accentLights);
    candidates.sort(
      (a, b) =>
        Math.hypot(a.x - centerWorld.x, a.y - centerWorld.y) - Math.hypot(b.x - centerWorld.x, b.y - centerWorld.y),
    );
    const all = candidates.slice(0, MAX_ACTIVE_LIGHTS - 1).concat(personal);
    this.pool.sync(all, nowMs);
  }

  /** Torch positions currently resident (authored wall torches + placed thrown
   * torches, fed in as accent lights) — vfx flame particles key off this list. */
  activeTorches(): readonly LightSource[] {
    return [...this.chunkLights.values()]
      .flat()
      .concat(this.accentLights)
      .filter((l) => l.kind === "torch");
  }

  /** Forces every chunk-scanned light (torch/door) to be re-derived — the lighting
   * sibling of TerrainRenderer.invalidateAll(), fired at the same live-rotation swap
   * instant since scanChunk's chunk footprint is also computed via the seam's
   * orientation-dependent viewChunkWorldOrigin. */
  invalidateAll(): void {
    this.chunkLights.clear();
  }

  private streamChunks(view: ViewRect): void {
    const desired = desiredChunks(view, LOAD_MARGIN_CHUNKS);
    const { toLoad, toUnloadKeys } = diffChunks(desired, new Set(this.chunkLights.keys()));
    for (const coord of toLoad) this.chunkLights.set(chunkKey(coord), this.scanChunk(coord));
    for (const key of toUnloadKeys) this.chunkLights.delete(key);
  }

  private scanChunk(coord: ChunkCoord): LightSource[] {
    // (coord.cx, coord.cy) name a VIEW chunk (same desiredChunks call as terrain's
    // TerrainRenderer, off the camera's view-pixel rect) — torch/door positions are a
    // real-world scan (torchCandidates/doorLightPositions read the real World), so this
    // needs the chunk's real-world footprint, not its view-space one.
    const origin = viewChunkWorldOrigin(coord.cx * CHUNK_SIZE, coord.cy * CHUNK_SIZE, CHUNK_SIZE, getViewOrientation());
    const x0 = origin.x;
    const y0 = origin.y;
    const x1 = x0 + CHUNK_SIZE;
    const y1 = y0 + CHUNK_SIZE;
    const torches = selectTorchPositions(torchCandidates(this.world, x0, y0, x1, y1)).map((p) => this.torchLight(p));
    const doors = doorLightPositions(this.world, x0, y0, x1, y1).map((p) => this.doorLight(p));
    return [...torches, ...doors];
  }

  private torchLight(p: TilePos): LightSource {
    const id = `torch:${p.wx},${p.wy}`;
    // groundAt(tile) — section 5: a torch on a platform glows on the platform.
    const groundHeight = this.world.groundAt(p.wx + 0.5, p.wy + 0.5);
    return { id, x: p.wx + 0.5, y: p.wy + 1.1, color: TORCH_COLOR, radiusTiles: TORCH_RADIUS_TILES, kind: "torch", seed: hashSeed(id), groundHeight };
  }

  private doorLight(p: TilePos): LightSource {
    const id = `door:${p.wx},${p.wy}`;
    const groundHeight = this.world.groundAt(p.wx + 0.5, p.wy + 0.5);
    return { id, x: p.wx + 0.5, y: p.wy + 0.5, color: PORTAL_COLOR, radiusTiles: PORTAL_RADIUS_TILES, kind: "portal", seed: hashSeed(id), groundHeight };
  }

  dispose(): void {
    this.pool.dispose();
  }
}

export type { LightKind, LightSource } from "./lightSource.js";
