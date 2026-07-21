// ?scene=gallery harness: a deterministic, server-free scene every later agent screenshots to iterate on visuals.
// ?camera=rooms|landmark|chasm|sanctuary picks which fixed-seed view to render (see galleryCameraPositions.ts).
import { TILE, World, type TileType } from "@dc2d/engine";
import Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX, WORLD_PIXEL_SCALE } from "../boot/assetManifest.js";
import { isTouchDevice } from "../input/touchDetect.js";
import { LightingSystem } from "../render/lighting/index.js";
import { ownFaceRowAt } from "../render/terrain/ownFace.js";
import { TerrainRenderer } from "../render/terrain/index.js";
import { pixelTextStyle } from "../ui/font.js";
import { anchorPoint } from "../ui/widgets/anchors.js";
import { WIDGET_DEPTH } from "../ui/widgets/container.js";
import { CombatShowcase, type CombatDemoPlayer } from "./combatShowcase.js";
import { EntityShowcase } from "./entityShowcase.js";
import {
  PRESETS_WITH_SHOWCASE_MARKER,
  resolveCameraPreset,
  resolveCameraPresetName,
  type CameraPreset,
} from "./galleryCameraPositions.js";
import { showcasePlayerPose } from "./showcasePlayerMotion.js";
import { VfxShowcase } from "./vfxShowcase.js";
import { SHOWCASE_ROW } from "./entityShowcaseLayout.js";

/** ?combat=1 harness (docs/client-proofs/combat-*.png): two static demo players east of
 * the entity-showcase row, clear of its running player/monster cycle, proven-open floor
 * since it's the same room the row already renders in. */
const COMBAT_DEMO_QUERY_PARAM = "combat";
const COMBAT_DEMO_PLAYERS: readonly CombatDemoPlayer[] = [
  { id: "combat-demo-armed", x: SHOWCASE_ROW.baseX + 10, y: SHOWCASE_ROW.baseY, weaponId: "sword" },
  { id: "combat-demo-unarmed", x: SHOWCASE_ROW.baseX + 13, y: SHOWCASE_ROW.baseY, weaponId: null },
];

/** Fixed determinism contract for the gallery: same seed every load, byte-identical chunks. */
const GALLERY_WORLD_SEED = 1337;
const CAMERA_QUERY_PARAM = "camera";
const GALLERY_SEED_QUERY_PARAM = "seed";
const GALLERY_CENTER_X_QUERY_PARAM = "x";
const GALLERY_CENTER_Y_QUERY_PARAM = "y";
/** Opt-in only (?debugTerrain=1) so the acceptance-bar screenshots (?camera=...&hud=1|death,
 * no debug param) stay exactly what VISUAL_DIRECTION's bar checks — this readout is a dev
 * tool for iterating on terrain/facade logic, not part of the shipped scene. */
const DEBUG_TERRAIN_QUERY_PARAM = "debugTerrain";

const GROUND_ITEM_OFFSET_TILES = 2;

function finiteQueryNumber(params: URLSearchParams, name: string): number | null {
  const value = Number(params.get(name));
  return Number.isFinite(value) ? value : null;
}

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
  private lighting: LightingSystem | undefined;
  private vfxShowcase: VfxShowcase | undefined;
  private combatShowcase: CombatShowcase | undefined;
  private world: World | undefined;
  private coordinateReadout: Phaser.GameObjects.Text | undefined;

  constructor() {
    super("gallery");
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    const presetName = resolveCameraPresetName(params.get(CAMERA_QUERY_PARAM));
    const preset = this.resolvePreset();
    const seed = finiteQueryNumber(params, GALLERY_SEED_QUERY_PARAM) ?? GALLERY_WORLD_SEED;
    const centerTileX = finiteQueryNumber(params, GALLERY_CENTER_X_QUERY_PARAM) ?? preset.centerTileX;
    const centerTileY = finiteQueryNumber(params, GALLERY_CENTER_Y_QUERY_PARAM) ?? preset.centerTileY;
    this.world = new World(seed, 1);
    this.terrain = new TerrainRenderer(this, this.world);
    this.showcase = new EntityShowcase(this, this.world);
    this.lighting = new LightingSystem(this, this.world);
    this.vfxShowcase = new VfxShowcase(this, this.world, this.lighting);

    this.cameras.main.setRoundPixels(true);
    this.cameras.main.centerOn(
      centerTileX * SCREEN_TILE_PX + SCREEN_TILE_PX / 2,
      centerTileY * SCREEN_TILE_PX + SCREEN_TILE_PX / 2,
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
    if (new URLSearchParams(window.location.search).get(DEBUG_TERRAIN_QUERY_PARAM) === "1") {
      this.createCoordinateReadout();
    }
    this.setUpCombatShowcase();

    // HudScene self-gates on ?hud=1|death and renders on its own postFX-free camera.
    this.scene.launch("hud");
    this.setUpCameraResize();
  }

  /** ?combat=1: builds the weapon-orbit/melee-wedge demo and recenters the camera on it, overriding whatever ?camera=... preset was resolved above. */
  private setUpCombatShowcase(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get(COMBAT_DEMO_QUERY_PARAM) !== "1" || !this.world) return;
    const touchActive = isTouchDevice(window);
    this.combatShowcase = new CombatShowcase(this, this.world, COMBAT_DEMO_PLAYERS, touchActive);
    const [first, second] = COMBAT_DEMO_PLAYERS;
    const midX = ((first?.x ?? 0) + (second?.x ?? 0)) / 2;
    this.cameras.main.setZoom(2.2);
    this.cameras.main.centerOn(midX * SCREEN_TILE_PX, SHOWCASE_ROW.baseY * SCREEN_TILE_PX);
  }

  /**
   * ?debugTerrain=1-only debug readout (tile/surface under the cursor): a screen-space
   * Phaser Text object in the pixel font, not a fixed-position DOM element — "no
   * fixed-position UI, ever" (docs/VISUAL_DIRECTION.md) applies to dev overlays too.
   * Not registered with WidgetRegistry since it's a throwaway dev tool, not a shipped
   * HUD element, but it still anchors off the same top-right corner math widgets use.
   */
  private createCoordinateReadout(): void {
    // top-right: top-left is the HUD's health/buffs widget corner (ui/widgets/default-layout.json).
    const anchor = anchorPoint("top-right", { width: this.scale.width, height: this.scale.height });
    this.coordinateReadout = this.add
      .text(anchor.x - 8, anchor.y + 8, "", { ...pixelTextStyle(14), align: "right" })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(WIDGET_DEPTH)
      .setPadding(7, 5, 7, 5)
      .setBackgroundColor("rgba(8, 8, 12, 0.82)");
  }

  /** Keeps the main camera's viewport matched to the live canvas size under Scale.RESIZE. */
  private setUpCameraResize(): void {
    const onResize = (gameSize: Phaser.Structs.Size) => this.cameras.main.setSize(gameSize.width, gameSize.height);
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  /** Streams terrain + the entity/vfx/lighting showcases every frame from the camera's up-to-date view — `camera.worldView` is only valid after Phaser's own render pass has run once, not synchronously after `centerOn` in `create()`. */
  update(time: number, delta: number): void {
    this.terrain?.update(this.cameras.main.worldView);
    this.showcase?.update(time, delta / 1000);
    this.vfxShowcase?.update(time);
    this.combatShowcase?.update(time, delta / 1000);
    if (this.lighting && this.world) {
      const player = showcasePlayerPose(this.world, time, SHOWCASE_ROW.baseX, SHOWCASE_ROW.baseY - 3);
      this.lighting.update(this.cameras.main.worldView, player.x, player.y, time);
    }
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
    const face = ownFaceRowAt(this.world, tileX, tileY);
    const faceText = face ? ` | face row ${face.rowFromTop} of z${face.surfaceHeight} surface` : "";
    this.coordinateReadout.setText(
      `tile ${tileX}, ${tileY}  surface ${surfaceName} z${height.toFixed(2)}${faceText}`,
    );
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
