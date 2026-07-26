// Lighting facade: the small dynamic layer over the BAKED tile lighting — a
// colored halo pool (torch flames, portals, the personal cue) plus accent
// lights for live effects, and camera post-FX. Ambient darkness lives in the
// baked tile tints now; there is no screen darkness overlay to maintain.
import { CHUNK_SIZE, type World } from "@dc2d/engine";
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { viewChunkWorldOrigin } from "../terrain/viewWorld.js";
import { chunkKey, chunkWindowKey, desiredChunks, diffChunks, type ChunkCoord, type ViewRect } from "../terrain/streaming.js";
import { getViewOrientation } from "../view/viewState.js";
import { viewToWorld } from "../view/viewTransform.js";
import { doorLightPositions } from "./doorLights.js";
import { collectTorchLights, selectFrameLights } from "./frameLights.js";
import { hashSeed, type LightSource } from "./lightSource.js";
import { LightSpritePool } from "./pool.js";
import { PlayerGroundLightPass } from "./playerGroundLightPool.js";
import { playerGroundLightEnabledForProfile } from "./playerGroundLight.js";
import { readTerrainDeviceSignals, selectTerrainDeviceProfile } from "../terrain/terrainDeviceProfile.js";
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
type MutableLightSource = {
  -readonly [Key in keyof LightSource]: LightSource[Key];
};

export class LightingSystem {
  private readonly pool: LightSpritePool;
  private readonly groundLight: PlayerGroundLightPass;
  private readonly chunkLights = new Map<string, LightSource[]>();
  private streamedWindow = "";
  private accentLights: readonly LightSource[] = [];
  private readonly candidateLights: LightSource[] = [];
  private readonly frameLights: LightSource[] = [];
  private readonly activeTorchLights: LightSource[] = [];
  private readonly personalLight: MutableLightSource = {
    id: "personal",
    x: 0,
    y: 0,
    color: PERSONAL_COLOR,
    radiusTiles: PERSONAL_RADIUS_TILES,
    kind: "personal",
    seed: 0,
    groundHeight: 0,
  };

  constructor(
    scene: Phaser.Scene,
    private readonly world: World,
  ) {
    this.pool = new LightSpritePool(scene);
    this.groundLight = new PlayerGroundLightPass(scene, world);
    const profile = selectTerrainDeviceProfile(readTerrainDeviceSignals(scene));
    this.groundLight.setEnabled(playerGroundLightEnabledForProfile(profile.kind));
  }

  /** Extra colored lights the caller owns (area VFX, showcase set-pieces) — replaces the whole set each call. */
  setAccentLights(lights: readonly LightSource[]): void {
    this.accentLights = lights;
  }

  /** Performance fallback: disabling the bounded floor pass leaves the personal halo intact. */
  setPlayerGroundLightEnabled(enabled: boolean): void {
    this.groundLight.setEnabled(enabled);
  }

  /** Streams chunk-scanned lights around the view, then syncs the halo pool for this frame. */
  update(view: ViewRect, personalX: number, personalY: number, nowMs: number): void {
    this.streamChunks(view);
    this.personalLight.x = personalX;
    this.personalLight.y = personalY;
    this.personalLight.groundHeight = this.world.groundAt(personalX, personalY);
    this.groundLight.update(personalX, personalY, nowMs);
    // Cap anchors to what the CAMERA sees, never the personal anchor — a scene
    // viewed away from the player (gallery, spectate) must still keep its lights.
    // `view` is the camera's on-screen rect, which is in VIEW-pixel space once
    // worldToScreen routes through the seam — convert its center back to a REAL world
    // tile position before comparing against light.x/y, which stay real-world (torch/
    // door positions are scanned straight off the real world in scanChunk below).
    const centerView = { x: (view.x + view.width / 2) / SCREEN_TILE_PX, y: (view.y + view.height / 2) / SCREEN_TILE_PX };
    const centerWorld = viewToWorld(centerView, getViewOrientation());
    const lights = selectFrameLights(
      this.chunkLights.values(),
      this.accentLights,
      centerWorld.x,
      centerWorld.y,
      this.personalLight,
      MAX_ACTIVE_LIGHTS,
      this.candidateLights,
      this.frameLights,
    );
    this.pool.sync(lights, nowMs);
  }

  /** Torch positions currently resident (authored wall torches + placed thrown
   * torches, fed in as accent lights) — vfx flame particles key off this list. */
  activeTorches(): readonly LightSource[] {
    return collectTorchLights(
      this.chunkLights.values(),
      this.accentLights,
      this.activeTorchLights,
    );
  }

  /** Forces every chunk-scanned light (torch/door) to be re-derived — the lighting
   * sibling of TerrainRenderer.invalidateAll(), fired at the same live-rotation swap
   * instant since scanChunk's chunk footprint is also computed via the seam's
   * orientation-dependent viewChunkWorldOrigin. */
  invalidateAll(): void {
    this.chunkLights.clear();
    this.streamedWindow = "";
  }

  private streamChunks(view: ViewRect): void {
    const window = chunkWindowKey(view, LOAD_MARGIN_CHUNKS);
    if (window === this.streamedWindow) return;
    const desired = desiredChunks(view, LOAD_MARGIN_CHUNKS);
    const { toLoad, toUnloadKeys } = diffChunks(desired, new Set(this.chunkLights.keys()));
    for (const coord of toLoad) this.chunkLights.set(chunkKey(coord), this.scanChunk(coord));
    for (const key of toUnloadKeys) this.chunkLights.delete(key);
    this.streamedWindow = window;
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
    this.groundLight.dispose();
    this.pool.dispose();
  }
}

export type { LightKind, LightSource } from "./lightSource.js";
