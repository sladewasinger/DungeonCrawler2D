import type { World } from "@dc2d/engine";
import type Phaser from "phaser";
import type { ViewRect } from "../../terrain/streaming/streaming.js";
import {
  terrainCameraBackground,
} from "../../terrain/runtime/renderSupport.js";
import { roomTerrainPresentation } from "../../terrain/runtime/roomPresentation.js";
import { getViewOrientation } from "../../view/transform/viewState.js";
import { viewToWorld } from "../../view/transform/viewTransform.js";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { isReservedRoomPosition } from "../../../scenes/dungeon/frame/roomEntityVisibility.js";
import { currentLightingMode, LIGHTING_MODES } from "./lightingMode.js";
import {
  shouldRebuildToonVisibility,
  toonVisibilityCacheKey,
  type ToonVisibilityCacheKey,
} from "./toonVisibilityCache.js";
import {
  buildToonVisibilityField,
  isToonPositionVisible,
  type ToonVisibilityField,
} from "./toonVisibilityField.js";
import { ToonVisibilityMask } from "./toonVisibilityMask.js";
import { toonWorldBoundsForView } from "./toonVisibilityBounds.js";

const ALWAYS_VISIBLE_FIELD: ToonVisibilityField = {
  visibleTiles: new Set(),
  maskRects: [],
  evaluatedCells: 0,
  lineOfSightChecks: 0,
};

export interface ToonVisibilityFrame {
  readonly view: ViewRect;
  readonly personal: Readonly<{ x: number; y: number }>;
}

export interface ToonVisibilityMetrics {
  readonly active: boolean;
  readonly maskObjects: number;
  readonly visibleTiles: number;
  readonly evaluatedCells: number;
  readonly lineOfSightChecks: number;
  readonly fieldRebuilds: number;
}

/** Owns mode switching, LOS cache invalidation, and the single camera mask. */
export class ToonVisibilityController {
  private mask: ToonVisibilityMask | null = null;
  private cacheKey: ToonVisibilityCacheKey | null = null;
  private field = ALWAYS_VISIBLE_FIELD;
  private active = false;
  private fieldRebuilds = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
  ) {}

  prepare(frame: ToonVisibilityFrame): boolean {
    const enabled = this.shouldEnable(frame.personal);
    if (!enabled) return this.disable(frame);
    this.active = true;
    this.scene.cameras.main.setBackgroundColor("#000000");
    this.refreshField(frame);
    this.maskForToon().sync(this.field);
    return true;
  }

  isVisible(x: number, y: number): boolean {
    return !this.active || isToonPositionVisible(this.field, x, y);
  }

  isActive(): boolean {
    return this.active;
  }

  isWorldPositionVisible(x: number, y: number): boolean {
    return this.isVisible(x, y);
  }

  metrics(): ToonVisibilityMetrics {
    return {
      active: this.active,
      maskObjects: this.mask?.maskObjectCount() ?? 0,
      visibleTiles: this.field.visibleTiles.size,
      evaluatedCells: this.field.evaluatedCells,
      lineOfSightChecks: this.field.lineOfSightChecks,
      fieldRebuilds: this.fieldRebuilds,
    };
  }

  dispose(): void {
    this.mask?.dispose();
    this.mask = null;
  }

  private shouldEnable(personal: Readonly<{ x: number; y: number }>): boolean {
    return currentLightingMode() === LIGHTING_MODES.Toon &&
      !isReservedRoomPosition(personal.x, personal.y);
  }

  private disable(frame: ToonVisibilityFrame): boolean {
    if (!this.active) return false;
    this.active = false;
    this.cacheKey = null;
    this.field = ALWAYS_VISIBLE_FIELD;
    this.mask?.clear();
    this.restoreTerrainBackground(frame.view);
    return false;
  }

  private restoreTerrainBackground(view: ViewRect): void {
    const center = viewToWorld({
      x: (view.x + view.width / 2) / SCREEN_TILE_PX,
      y: (view.y + view.height / 2) / SCREEN_TILE_PX,
    }, getViewOrientation());
    const mode = roomTerrainPresentation(center.y).mode;
    this.scene.cameras.main.setBackgroundColor(terrainCameraBackground(mode));
  }

  private maskForToon(): ToonVisibilityMask {
    this.mask ??= new ToonVisibilityMask(this.scene);
    return this.mask;
  }

  private refreshField(frame: ToonVisibilityFrame): void {
    const orientation = getViewOrientation();
    const bounds = toonWorldBoundsForView(frame.view, orientation);
    const next = toonVisibilityCacheKey({
      player: frame.personal,
      orientation,
      tileRevision: this.world.tileRevision,
      bounds,
    });
    if (!shouldRebuildToonVisibility(this.cacheKey, next)) return;
    this.field = buildToonVisibilityField({
      world: this.world,
      player: frame.personal,
      bounds,
      orientation,
    });
    this.cacheKey = next;
    this.fieldRebuilds += 1;
  }
}
