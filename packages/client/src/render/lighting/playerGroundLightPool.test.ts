import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import type { PlayerGroundLightCell } from "./playerGroundLight.js";
import {
  PLAYER_GROUND_LIGHT_MAX_POOL_TILES,
  PlayerGroundLightPool,
  type PlayerGroundLightTile,
} from "./playerGroundLightPool.js";

vi.mock("phaser", () => ({ default: { BlendModes: { ADD: 1 } } }));

class FakeTile implements PlayerGroundLightTile {
  active = false;
  visible = false;
  alpha = 0;
  destroyed = false;

  setActive(active: boolean): this {
    this.active = active;
    return this;
  }

  setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }

  setPosition(): this {
    return this;
  }

  setDepth(): this {
    return this;
  }

  setAlpha(alpha: number): this {
    this.alpha = alpha;
    return this;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

const cell = (tileX: number, tileY = 0): PlayerGroundLightCell => ({
  tileX,
  tileY,
  strength: 1,
  groundHeight: 0,
});

describe("PlayerGroundLightPool", () => {
  it("cross-fades old and new uniformly lit tiles instead of snapping", () => {
    const tiles: FakeTile[] = [];
    const pool = new PlayerGroundLightPool(
      {} as Phaser.Scene,
      () => {
        const tile = new FakeTile();
        tiles.push(tile);
        return tile;
      },
    );

    pool.sync([cell(0)], 0);
    pool.update(90);
    expect(tiles[0]?.alpha).toBeCloseTo(0.1);

    pool.sync([cell(1)], 90);
    pool.update(180);
    expect(tiles[0]?.alpha).toBeCloseTo(0.05);
    expect(tiles[1]?.alpha).toBeCloseTo(0.1);

    pool.update(270);
    expect(tiles[0]?.active).toBe(false);
    expect(tiles[1]?.alpha).toBeCloseTo(0.2);
  });

  it("keeps cross-fade overlap within the explicit bounded pool cap", () => {
    const tiles: FakeTile[] = [];
    const pool = new PlayerGroundLightPool(
      {} as Phaser.Scene,
      () => {
        const tile = new FakeTile();
        tiles.push(tile);
        return tile;
      },
    );
    const batchSize = PLAYER_GROUND_LIGHT_MAX_POOL_TILES / 2;
    const batch = (offset: number) =>
      Array.from({ length: batchSize }, (_, index) => cell(offset + index));

    pool.sync(batch(0), 0);
    pool.sync(batch(batchSize), 90);
    pool.sync(batch(batchSize * 2), 100);

    expect(tiles).toHaveLength(PLAYER_GROUND_LIGHT_MAX_POOL_TILES);
    expect(tiles.filter(({ active }) => active)).toHaveLength(
      PLAYER_GROUND_LIGHT_MAX_POOL_TILES,
    );
  });
});
