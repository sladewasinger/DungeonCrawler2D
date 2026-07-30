import type { World } from "@dc2d/engine";
import type Phaser from "phaser";
import type { ViewRect } from "../../terrain/streaming/streaming.js";
import { getViewOrientation } from "../../view/transform/viewState.js";
import { isReservedRoomPosition } from "../../../scenes/dungeon/frame/roomEntityVisibility.js";
import { currentLightingMode, LIGHTING_MODES } from "../mode.js";
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
import { ToonVisibilityMask } from "./mask/visibilityMask.js";
import { toonWorldBoundsForView } from "./toonVisibilityBounds.js";
import type {
  WorldPresentationVisibility,
} from "../../visibility/worldPresentationVisibility.js";
import { TOON_LIGHTING_TUNING } from "./toonLightingTuning.js";

const ALWAYS_VISIBLE_FIELD: ToonVisibilityField = {
  visibleTiles: new Set(),
  maskRects: [],
  evaluatedCells: 0,
  lineOfSightChecks: 0,
  occluderChecks: 0,
};

export interface ToonVisibilityFrame {
  readonly view: ViewRect;
  readonly personal: Readonly<{ x: number; y: number }>;
  readonly cameraRotationRad: number;
}

export interface ToonVisibilityMetrics {
  readonly active: boolean;
  readonly maskObjects: number;
  readonly visibleTiles: number;
  readonly evaluatedCells: number;
  readonly lineOfSightChecks: number;
  readonly occluderChecks: number;
  readonly fieldRebuilds: number;
}

/** Owns mode switching, LOS cache invalidation, and the single camera mask. */
export class ToonVisibilityController implements WorldPresentationVisibility {
  readonly backgroundColor = TOON_LIGHTING_TUNING.cameraBackgroundColor;
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
    if (!enabled) return this.disable();
    this.active = true;
    this.refreshField(frame);
    this.maskForToon().sync(this.field, frame.cameraRotationRad);
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

  presentationVisibility(): WorldPresentationVisibility | null {
    return this.active ? this : null;
  }

  get revision(): number {
    return this.fieldRebuilds;
  }

  metrics(): ToonVisibilityMetrics {
    return {
      active: this.active,
      maskObjects: this.mask?.maskObjectCount() ?? 0,
      visibleTiles: this.field.visibleTiles.size,
      evaluatedCells: this.field.evaluatedCells,
      lineOfSightChecks: this.field.lineOfSightChecks,
      occluderChecks: this.field.occluderChecks,
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

  private disable(): boolean {
    if (!this.active) return false;
    this.active = false;
    this.cacheKey = null;
    this.field = ALWAYS_VISIBLE_FIELD;
    this.mask?.clear();
    return false;
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
