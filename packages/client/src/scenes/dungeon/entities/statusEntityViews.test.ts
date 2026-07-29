import type { EntitySnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  monsterView,
  remotePlayerView,
  selfPlayerView,
  type InterpolatedEntity,
} from "./entityViews.js";
import { createSelfCosmeticsState } from "../player/selfCosmetics.js";

function entity(
  snap: Partial<EntitySnapshot> & {
    id: string;
    kind: EntitySnapshot["kind"];
  },
): InterpolatedEntity {
  const full: EntitySnapshot = { x: 0, y: 0, z: 0, ...snap };
  return { id: full.id, snap: full, x: full.x, y: full.y, z: full.z };
}

describe("replicated status view parity", () => {
  it("carries poison, fire, and oil unchanged for local, remote, and enemy views", () => {
    const fx = ["poisoned", "on-fire", "oiled"];
    const local = selfPlayerView({
      pose: { id: "self", skin: "knight_f", name: "Self", x: 0, y: 0, z: 0, air: false },
      vitals: { hp: 10, maxHp: 30, fx, downed: false, blocking: false, weaponId: null },
      cosmetics: createSelfCosmeticsState(),
      nowMs: 0,
      weaponAimAngle: 0,
      assistedAim: false,
    });
    const remote = remotePlayerView(entity({ id: "remote", kind: "player", fx }));
    const enemy = monsterView(entity({ id: "enemy", kind: "enemy", fx }));
    expect(local.fx).toBe(fx);
    expect(remote.fx).toEqual(fx);
    expect(enemy.fx).toEqual(fx);
  });
});
