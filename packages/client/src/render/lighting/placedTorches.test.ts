import { describe, expect, it } from "vitest";
import {
  diffPlacedTorches,
  EMBER_FADE_SECONDS,
  flyingTorchLights,
  placedTorchLights,
  placedTorchSeeds,
  torchEmberFade,
} from "./placedTorches.js";
import { LIGHT_MAX } from "../terrain/tileLight.js";
import { TORCH_RADIUS_TILES } from "./torchLightStyle.js";

const TICK_RATE = 20;

describe("placedTorchLights / flyingTorchLights", () => {
  it("centers a placed torch's halo on its tile and tags it kind torch", () => {
    const [light] = placedTorchLights([{ id: "t1", tileX: 4, tileY: 6 }]);
    expect(light).toMatchObject({ x: 4.5, y: 6.5, kind: "torch" });
  });

  it("tags a flying torch's glow kind fire, not torch (no flame particle mid-flight)", () => {
    const [light] = flyingTorchLights([{ id: "t1", x: 4.2, y: 6.7 }]);
    expect(light).toMatchObject({ x: 4.2, y: 6.7, kind: "fire" });
  });
});

describe("torchEmberFade", () => {
  it("is full brightness with more than EMBER_FADE_SECONDS left", () => {
    expect(torchEmberFade(EMBER_FADE_SECONDS * TICK_RATE + 1, TICK_RATE)).toBe(1);
    expect(torchEmberFade(9999, TICK_RATE)).toBe(1);
  });

  it("ramps down linearly inside the fade window", () => {
    const halfway = (EMBER_FADE_SECONDS * TICK_RATE) / 2;
    const fade = torchEmberFade(halfway, TICK_RATE);
    expect(fade).toBeGreaterThan(0.35);
    expect(fade).toBeLessThan(1);
  });

  it("never drops below its floor once burnout is imminent or past", () => {
    expect(torchEmberFade(0, TICK_RATE)).toBeCloseTo(0.35, 5);
    expect(torchEmberFade(-50, TICK_RATE)).toBeCloseTo(0.35, 5);
  });
});

describe("placedTorchLights ember fade", () => {
  it("shrinks and dims the halo for a fading torch, full brightness for a fresh one", () => {
    const [fresh] = placedTorchLights([{ id: "t1", tileX: 0, tileY: 0, emberFade: 1 }]);
    const [fading] = placedTorchLights([{ id: "t2", tileX: 0, tileY: 0, emberFade: 0.35 }]);
    expect(fresh?.radiusTiles).toBeCloseTo(TORCH_RADIUS_TILES, 5);
    expect(fading?.radiusTiles).toBeLessThan(fresh?.radiusTiles ?? 0);
    expect(fading?.color).not.toBe(fresh?.color);
  });

  it("defaults to full brightness when emberFade is omitted (backward compatible)", () => {
    const [light] = placedTorchLights([{ id: "t1", tileX: 0, tileY: 0 }]);
    expect(light?.radiusTiles).toBeCloseTo(TORCH_RADIUS_TILES, 5);
  });
});

describe("placedTorchSeeds", () => {
  it("seeds a placed torch's own tile at full brightness, like an authored torch", () => {
    expect(placedTorchSeeds([{ id: "t1", tileX: 4, tileY: 6 }])).toEqual([{ tileX: 4, tileY: 6, level: LIGHT_MAX }]);
  });
});

describe("diffPlacedTorches", () => {
  it("reports a newly landed torch's tile as changed", () => {
    const { changedTiles, next } = diffPlacedTorches(new Map(), [{ id: "t1", tileX: 4, tileY: 6 }]);
    expect(changedTiles).toEqual([{ wx: 4, wy: 6 }]);
    expect(next.get("t1")).toEqual({ wx: 4, wy: 6 });
  });

  it("reports nothing changed when the same torch persists across frames", () => {
    const previous = new Map([["t1", { wx: 4, wy: 6 }]]);
    const { changedTiles } = diffPlacedTorches(previous, [{ id: "t1", tileX: 4, tileY: 6 }]);
    expect(changedTiles).toEqual([]);
  });

  it("reports a removed torch's last tile as changed (expiry or pickup)", () => {
    const previous = new Map([["t1", { wx: 4, wy: 6 }]]);
    const { changedTiles, next } = diffPlacedTorches(previous, []);
    expect(changedTiles).toEqual([{ wx: 4, wy: 6 }]);
    expect(next.size).toBe(0);
  });

  it("coalesces a simultaneous landing and expiry into two changed tiles in one pass", () => {
    const previous = new Map([["gone", { wx: 1, wy: 1 }]]);
    const { changedTiles } = diffPlacedTorches(previous, [{ id: "new", tileX: 9, tileY: 9 }]);
    expect(changedTiles).toEqual(
      expect.arrayContaining([
        { wx: 9, wy: 9 },
        { wx: 1, wy: 1 },
      ]),
    );
    expect(changedTiles).toHaveLength(2);
  });
});
