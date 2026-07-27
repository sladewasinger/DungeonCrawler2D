import type Phaser from "phaser";
import type { World } from "@dc2d/engine";
import { getViewOrientation } from "../view/viewState.js";
import {
  playerGroundLightCells,
  shouldUpdatePlayerGroundLight,
  type PlayerGroundLightUpdate,
} from "./playerGroundLight.js";
import { PlayerGroundLightPool } from "./playerGroundLightPool.js";

export class PlayerGroundLightPass {
  private readonly pool: PlayerGroundLightPool;
  private previousUpdate: PlayerGroundLightUpdate | null = null;
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
    if (shouldUpdatePlayerGroundLight(this.previousUpdate, next)) this.refresh({ player: { x: playerX, y: playerY }, nowMs, next });
    this.pool.update(nowMs);
  }

  private refresh(input: GroundLightRefresh): void {
    this.pool.sync(playerGroundLightCells(this.world, input.player.x, input.player.y), input.nowMs);
    this.previousUpdate = input.next;
  }

  dispose(): void { this.pool.dispose(); }
}

interface GroundLightRefresh { readonly player: Readonly<{ x: number; y: number }>; readonly nowMs: number; readonly next: PlayerGroundLightUpdate; }
