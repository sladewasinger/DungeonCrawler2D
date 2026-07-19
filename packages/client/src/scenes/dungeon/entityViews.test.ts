import type { EntitySnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  itemView,
  monsterView,
  projectileView,
  remotePlayerView,
  selfPlayerView,
  type InterpolatedEntity,
} from "./entityViews.js";
import { createProjectileVelocityState } from "./projectileVelocity.js";
import { createSelfCosmeticsState, triggerSelfAttack } from "./selfCosmetics.js";

function entity(snap: Partial<EntitySnapshot> & { id: string; kind: EntitySnapshot["kind"] }): InterpolatedEntity {
  const full: EntitySnapshot = { x: 0, y: 0, z: 0, ...snap };
  return { id: full.id, snap: full, x: full.x, y: full.y, z: full.z };
}

describe("selfPlayerView", () => {
  it("carries local facing and attack-pulse cosmetics, not server fields", () => {
    const cosmetics = createSelfCosmeticsState();
    cosmetics.faceX = -1;
    triggerSelfAttack(cosmetics, 1000, -1, 0);
    const view = selfPlayerView(
      { id: "p1", name: "Hero", x: 1, y: 2, z: 0, air: false },
      { hp: 10, maxHp: 30, fx: ["on-fire"], downed: false, weaponId: "sword" },
      cosmetics,
      1000,
      Math.PI,
    );
    expect(view).toMatchObject({ id: "p1", faceX: -1, attacking: true, weaponId: "sword", hp: 10, weaponAimAngle: Math.PI });
  });

  it("centers attackAngleRad on the swing's captured direction, not live facing", () => {
    const cosmetics = createSelfCosmeticsState();
    triggerSelfAttack(cosmetics, 1000, 0, 1);
    const view = selfPlayerView(
      { id: "p1", name: "Hero", x: 0, y: 0, z: 0, air: false },
      { hp: 10, maxHp: 30, fx: [], downed: false, weaponId: null },
      cosmetics,
      1000,
      0,
    );
    expect(view.attackAngleRad).toBeCloseTo(Math.PI / 2);
  });
});

describe("remotePlayerView", () => {
  it("reads attacking off the server anim pulse and always nulls weaponId/weaponAimAngle", () => {
    const view = remotePlayerView(entity({ id: "e1", kind: "player", name: "Wren", anim: "attack" }));
    expect(view.attacking).toBe(true);
    expect(view.weaponId).toBeNull();
    expect(view.weaponAimAngle).toBeNull();
  });

  it("defaults missing optional fields safely", () => {
    const view = remotePlayerView(entity({ id: "e2", kind: "player" }));
    expect(view).toMatchObject({ name: "?", hp: 0, maxHp: 1, fx: [], air: false, downed: false, attacking: false });
  });

  it("derives attackAngleRad from reported facing as the best available proxy", () => {
    const view = remotePlayerView(entity({ id: "e3", kind: "player", faceX: 0, faceY: -1 }));
    expect(view.attackAngleRad).toBeCloseTo(-Math.PI / 2);
  });
});

describe("monsterView", () => {
  it("maps snapshot fields with idle/unknown fallbacks", () => {
    const view = monsterView(entity({ id: "m1", kind: "enemy", defId: "skeleton", hp: 5, maxHp: 10 }));
    expect(view).toMatchObject({ defId: "skeleton", name: "skeleton", anim: "idle", hp: 5, maxHp: 10 });
  });
});

describe("itemView", () => {
  it("resolves the ground-item frame from defId", () => {
    const view = itemView(entity({ id: "i1", kind: "item", defId: "sword" }));
    expect(view.frame).toBe("weapon_rusty_sword");
  });
});

describe("projectileView", () => {
  it("derives velocity across two calls at the same id", () => {
    const velocity = createProjectileVelocityState();
    const e1 = entity({ id: "pr1", kind: "projectile", defId: "torch", x: 0, y: 0 });
    const e2: InterpolatedEntity = { ...e1, x: 1, y: 0 };
    projectileView(e1, velocity, 0);
    const view = projectileView(e2, velocity, 1000);
    expect(view.vx).toBeCloseTo(1);
    expect(view.vy).toBeCloseTo(0);
  });
});
