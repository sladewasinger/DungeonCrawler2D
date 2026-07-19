// Headless tests for the melee-swing edge detector: fires exactly on the false->true
// transition of `attacking`, for both self and remote players uniformly, and resolves
// wedge spawn geometry from the view's real position/angle rather than magic numbers.
import { describe, expect, it } from "vitest";
import { depthForEntity } from "../../render/entities/depthSort.js";
import type { PlayerEntityView } from "../../render/entities/index.js";
import { resolveMeleeSwings } from "./meleeSwingEvents.js";

function view(overrides: Partial<PlayerEntityView> & { id: string }): PlayerEntityView {
  return {
    playerId: overrides.id,
    name: "test",
    x: 10,
    y: 20,
    z: 0,
    hp: 10,
    maxHp: 10,
    fx: [],
    faceX: 1,
    faceY: 0,
    air: false,
    downed: false,
    attacking: false,
    weaponId: null,
    weaponAimAngle: null,
    attackAngleRad: 0,
    ...overrides,
  };
}

describe("resolveMeleeSwings", () => {
  it("spawns nothing on the first frame a player is already idle", () => {
    const previous = new Map<string, boolean>();
    expect(resolveMeleeSwings([view({ id: "a", attacking: false })], previous)).toEqual([]);
  });

  it("spawns exactly once on the attacking false->true edge, not on subsequent still-attacking frames", () => {
    const previous = new Map<string, boolean>();
    resolveMeleeSwings([view({ id: "a", attacking: false })], previous);
    const started = resolveMeleeSwings([view({ id: "a", attacking: true })], previous);
    expect(started.map((s) => s.id)).toEqual(["a"]);
    const stillGoing = resolveMeleeSwings([view({ id: "a", attacking: true })], previous);
    expect(stillGoing).toEqual([]);
  });

  it("fires again on a second swing after the flag drops back to false", () => {
    const previous = new Map<string, boolean>();
    resolveMeleeSwings([view({ id: "a", attacking: true })], previous);
    resolveMeleeSwings([view({ id: "a", attacking: false })], previous);
    const started = resolveMeleeSwings([view({ id: "a", attacking: true })], previous);
    expect(started.map((s) => s.id)).toEqual(["a"]);
  });

  it("tracks self and remote players independently by id", () => {
    const previous = new Map<string, boolean>();
    const started = resolveMeleeSwings(
      [view({ id: "self", attacking: true }), view({ id: "remote-1", attacking: false })],
      previous,
    );
    expect(started.map((s) => s.id)).toEqual(["self"]);
  });

  it("prunes ids no longer present so a disconnected player's stale state can't leak into a reused id", () => {
    const previous = new Map<string, boolean>();
    resolveMeleeSwings([view({ id: "gone", attacking: true })], previous);
    resolveMeleeSwings([], previous);
    expect(previous.has("gone")).toBe(false);
  });

  it("resolves spawn geometry from the view's real position/angle, depth derived from depthForEntity", () => {
    const previous = new Map<string, boolean>();
    const [spawn] = resolveMeleeSwings([view({ id: "a", x: 5, y: 7, attackAngleRad: 1.2, attacking: true })], previous);
    expect(spawn).toBeDefined();
    expect(spawn?.worldX).toBe(5);
    expect(spawn?.worldY).toBe(7);
    expect(spawn?.angleRad).toBe(1.2);
    expect(spawn?.depth).toBeLessThan(depthForEntity(7));
  });
});
