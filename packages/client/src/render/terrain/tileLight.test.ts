// Headless tests for the injectable lighting config (the editor's lighting workbench
// contract): overriding ambient/curveFullLevel/warmth recomputes the derived per-level
// tint table that computeLightField's LightField.tintAt reads from.
import { TILE, type TileType } from "@dc2d/engine";
import { afterEach, describe, expect, it } from "vitest";
import {
  computeLightField,
  DEFAULT_TILE_LIGHT_CONFIG,
  getTileLightConfig,
  LIGHT_MAX,
  setTileLightConfig,
} from "./tileLight.js";

/** An all-floor world with no authored torches/doors, so every tinted level below
 * comes only from the dynamic sources each test seeds explicitly. */
function openWorld() {
  return {
    tileAt: (_wx: number, _wy: number): TileType => TILE.Floor,
    heightAt: (_wx: number, _wy: number) => 0,
  };
}

function channels(tint: number): { r: number; g: number; b: number } {
  return { r: (tint >> 16) & 0xff, g: (tint >> 8) & 0xff, b: tint & 0xff };
}

/** Brightness proxy: any channel serves, since raising ambient lifts every channel. */
function brightness(tint: number): number {
  return channels(tint).r;
}

afterEach(() => {
  // Module-level config is process-wide (the editor's whole point) — reset it after
  // every test so ordering never leaks tuning across cases.
  setTileLightConfig(DEFAULT_TILE_LIGHT_CONFIG);
});

describe("setTileLightConfig", () => {
  it("merges partial overrides onto the current config, leaving other knobs untouched", () => {
    setTileLightConfig({ ambient: 0.5 });
    expect(getTileLightConfig()).toEqual({ ...DEFAULT_TILE_LIGHT_CONFIG, ambient: 0.5 });
  });

  it("raising ambient brightens an unlit tile's baked tint", () => {
    const world = openWorld();
    const dim = computeLightField(world, 0, 0, 4).tintAt(0, 0);
    setTileLightConfig({ ambient: 1 });
    const bright = computeLightField(world, 0, 0, 4).tintAt(0, 0);
    expect(brightness(bright)).toBeGreaterThan(brightness(dim));
  });

  it("lowering curveFullLevel pulls a fixed mid-level tile onto the bright plateau sooner", () => {
    const world = openWorld();
    const seedFive = [{ tileX: 2, tileY: 2, level: 5 }];
    // Pin an explicitly-high baseline: the shipped default is user-tuned (4.5)
    // and may already put level 5 on the plateau.
    setTileLightConfig({ curveFullLevel: 9 });
    const beforeFull = computeLightField(world, 0, 0, 4, seedFive).tintAt(2, 2);
    setTileLightConfig({ curveFullLevel: 4 });
    const afterFull = computeLightField(world, 0, 0, 4, seedFive).tintAt(2, 2);
    expect(brightness(afterFull)).toBeGreaterThan(brightness(beforeFull));
  });

  it("recomputes the tint table on every call, not just the first override", () => {
    const world = openWorld();
    setTileLightConfig({ ambient: 0.3 });
    const first = computeLightField(world, 0, 0, 4).tintAt(0, 0);
    setTileLightConfig({ ambient: 0.9 });
    const second = computeLightField(world, 0, 0, 4).tintAt(0, 0);
    expect(second).not.toBe(first);
  });

  it("warmth=0 collapses a fully-lit tile to the cool tint (blue-dominant) instead of warm (red-dominant)", () => {
    const world = openWorld();
    const seedFull = [{ tileX: 2, tileY: 2, level: LIGHT_MAX }];
    const warm = channels(computeLightField(world, 0, 0, 4, seedFull).tintAt(2, 2));
    expect(warm.r).toBeGreaterThan(warm.b); // shipped warmth=1: warm gold reads red > blue.
    setTileLightConfig({ warmth: 0 });
    const cool = channels(computeLightField(world, 0, 0, 4, seedFull).tintAt(2, 2));
    expect(cool.b).toBeGreaterThan(cool.r); // warmth=0: pure cool cast, blue > red even at full light.
  });
});
