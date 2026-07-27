import { describe, expect, it } from "vitest";
import {
  createProjectileVelocityState,
  pruneProjectileVelocity,
  trackProjectileVelocity,
} from "./projectileVelocity.js";

describe("trackProjectileVelocity", () => {
  it("returns zero velocity on the first sighting of an id", () => {
    const state = createProjectileVelocityState();
    expect(trackProjectileVelocity(state, { id: "p1", x: 5, y: 5, nowMs: 1000 })).toEqual({ vx: 0, vy: 0 });
  });

  it("derives velocity from the position delta since the last sample", () => {
    const state = createProjectileVelocityState();
    trackProjectileVelocity(state, { id: "p1", x: 0, y: 0, nowMs: 1000 });
    const v = trackProjectileVelocity(state, { id: "p1", x: 2, y: 0, nowMs: 1500 });
    expect(v.vx).toBeCloseTo(4); // 2 tiles / 0.5s
    expect(v.vy).toBeCloseTo(0);
  });

  it("tracks multiple ids independently", () => {
    const state = createProjectileVelocityState();
    trackProjectileVelocity(state, { id: "a", x: 0, y: 0, nowMs: 0 });
    trackProjectileVelocity(state, { id: "b", x: 0, y: 0, nowMs: 0 });
    const a = trackProjectileVelocity(state, { id: "a", x: 1, y: 0, nowMs: 1000 });
    const b = trackProjectileVelocity(state, { id: "b", x: 0, y: 3, nowMs: 1000 });
    expect(a).toEqual({ vx: 1, vy: 0 });
    expect(b).toEqual({ vx: 0, vy: 3 });
  });
});

describe("pruneProjectileVelocity", () => {
  it("drops samples for ids no longer live", () => {
    const state = createProjectileVelocityState();
    trackProjectileVelocity(state, { id: "a", x: 0, y: 0, nowMs: 0 });
    trackProjectileVelocity(state, { id: "b", x: 0, y: 0, nowMs: 0 });
    pruneProjectileVelocity(state, new Set(["a"]));
    expect(state.samples.has("a")).toBe(true);
    expect(state.samples.has("b")).toBe(false);
  });
});
