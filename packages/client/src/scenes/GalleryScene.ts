// ?scene=gallery harness: a deterministic, server-free scene every later agent screenshots to iterate on visuals.
// ?camera=rooms|landmark|chasm|sanctuary picks which fixed-seed view to render (see galleryCameraPositions.ts).
import { TILE, World, type TileType } from "@dc2d/engine";
import Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX, WORLD_PIXEL_SCALE } from "../boot/assetManifest.js";
import { TerrainRenderer } from "../render/terrain/index.js";
import { EntityShowcase } from "./entityShowcase.js";
import {
  PRESETS_WITH_SHOWCASE_MARKER,
  resolveCameraPreset,
  resolveCameraPresetName,
  type CameraPreset,
} from "./galleryCameraPositions.js";

/** Fixed determinism contract for the gallery: same seed every load, byte-identical chunks. */
const GALLERY_WORLD_SEED = 1337;
const CAMERA_QUERY_PARAM = "camera";

const GROUND_ITEM_OFFSET_TILES = 2;

const TILE_NAMES = new Map<TileType, string>(
  Object.entries(TILE).map(([name, value]) => [value, name.toLowerCase()]),
);

/** Pixel position for an entity's feet standing in tile (tx, ty): centered horizontally, at the tile's south edge — the same convention the terrain grid uses, so wall-cap overhangs land exactly where a body would be. */
function feetPosition(tileX: number, tileY: number): { x: number; y: number } {
  return { x: tileX * SCREEN_TILE_PX + SCREEN_TILE_PX / 2, y: (tileY + 1) * SCREEN_TILE_PX };
}

export class GalleryScene extends Phaser.Scene {
  private terrain: TerrainRenderer | undefined;
  private showcase: EntityShowcase | undefined;
  private world: World | undefined;
  private coordinateReadout: HTMLDivElement | undefined;

  constructor() {
    super("gallery");
  }

  create(): void {
    const presetName = resolveCameraPresetName(new URLSearchParams(window.location.search).get(CAMERA_QUERY_PARAM));
    const preset = this.resolvePreset();
    this.world = new World(GALLERY_WORLD_SEED, 1);
    this.terrain = new TerrainRenderer(this, this.world);
    this.showcase = new EntityShowcase(this, this.world);

    this.cameras.main.setRoundPixels(true);
    this.cameras.main.centerOn(
      preset.centerTileX * SCREEN_TILE_PX + SCREEN_TILE_PX / 2,
      preset.centerTileY * SCREEN_TILE_PX + SCREEN_TILE_PX / 2,
    );

    // Skip the raw marker where EntityShowcase already renders a fully-featured
    // (shadow/hp/nameplate/depth-sort) skeleton on the same tile — see
    // PRESETS_WITH_SHOWCASE_MARKER's doc comment.
    if (!PRESETS_WITH_SHOWCASE_MARKER.has(presetName)) this.placeOcclusionMarker(preset);
    this.placeGroundItem(
      preset.groundItemTileX ?? preset.centerTileX + GROUND_ITEM_OFFSET_TILES,
      preset.groundItemTileY ?? preset.centerTileY,
      "flask_blue",
    );
    this.coordinateReadout = document.createElement("div");
    Object.assign(this.coordinateReadout.style, {
      position: "fixed",
      left: "8px",
      top: "8px",
      zIndex: "1000",
      pointerEvents: "none",
      padding: "5px 7px",
      color: "#ffffff",
      background: "rgba(8, 8, 12, 0.82)",
      font: "14px monospace",
      whiteSpace: "pre",
    });
    document.body.append(this.coordinateReadout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.coordinateReadout?.remove();
      this.coordinateReadout = undefined;
    });
  }

  /** Streams terrain + the entity showcase every frame from the camera's up-to-date view — `camera.worldView` is only valid after Phaser's own render pass has run once, not synchronously after `centerOn` in `create()`. */
  update(time: number, delta: number): void {
    this.terrain?.update(this.cameras.main.worldView);
    this.showcase?.update(time, delta / 1000);
    this.updateCoordinateReadout();
  }

  private updateCoordinateReadout(): void {
    if (!this.world || !this.coordinateReadout) return;
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tileX = Math.floor(worldPoint.x / SCREEN_TILE_PX);
    const tileY = Math.floor(worldPoint.y / SCREEN_TILE_PX);
    const tile = this.world.tileAt(tileX, tileY);
    const tileName = TILE_NAMES.get(tile) ?? `tile-${tile}`;
    const height = this.world.heightAt(tileX, tileY);
    const surfaceName = tile === TILE.Wall ? "raised-top" : tileName;
    const face = this.world.wallFaceAt(tileX, tileY);
    const faceText = face
      ? ` | wall-face from ${face.sourceX},${face.sourceY} z${face.bottom.toFixed(2)}-${face.top.toFixed(2)}`
      : "";
    this.coordinateReadout.textContent =
      `tile ${tileX}, ${tileY}  surface ${surfaceName} z${height.toFixed(2)}${faceText}`;
  }

  /** Reads ?camera=<name> off the URL, falling back to the default preset for an unknown/missing name. */
  private resolvePreset(): CameraPreset {
    return resolveCameraPreset(new URLSearchParams(window.location.search).get(CAMERA_QUERY_PARAM));
  }

  /** A looping animated sample sprite at the preset's hand-picked occlusion-test tile, feet-anchored with a ground shadow. */
  private placeOcclusionMarker(preset: CameraPreset): void {
    const { x, y } = feetPosition(preset.markerTileX, preset.markerTileY);
    this.addShadow(x, y);
    this.add
      .sprite(x, y, ASSET_KEYS.atlas)
      .setOrigin(0.5, 1)
      .setDepth(50)
      .setScale(WORLD_PIXEL_SCALE)
      .play(preset.markerAnim);
  }

  /** Places a static ground item (bob/glint animation lands with the VFX wave) beside the camera's focal tile. */
  private placeGroundItem(tileX: number, tileY: number, frame: string): void {
    const { x, y } = feetPosition(tileX, tileY);
    this.addShadow(x, y);
    this.add.sprite(x, y, ASSET_KEYS.atlas, frame).setOrigin(0.5, 1).setDepth(50).setScale(WORLD_PIXEL_SCALE);
  }

  /** Soft dark ellipse glued to the ground under an entity, per VISUAL_DIRECTION's height-reads-through-shadow rule. */
  private addShadow(x: number, y: number): void {
    this.add
      .ellipse(x, y - 2, SCREEN_TILE_PX * 0.7, SCREEN_TILE_PX * 0.28, 0x0a0a10, 0.5)
      .setOrigin(0.5, 0.5)
      .setDepth(49);
  }
}
