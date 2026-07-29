import type Phaser from "phaser";
import type { LightSource } from "../../render/lighting/core/lightSource.js";
import { AreaAnimatedPool } from "./animation/areaAnimatedPool.js";
import { ConnectedFireField } from "./fire/connectedFireField.js";
import { AreaPuddleLayers } from "./puddles/areaPuddleLayers.js";

export type AreaSpriteKind =
  | "fire"
  | "wet"
  | "oil"
  | "poison"
  | "smoke"
  | "steam";

export interface AreaTileView {
  id: string;
  effectId: string;
  x: number;
  y: number;
  /** Absolute terrain surface height sampled from the live world at this cell. */
  groundHeight: number;
  /** Canonical ground projection, computed once while building the per-frame view. */
  screenX: number;
  screenY: number;
  sprite: AreaSpriteKind;
  neighborMask: number;
}

export interface AreaPuddlePresentation {
  sync(tiles: readonly AreaTileView[]): void;
  dispose(): void;
}

export interface AreaAnimatedPresentation {
  sync(tiles: readonly AreaTileView[]): LightSource[];
  dispose(): void;
}

export interface AreaFirePresentation {
  sync(tiles: readonly AreaTileView[]): LightSource[];
  dispose(): void;
}

export interface AreaEffectPoolDependencies {
  readonly puddles?: AreaPuddlePresentation;
  readonly animated?: AreaAnimatedPresentation;
  readonly fire?: AreaFirePresentation;
}

export class AreaEffectPool {
  private readonly puddles: AreaPuddlePresentation;
  private readonly animated: AreaAnimatedPresentation;
  private readonly fire: AreaFirePresentation;
  private readonly lights: LightSource[] = [];

  constructor(
    scene: Phaser.Scene,
    dependencies: AreaEffectPoolDependencies = {},
  ) {
    this.puddles = dependencies.puddles ?? new AreaPuddleLayers(scene);
    this.animated = dependencies.animated ?? new AreaAnimatedPool(scene);
    this.fire = dependencies.fire ?? new ConnectedFireField(scene);
  }

  sync(tiles: readonly AreaTileView[]): LightSource[] {
    this.puddles.sync(tiles);
    this.lights.length = 0;
    this.lights.push(...this.fire.sync(tiles));
    this.lights.push(...this.animated.sync(tiles));
    return this.lights;
  }

  dispose(): void {
    this.puddles.dispose();
    this.fire.dispose();
    this.animated.dispose();
    this.lights.length = 0;
  }
}
