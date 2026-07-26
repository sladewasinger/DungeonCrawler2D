import Phaser from "phaser";
import type { World } from "@dc2d/engine";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { depthForCapOccluder } from "../entities/depthSort.js";
import { worldToScreen } from "../entities/worldToScreen.js";
import { getViewOrientation } from "../view/viewState.js";
import { worldTileToView } from "../view/viewTransform.js";
import {
  PLAYER_GROUND_LIGHT_FADE_MS,
  PLAYER_GROUND_LIGHT_MAX_CELLS,
  playerGroundLightFadeAlpha,
  playerGroundLightCells,
  shouldUpdatePlayerGroundLight,
  type PlayerGroundLightCell,
  type PlayerGroundLightUpdate,
} from "./playerGroundLight.js";

const LIGHT_ALPHA = 0.2;
const LIGHT_COLOR = 0xffe9c9;
const FLOOR_LAYER_BIAS = 0.01;
export const PLAYER_GROUND_LIGHT_MAX_POOL_TILES = PLAYER_GROUND_LIGHT_MAX_CELLS * 2;

export interface PlayerGroundLightTile {
  setActive(active: boolean): this;
  setVisible(visible: boolean): this;
  setPosition(x: number, y: number): this;
  setDepth(depth: number): this;
  setAlpha(alpha: number): this;
  destroy(): void;
}

interface PlayerGroundLightTileState {
  readonly tile: PlayerGroundLightTile;
  alpha: number;
  startAlpha: number;
  targetAlpha: number;
  transitionStartedAtMs: number;
}

type PlayerGroundLightTileFactory = () => PlayerGroundLightTile;

export class PlayerGroundLightPool {
  private readonly active = new Map<string, PlayerGroundLightTileState>();
  private readonly desiredKeys = new Set<string>();
  private readonly desiredKeyList: string[] = [];
  private readonly spare: PlayerGroundLightTile[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileFactory?: PlayerGroundLightTileFactory,
  ) {}

  sync(cells: readonly PlayerGroundLightCell[], nowMs: number): void {
    const count = Math.min(cells.length, PLAYER_GROUND_LIGHT_MAX_CELLS);
    this.desiredKeys.clear();
    this.desiredKeyList.length = count;
    for (let index = 0; index < count; index++) {
      const cell = cells[index];
      if (cell === undefined) continue;
      const key = `${cell.tileX},${cell.tileY}`;
      this.desiredKeys.add(key);
      this.desiredKeyList[index] = key;
    }

    for (const [key, state] of this.active) {
      if (!this.desiredKeys.has(key)) this.retarget(state, 0, nowMs);
    }

    for (let index = 0; index < count; index++) {
      const cell = cells[index];
      const key = this.desiredKeyList[index];
      if (cell === undefined || key === undefined) continue;
      let state = this.active.get(key);
      if (!state) {
        this.makeRoomForIncoming();
        state = this.createState(nowMs);
        this.active.set(key, state);
      }
      this.place(state.tile, cell);
      this.retarget(state, LIGHT_ALPHA * cell.strength, nowMs);
    }
    this.update(nowMs);
  }

  update(nowMs: number): void {
    for (const [key, state] of this.active) {
      state.alpha = playerGroundLightFadeAlpha(
        state.startAlpha,
        state.targetAlpha,
        nowMs - state.transitionStartedAtMs,
      );
      state.tile.setAlpha(state.alpha);
      if (
        state.targetAlpha === 0 &&
        nowMs - state.transitionStartedAtMs >= PLAYER_GROUND_LIGHT_FADE_MS
      ) {
        this.active.delete(key);
        this.release(state.tile);
      }
    }
  }

  clear(): void {
    for (const state of this.active.values()) this.release(state.tile);
    this.active.clear();
    this.desiredKeys.clear();
    this.desiredKeyList.length = 0;
  }

  private createTile(): PlayerGroundLightTile {
    if (this.tileFactory) return this.tileFactory();
    return this.scene.add.rectangle(
      0,
      0,
      SCREEN_TILE_PX,
      SCREEN_TILE_PX,
      LIGHT_COLOR,
      1,
    )
      .setBlendMode(Phaser.BlendModes.ADD)
      .setOrigin(0.5, 0.5);
  }

  private createState(nowMs: number): PlayerGroundLightTileState {
    const tile = this.spare.pop() ?? this.createTile();
    tile.setActive(true).setVisible(true).setAlpha(0);
    return {
      tile,
      alpha: 0,
      startAlpha: 0,
      targetAlpha: 0,
      transitionStartedAtMs: nowMs,
    };
  }

  private retarget(
    state: PlayerGroundLightTileState,
    targetAlpha: number,
    nowMs: number,
  ): void {
    if (state.targetAlpha === targetAlpha) return;
    state.alpha = playerGroundLightFadeAlpha(
      state.startAlpha,
      state.targetAlpha,
      nowMs - state.transitionStartedAtMs,
    );
    state.startAlpha = state.alpha;
    state.targetAlpha = targetAlpha;
    state.transitionStartedAtMs = nowMs;
  }

  private makeRoomForIncoming(): void {
    if (this.active.size < PLAYER_GROUND_LIGHT_MAX_POOL_TILES) return;
    for (const [key, state] of this.active) {
      if (this.desiredKeys.has(key)) continue;
      this.active.delete(key);
      this.release(state.tile);
      return;
    }
  }

  private release(tile: PlayerGroundLightTile): void {
    tile.setActive(false).setVisible(false);
    this.spare.push(tile);
  }

  private place(tile: PlayerGroundLightTile, cell: PlayerGroundLightCell): void {
    const screen = worldToScreen(cell.tileX + 0.5, cell.tileY + 0.5);
    const orientation = getViewOrientation();
    const viewTile = worldTileToView({ x: cell.tileX, y: cell.tileY }, orientation);
    tile.setPosition(screen.x, screen.y - cell.groundHeight * SCREEN_TILE_PX);
    tile.setDepth(depthForCapOccluder(viewTile.y) + FLOOR_LAYER_BIAS);
  }

  dispose(): void {
    for (const state of this.active.values()) state.tile.destroy();
    for (const tile of this.spare) tile.destroy();
    this.active.clear();
    this.spare.length = 0;
  }
}

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
    const next: PlayerGroundLightUpdate = {
      tileX: Math.floor(playerX),
      tileY: Math.floor(playerY),
      orientation: getViewOrientation(),
      atMs: nowMs,
    };
    if (shouldUpdatePlayerGroundLight(this.previousUpdate, next)) {
      this.pool.sync(playerGroundLightCells(this.world, playerX, playerY), nowMs);
      this.previousUpdate = next;
    }
    this.pool.update(nowMs);
  }

  dispose(): void {
    this.pool.dispose();
  }
}
