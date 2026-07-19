import { describe, expect, it } from "vitest";
import {
  createProjectileVelocityState,
  pruneProjectileVelocity,
  trackProjectileVelocity,
} from "./projectileVelocity.js";

describe("trackProjectileVelocity", () => {
  it("returns zero velocity on the first sighting of an id", () => {
    const state = createProjectileVelocityState();
    expect(trackProjectileVelocity(state, "p1", 5, 5, 1000)).toEqual({ vx: 0, vy: 0 });
  });

  it("derives velocity from the position delta since the last sample", () => {
    const state = createProjectileVelocityState();
    trackProjectileVelocity(state, "p1", 0, 0, 1000);
    const v = trackProjectileVelocity(state, "p1", 2, 0, 1500);
    expect(v.vx).toBeCloseTo(4); // 2 tiles / 0.5s
    expect(v.vy).toBeCloseTo(0);
  });

  it("tracks multiple ids independently", () => {
    const state = createProjectileVelocityState();
    trackProjectileVelocity(state, "a", 0, 0, 0);
    trackProjectileVelocity(state, "b", 0, 0, 0);
    const a = trackProjectileVelocity(state, "a", 1, 0, 1000);
    const b = trackProjectileVelocity(state, "b", 0, 3, 1000);
    expect(a).toEqual({ vx: 1, vy: 0 });
    expect(b).toEqual({ vx: 0, vy: 3 });
  });
});

describe("pruneProjectileVelocity", () => {
  it("drops samples for ids no longer live", () => {
    const state = createProjectileVelocityState();
    trackProjectileVelocity(state, "a", 0, 0, 0);
    trackProjectileVelocity(state, "b", 0, 0, 0);
    pruneProjectileVelocity(state, new Set(["a"]));
    expect(state.samples.has("a")).toBe(true);
    expect(state.samples.has("b")).toBe(false);
  });
});
