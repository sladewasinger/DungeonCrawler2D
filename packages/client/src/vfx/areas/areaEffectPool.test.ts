import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import {
  AreaEffectPool,
  type AreaAnimatedPresentation,
  type AreaFirePresentation,
  type AreaPuddlePresentation,
  type AreaTileView,
} from "./areaEffectPool.js";

const tile: AreaTileView = {
  id: "4,7",
  effectId: "area-wet",
  x: 4.5,
  y: 7.5,
  groundHeight: 0,
  screenX: 0,
  screenY: 0,
  sprite: "wet",
  neighborMask: 0,
};

describe("AreaEffectPool", () => {
  it("syncs shared ground topology before returning bounded animated lights", () => {
    const order: string[] = [];
    const puddles: AreaPuddlePresentation = {
      sync: vi.fn(() => order.push("puddles")),
      dispose: vi.fn(),
    };
    const lights = [{
      id: "fire",
      x: 0,
      y: 0,
      color: 0,
      radiusTiles: 1,
      kind: "fire" as const,
      seed: 1,
    }];
    const fire: AreaFirePresentation = {
      sync: vi.fn(() => {
        order.push("fire");
        return lights;
      }),
      dispose: vi.fn(),
    };
    const animated: AreaAnimatedPresentation = {
      sync: vi.fn(() => {
        order.push("animated");
        return [];
      }),
      dispose: vi.fn(),
    };
    const pool = new AreaEffectPool(
      {} as Phaser.Scene,
      { puddles, fire, animated },
    );
    expect(pool.sync([tile])).toEqual(lights);
    expect(order).toEqual(["puddles", "fire", "animated"]);
  });

  it("disposes both presentation lanes", () => {
    const puddles = { sync: vi.fn(), dispose: vi.fn() };
    const fire = { sync: vi.fn(() => []), dispose: vi.fn() };
    const animated = { sync: vi.fn(() => []), dispose: vi.fn() };
    const pool = new AreaEffectPool(
      {} as Phaser.Scene,
      { puddles, fire, animated },
    );
    pool.dispose();
    expect(puddles.dispose).toHaveBeenCalledOnce();
    expect(fire.dispose).toHaveBeenCalledOnce();
    expect(animated.dispose).toHaveBeenCalledOnce();
  });
});
