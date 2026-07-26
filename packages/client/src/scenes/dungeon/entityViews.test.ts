import type { EntitySnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  buildRenderContext,
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
    cosmetics.spriteFaceX = -1;
    triggerSelfAttack(cosmetics, 1000, -1, 0);
    const view = selfPlayerView(
      { id: "p1", skin: "elf_f", name: "Hero", x: 1, y: 2, z: 0, air: false },
      { hp: 10, maxHp: 30, fx: ["on-fire"], downed: false, blocking: true, weaponId: "sword" },
      cosmetics,
      1000,
      Math.PI,
    );
    expect(view).toMatchObject({ id: "p1", skin: "elf_f", faceX: -1, attacking: true, blocking: true, weaponId: "sword", hp: 10, weaponAimAngle: Math.PI });
    expect(selfPlayerView(
      { id: "p1", skin: "elf_f", name: "Hero", x: 2, y: 3, z: 0, air: false },
      { hp: 11, maxHp: 30, fx: [], downed: false, blocking: false, weaponId: null },
      cosmetics,
      1001,
      0,
      view,
    )).toBe(view);
    expect(view).toMatchObject({ x: 2, y: 3, hp: 11, blocking: false });
  });

  it("centers attackAngleRad on the swing's captured direction, not live facing", () => {
    const cosmetics = createSelfCosmeticsState();
    triggerSelfAttack(cosmetics, 1000, 0, 1);
    const view = selfPlayerView(
      { id: "p1", skin: "knight_m", name: "Hero", x: 0, y: 0, z: 0, air: false },
      { hp: 10, maxHp: 30, fx: [], downed: false, blocking: false, weaponId: null },
      cosmetics,
      1000,
      0,
    );
    expect(view.attackAngleRad).toBeCloseTo(Math.PI / 2);
  });
});

describe("remotePlayerView", () => {
  it("reads attacking and held weapon from the server snapshot", () => {
    const view = remotePlayerView(entity({
      id: "e1",
      kind: "player",
      name: "Wren",
      anim: "attack",
      weapon: "sword",
      skin: "dwarf_m",
      blocking: true,
      disconnected: true,
    }));
    expect(view.attacking).toBe(true);
    expect(view.weaponId).toBe("sword");
    expect(view.skin).toBe("dwarf_m");
    expect(view.blocking).toBe(true);
    expect(view.weaponAimAngle).toBeNull();
    expect(view.disconnected).toBe(true);
    expect(remotePlayerView(
      entity({ id: "e1", kind: "player", name: "Wren", hp: 4 }),
      view,
    )).toBe(view);
    expect(view.hp).toBe(4);
  });

  it("defaults missing optional fields safely", () => {
    const view = remotePlayerView(entity({ id: "e2", kind: "player" }));
    expect(view).toMatchObject({ name: "?", hp: 0, maxHp: 1, fx: [], air: false, downed: false, attacking: false });
  });

  it("derives attackAngleRad from reported facing as the best available proxy", () => {
    const view = remotePlayerView(entity({ id: "e3", kind: "player", faceX: 0, faceY: -1 }));
    expect(view.attackAngleRad).toBeCloseTo(-Math.PI / 2);
  });

  it("keeps the last horizontal sprite side through vertical movement", () => {
    const view = remotePlayerView(entity({
      id: "e4", kind: "player", faceX: -1, faceY: 0,
    }));
    remotePlayerView(entity({
      id: "e4", kind: "player", faceX: 0, faceY: -1,
    }), view);
    expect(view.faceX).toBe(-1);
    expect(view.attackAngleRad).toBeCloseTo(-Math.PI / 2);
  });
});

describe("monsterView", () => {
  it("maps snapshot fields with idle/unknown fallbacks", () => {
    const view = monsterView(entity({ id: "m1", kind: "enemy", defId: "skeleton", hp: 5, maxHp: 10 }));
    expect(view).toMatchObject({ defId: "skeleton", name: "skeleton", anim: "idle", hp: 5, maxHp: 10 });
    expect(monsterView(
      entity({ id: "m1", kind: "enemy", defId: "skeleton", hp: 4 }),
      view,
    )).toBe(view);
    expect(view.hp).toBe(4);
  });
});

describe("itemView", () => {
  it("resolves the ground-item frame from defId", () => {
    const view = itemView(entity({ id: "i1", kind: "item", defId: "sword" }));
    expect(view.frame).toBe("weapon_rusty_sword");
    expect(itemView(
      entity({ id: "i1", kind: "item", defId: "torch" }),
      view,
    )).toBe(view);
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
    expect(projectileView(e2, velocity, 1100, view)).toBe(view);
  });
});

describe("buildRenderContext", () => {
  it("rewrites a caller-owned frame context", () => {
    const world = { groundAt: () => 0 } as never;
    const context = buildRenderContext(world, 1, 0.016, 2, 3, new Set());

    expect(buildRenderContext(
      world,
      2,
      0.02,
      4,
      5,
      new Set(["p"]),
      context,
    )).toBe(context);
    expect(context).toMatchObject({
      nowMs: 2,
      dtSeconds: 0.02,
      selfX: 4,
      selfY: 5,
    });
  });
});
