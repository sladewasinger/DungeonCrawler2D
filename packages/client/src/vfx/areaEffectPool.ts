// Tracks active area-hazard tiles and keeps one particle/overlay rig alive per id —
// created once, torn down when the tile disappears. Reports the accent lights that
// fire/poison/steam tiles contribute back to LightingSystem.setAccentLights.
import type Phaser from "phaser";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import type { LightSource } from "../render/lighting/lightSource.js";
import { createFireEmitters, createPoisonEmitter, createSheenOverlay, createSteamEmitter } from "./particleRecipes.js";

export type AreaSpriteKind = "fire" | "wet" | "oil" | "poison" | "smoke" | "steam";

export interface AreaTileView {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly sprite: AreaSpriteKind;
}

interface Rig {
  readonly destroy: () => void;
  readonly light: LightSource | null;
}

const FIRE_LIGHT = { color: 0xff9e3d, radiusTiles: 2.3, kind: "fire" as const, seed: 11 };
const POISON_LIGHT = { color: 0x7bd44a, radiusTiles: 2, kind: "poison" as const, seed: 23 };
const STEAM_LIGHT = { color: 0xd8dde6, radiusTiles: 1.6, kind: "steam" as const, seed: 37 };

export class AreaEffectPool {
  private readonly rigs = new Map<string, Rig>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** Rebuilds the tracked rig set to exactly match `tiles`; returns this frame's accent lights. */
  sync(tiles: readonly AreaTileView[]): LightSource[] {
    const seen = new Set<string>();
    const lights: LightSource[] = [];
    for (const tile of tiles) {
      seen.add(tile.id);
      const rig = this.rigs.get(tile.id) ?? this.build(tile);
      this.rigs.set(tile.id, rig);
      if (rig.light) lights.push(rig.light);
    }
    for (const [id, rig] of this.rigs) {
      if (seen.has(id)) continue;
      rig.destroy();
      this.rigs.delete(id);
    }
    return lights;
  }

  private build(tile: AreaTileView): Rig {
    const screen = worldToScreen(tile.x, tile.y);
    if (tile.sprite === "fire") return this.buildFire(tile, screen);
    if (tile.sprite === "poison") return this.buildPoison(tile, screen);
    if (tile.sprite === "steam") return this.buildSteam(tile, screen);
    if (tile.sprite === "oil" || tile.sprite === "wet") return this.buildSheen(tile, screen);
    return { destroy: () => {}, light: null };
  }

  private buildFire(tile: AreaTileView, screen: { x: number; y: number }): Rig {
    const emitters = createFireEmitters(this.scene, screen.x, screen.y);
    return { destroy: () => emitters.forEach((e) => e.destroy()), light: { id: tile.id, x: tile.x, y: tile.y, ...FIRE_LIGHT } };
  }

  private buildPoison(tile: AreaTileView, screen: { x: number; y: number }): Rig {
    const emitter = createPoisonEmitter(this.scene, screen.x, screen.y);
    return { destroy: () => emitter.destroy(), light: { id: tile.id, x: tile.x, y: tile.y, ...POISON_LIGHT } };
  }

  private buildSteam(tile: AreaTileView, screen: { x: number; y: number }): Rig {
    const emitter = createSteamEmitter(this.scene, screen.x, screen.y);
    return { destroy: () => emitter.destroy(), light: { id: tile.id, x: tile.x, y: tile.y, ...STEAM_LIGHT } };
  }

  private buildSheen(tile: AreaTileView, screen: { x: number; y: number }): Rig {
    const image = createSheenOverlay(this.scene, screen.x, screen.y, tile.sprite === "wet");
    return { destroy: () => image.destroy(), light: null };
  }

  dispose(): void {
    for (const rig of this.rigs.values()) rig.destroy();
    this.rigs.clear();
  }
}
