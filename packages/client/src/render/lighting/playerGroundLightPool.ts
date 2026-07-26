import Phaser from "phaser";
import type { World } from "@dc2d/engine";
import { ASSET_KEYS, SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { depthForCapOccluder } from "../entities/depthSort.js";
import { worldToScreen } from "../entities/worldToScreen.js";
import { getViewOrientation } from "../view/viewState.js";
import { worldTileToView } from "../view/viewTransform.js";
import {
  PLAYER_GROUND_LIGHT_MAX_CELLS,
  playerGroundLightCells,
  shouldUpdatePlayerGroundLight,
  type PlayerGroundLightCell,
  type PlayerGroundLightUpdate,
} from "./playerGroundLight.js";

const LIGHT_FRAME = "light_soft";
const LIGHT_SOURCE_PX = 64;
const LIGHT_DIAMETER_TILES = 1.75;
const LIGHT_ALPHA = 0.2;
const LIGHT_COLOR = 0xffe9c9;
const FLOOR_LAYER_BIAS = 0.01;

export class PlayerGroundLightPool {
  private readonly sprites: Phaser.GameObjects.Sprite[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  sync(cells: readonly PlayerGroundLightCell[]): void {
    const count = Math.min(cells.length, PLAYER_GROUND_LIGHT_MAX_CELLS);
    for (let index = 0; index < count; index++) {
      const cell = cells[index];
      if (cell === undefined) continue;
      this.place(this.spriteAt(index), cell);
    }
    for (let index = count; index < this.sprites.length; index++) {
      this.sprites[index]?.setActive(false).setVisible(false);
    }
  }

  private spriteAt(index: number): Phaser.GameObjects.Sprite {
    const existing = this.sprites[index];
    if (existing) {
      existing.setActive(true).setVisible(true);
      return existing;
    }
    const sprite = this.scene.add.sprite(0, 0, ASSET_KEYS.atlas, LIGHT_FRAME)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setOrigin(0.5, 0.5);
    this.sprites.push(sprite);
    return sprite;
  }

  private place(sprite: Phaser.GameObjects.Sprite, cell: PlayerGroundLightCell): void {
    const screen = worldToScreen(cell.tileX + 0.5, cell.tileY + 0.5);
    const orientation = getViewOrientation();
    const viewTile = worldTileToView({ x: cell.tileX, y: cell.tileY }, orientation);
    sprite.setPosition(screen.x, screen.y - cell.groundHeight * SCREEN_TILE_PX);
    sprite.setScale((LIGHT_DIAMETER_TILES * SCREEN_TILE_PX) / LIGHT_SOURCE_PX);
    sprite.setDepth(depthForCapOccluder(viewTile.y) + FLOOR_LAYER_BIAS);
    sprite.setTint(LIGHT_COLOR);
    sprite.setAlpha(LIGHT_ALPHA * cell.strength);
  }

  dispose(): void {
    for (const sprite of this.sprites) sprite.destroy();
    this.sprites.length = 0;
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
    if (!enabled) this.pool.sync([]);
  }

  update(playerX: number, playerY: number, nowMs: number): void {
    if (!this.enabled) return;
    const next: PlayerGroundLightUpdate = {
      tileX: Math.floor(playerX),
      tileY: Math.floor(playerY),
      orientation: getViewOrientation(),
      atMs: nowMs,
    };
    if (!shouldUpdatePlayerGroundLight(this.previousUpdate, next)) return;
    this.pool.sync(playerGroundLightCells(this.world, playerX, playerY));
    this.previousUpdate = next;
  }

  dispose(): void {
    this.pool.dispose();
  }
}
