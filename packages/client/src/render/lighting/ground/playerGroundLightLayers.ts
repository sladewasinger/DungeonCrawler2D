import { presentationCells } from "./playerGroundLightPresentation.js";
import {
  PLAYER_GROUND_LIGHT_FADE_MS,
  playerGroundLightFadeAlpha,
  type PlayerGroundLightCell,
} from "./playerGroundLight.js";
import type Phaser from "phaser";
import {
  createLightState,
  hidePlayerGroundLightLayers,
  lightDepth,
  lightKey,
  lightLayer,
  PLAYER_GROUND_LIGHT_ALPHA,
  redrawPlayerGroundLightLayers,
  type PlayerGroundLightLayerState,
} from "./playerGroundLightDrawing.js";

type LightState = PlayerGroundLightLayerState;

export class PlayerGroundLightLayerPool {
  private readonly active = new Map<string, LightState>();
  private readonly layers = new Map<number, Phaser.GameObjects.Graphics>();
  private dirty = true;

  constructor(private readonly scene: Phaser.Scene) {}
  sync(cells: readonly PlayerGroundLightCell[], nowMs: number): void {
    const selected = presentationCells(cells);
    const desired = new Set(selected.map(lightKey));
    for (const state of this.active.values()) {
      if (!desired.has(state.key)) this.retarget(state, 0, nowMs);
    }
    for (const cell of selected) this.syncCell(cell, nowMs);
    this.update(nowMs);
  }
  update(nowMs: number): void {
    let changed = this.dirty;
    for (const [key, state] of this.active) {
      const elapsed = nowMs - state.transitionStartedAtMs;
      const nextAlpha = playerGroundLightFadeAlpha(state.startAlpha, state.targetAlpha, elapsed);
      changed ||= nextAlpha !== state.alpha;
      state.alpha = nextAlpha;
      if (state.targetAlpha === 0 && elapsed >= PLAYER_GROUND_LIGHT_FADE_MS) {
        this.active.delete(key);
      }
    }
    if (changed) this.redraw();
  }
  clear(): void {
    this.active.clear();
    this.dirty = true;
    hidePlayerGroundLightLayers(this.layers);
  }

  activeCount(): number {
    return this.active.size;
  }

  debugState(): { readonly activeCells: number; readonly layerCount: number } {
    return { activeCells: this.active.size, layerCount: this.layers.size };
  }

  dispose(): void {
    for (const layer of this.layers.values()) layer.destroy();
    this.layers.clear();
    this.active.clear();
  }

  private syncCell(cell: PlayerGroundLightCell, nowMs: number): void {
    const key = lightKey(cell);
    const depth = lightDepth(cell);
    const current = this.active.get(key);
    const state = current ?? createLightState({
      cell, key, nowMs, layer: this.layerFor(depth),
    });
    state.tileX = cell.tileX;
    state.tileY = cell.tileY;
    state.groundHeight = cell.groundHeight;
    if (state.depth !== depth) {
      state.depth = depth;
      state.layer = this.layerFor(depth);
    }
    this.retarget(state, PLAYER_GROUND_LIGHT_ALPHA * cell.strength, nowMs);
    this.active.set(key, state); this.dirty = true;
  }

  private layerFor(depth: number): Phaser.GameObjects.Graphics {
    const existing = this.layers.get(depth);
    if (existing) return existing;
    const layer = lightLayer(this.scene, depth);
    this.layers.set(depth, layer);
    return layer;
  }

  private redraw(): void {
    redrawPlayerGroundLightLayers(this.layers, this.active);
    this.dirty = false;
  }

  private retarget(state: LightState, targetAlpha: number, nowMs: number): void {
    if (state.targetAlpha === targetAlpha) return;
    state.alpha = playerGroundLightFadeAlpha(
      state.startAlpha,
      state.targetAlpha,
      nowMs - state.transitionStartedAtMs,
    );
    state.startAlpha = state.alpha;
    state.targetAlpha = targetAlpha;
    state.transitionStartedAtMs = nowMs;
    this.dirty = true;
  }
}
