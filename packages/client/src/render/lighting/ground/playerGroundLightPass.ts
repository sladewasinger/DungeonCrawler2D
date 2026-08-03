import type Phaser from "phaser";
import type { World } from "@dc2d/engine";
import {
  measureRuntimeWork,
  runtimeWorkTracingEnabled,
} from "../../../performance/runtimeWorkMetrics.js";
import { getViewOrientation } from "../../view/transform/viewState.js";
import {
  playerGroundLightCells,
  reprojectPlayerGroundLightCells,
  shouldUpdatePlayerGroundLight,
  type PlayerGroundLightUpdate,
  type PlayerGroundLightCell,
} from "./playerGroundLight.js";
import { PlayerGroundLightPool } from "./playerGroundLightPool.js";

declare global {
  interface Window {
    __dc2dGroundLight?: { readonly activeCells: number; readonly layerCount: number };
  }
}

export class PlayerGroundLightPass {
  private readonly pool: PlayerGroundLightPool;
  private previousUpdate: PlayerGroundLightUpdate | null = null;
  private cachedCells: readonly PlayerGroundLightCell[] = [];
  private cachedRevision = Number.NaN;
  private enabled = true;

  constructor(scene: Phaser.Scene, private readonly world: World) {
    this.pool = new PlayerGroundLightPool(scene);
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.previousUpdate = null;
    if (!enabled) this.pool.clear();
  }

  update(playerX: number, playerY: number, nowMs: number): void {
    if (!this.enabled) return;
    const next = { tileX: Math.floor(playerX), tileY: Math.floor(playerY), orientation: getViewOrientation(), atMs: nowMs };
    if (this.needsTopologyRefresh(next)) this.refreshTopology(next);
    if (shouldUpdatePlayerGroundLight(this.previousUpdate, next)) {
      this.refreshProjection({ player: { x: playerX, y: playerY }, nowMs, next });
    }
    this.pool.update(nowMs);
    if (runtimeWorkTracingEnabled && typeof window !== "undefined") {
      window.__dc2dGroundLight = this.pool.debugState();
    }
  }

  activeCellCount(): number {
    return this.pool.activeCount();
  }

  debugState(): { readonly activeCells: number; readonly layerCount: number } {
    return this.pool.debugState();
  }

  private needsTopologyRefresh(next: PlayerGroundLightUpdate): boolean {
    return this.cachedRevision !== this.world.tileRevision ||
      this.previousUpdate?.tileX !== next.tileX ||
      this.previousUpdate?.tileY !== next.tileY ||
      this.previousUpdate?.orientation !== next.orientation;
  }

  private refreshTopology(next: PlayerGroundLightUpdate): void {
    this.cachedCells = measureRuntimeWork(
      "lighting.groundTopology",
      () => playerGroundLightCells(this.world, next.tileX + 0.5, next.tileY + 0.5),
    );
    this.cachedRevision = this.world.tileRevision;
  }

  private refreshProjection(input: GroundLightRefresh): void {
    const projected = reprojectPlayerGroundLightCells(
      this.cachedCells,
      input.player.x,
      input.player.y,
    );
    measureRuntimeWork("lighting.groundPoolSync", () => {
      this.pool.sync(projected, input.nowMs);
    });
    this.previousUpdate = input.next;
  }

  dispose(): void { this.pool.dispose(); }
}

interface GroundLightRefresh { readonly player: Readonly<{ x: number; y: number }>; readonly nowMs: number; readonly next: PlayerGroundLightUpdate; }
