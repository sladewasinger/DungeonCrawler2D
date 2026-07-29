import { describe, expect, it } from "vitest";
import {
  appendFlyingTorchLights,
  appendPlacedTorchLights,
  diffPlacedTorches,
  EMBER_FADE_SECONDS,
  flyingTorchLights,
  placedTorchLights,
  placedTorchSeeds,
  torchEmberFade,
  updatePlacedTorchTiles,
} from "./placedTorches.js";
import { LIGHT_MAX } from "../../terrain/shading/tileLight.js";
import { TORCH_RADIUS_TILES } from "./torchLightStyle.js";

const TICK_RATE = 20;

interface PlacedTorchFixture {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly groundHeight?: number;
  readonly emberFade?: number;
}

function placedTorch(input: PlacedTorchFixture) {
  const { id, x, y, groundHeight = 0, emberFade } = input;
  return { id, x, y, groundHeight, ...(emberFade === undefined ? {} : { emberFade }) };
}

describe("placedTorchLights / flyingTorchLights", () => {
  it("preserves a placed torch's exact anchor and terrain height", () => {
    const [light] = placedTorchLights([placedTorch({ id: "t1", x: 4.25, y: 6.75, groundHeight: 2 })]);
    expect(light).toMatchObject({
      x: 4.25,
      y: 6.75,
      groundHeight: 2,
      kind: "torch",
    });
  });

  it("tags a flying torch's glow kind fire, not torch (no flame particle mid-flight)", () => {
    const [light] = flyingTorchLights([{ id: "t1", x: 4.2, y: 6.7 }]);
    expect(light).toMatchObject({
      x: 4.2,
      y: 6.7,
      kind: "fire",
    });
  });

  it("appends both light kinds into caller-owned frame storage", () => {
    const output: ReturnType<typeof placedTorchLights> = [];
    appendPlacedTorchLights([placedTorch({ id: "p", x: 1, y: 2 })], output);
    appendFlyingTorchLights([{ id: "f", x: 3, y: 4 }], output);

    expect(output.map((light) => light.kind)).toEqual(["torch", "fire"]);
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
    const [fresh] = placedTorchLights([placedTorch({ id: "t1", x: 0, y: 0, emberFade: 1 })]);
    const [fading] = placedTorchLights([placedTorch({ id: "t2", x: 0, y: 0, emberFade: 0.35 })]);
    expect(fresh?.radiusTiles).toBeCloseTo(TORCH_RADIUS_TILES, 5);
    expect(fading?.radiusTiles).toBeLessThan(fresh?.radiusTiles ?? 0);
    expect(fading?.color).not.toBe(fresh?.color);
  });

  it("defaults to full brightness when emberFade is omitted (backward compatible)", () => {
    const [light] = placedTorchLights([placedTorch({ id: "t1", x: 0, y: 0 })]);
    expect(light?.radiusTiles).toBeCloseTo(TORCH_RADIUS_TILES, 5);
  });
});

describe("placedTorchSeeds", () => {
  it("seeds a placed torch's own tile at full brightness, like an authored torch", () => {
    expect(placedTorchSeeds([placedTorch({ id: "t1", x: 4.25, y: 6.75 })]))
      .toEqual([{ tileX: 4, tileY: 6, level: LIGHT_MAX }]);
  });
});

describe("diffPlacedTorches", () => {
  it("reports a newly landed torch's tile as changed", () => {
    const { changedTiles, next } = diffPlacedTorches(new Map(), [placedTorch({ id: "t1", x: 4.25, y: 6.75 })]);
    expect(changedTiles).toEqual([{ wx: 4, wy: 6 }]);
    expect(next.get("t1")).toEqual({ wx: 4, wy: 6 });
  });

  it("reports nothing changed when the same torch persists across frames", () => {
    const previous = new Map([["t1", { wx: 4, wy: 6 }]]);
    const { changedTiles } = diffPlacedTorches(previous, [placedTorch({ id: "t1", x: 4.25, y: 6.75 })]);
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
    const { changedTiles } = diffPlacedTorches(previous, [placedTorch({ id: "new", x: 9, y: 9 })]);
    expect(changedTiles).toEqual(
      expect.arrayContaining([
        { wx: 9, wy: 9 },
        { wx: 1, wy: 1 },
      ]),
    );
    expect(changedTiles).toHaveLength(2);
  });
});

describe("updatePlacedTorchTiles", () => {
  it("mutates bounded state only for landing, movement, and removal", () => {
    const placed = new Map<string, { wx: number; wy: number }>();
    const changed: Array<{ wx: number; wy: number }> = [];
    const state = { placedTiles: placed, seenPlacedIds: new Set<string>(), changedTiles: changed };

    expect(updatePlacedTorchTiles(state, [placedTorch({ id: "t", x: 1.25, y: 2.75 })]))
      .toEqual([{ wx: 1, wy: 2 }]);
    const stableTile = placed.get("t");
    expect(updatePlacedTorchTiles(state, [placedTorch({ id: "t", x: 1.75, y: 2.25 })]))
      .toEqual([]);
    expect(placed.get("t")).toBe(stableTile);
    expect(updatePlacedTorchTiles(state, [placedTorch({ id: "t", x: 2, y: 2 })]))
      .toEqual([{ wx: 2, wy: 2 }]);
    expect(updatePlacedTorchTiles(state, []))
      .toEqual([{ wx: 2, wy: 2 }]);
    expect(placed).toHaveLength(0);
  });
});
