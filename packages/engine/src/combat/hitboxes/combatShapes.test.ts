import { describe, expect, it } from "vitest";
import { WorldChunkCache } from "../../world/collision.js";
import { PropKind } from "../../world/types.js";
import { obstacleToColliderShape } from "../../world/propFootprints.js";
import {
  attackHitboxHitsHurtbox,
  buildEntityAttackHitbox,
  buildPlayerAttackHitbox,
  canAttackReachElevation,
  entityFootCollider,
  entityHurtbox,
  playerFootCollider,
  playerHurtbox,
  projectileHitsHurtbox,
  resolveEntityAttackHitbox,
  resolvePlayerAttackHitbox,
} from "./combatShapes.js";

describe("combatShapes", () => {
  it("builds directional enemy attack hitboxes that hit targets ahead but miss behind/flanking", () => {
    const slime = { kind: "slime" as const, x: 10, y: 10, elevation: 0, facingX: 1, facingY: 0 };
    const hitbox = buildEntityAttackHitbox(slime);
    expect(hitbox.x).toBeGreaterThan(slime.x);
    expect(attackHitboxHitsHurtbox(hitbox, playerHurtbox({ x: 11.1, y: 10 }))).toBe(true);
    expect(attackHitboxHitsHurtbox(hitbox, playerHurtbox({ x: 8.9, y: 10 }))).toBe(false);
    expect(attackHitboxHitsHurtbox(hitbox, playerHurtbox({ x: 10, y: 8.7 }))).toBe(false);

    expect(resolveEntityAttackHitbox({ ...slime, telegraphProgress: 0, attackProgress: 0 })).toBeNull();
    expect(resolveEntityAttackHitbox({ ...slime, telegraphProgress: 0.4, attackProgress: 0 })?.phase).toBe("windup");
    expect(resolveEntityAttackHitbox({ ...slime, telegraphProgress: 0, attackProgress: 0.5 })?.phase).toBe("active");
  });

  it("intersects player melee sector and pickaxe slam hitboxes against entity hurtboxes", () => {
    const swordHitbox = buildPlayerAttackHitbox({ x: 5, y: 5, dir: { x: 1, y: 0 }, range: 1.85, halfArcRad: 0.875 });
    expect(attackHitboxHitsHurtbox(swordHitbox, entityHurtbox({ x: 6.9, y: 5.1 }, "goblin"))).toBe(true);
    expect(attackHitboxHitsHurtbox(swordHitbox, entityHurtbox({ x: 3.5, y: 5 }, "goblin"))).toBe(false);

    const active = resolvePlayerAttackHitbox({
      x: 5, y: 5, elevation: 0, facingX: 1, facingY: 0, heldItem: "sword", swingProgress: 0.4, comboStep: 1,
    });
    expect(active?.active).toBe(true);
    const inactive = resolvePlayerAttackHitbox({
      x: 5, y: 5, elevation: 0, facingX: 1, facingY: 0, heldItem: "sword", swingProgress: 0.1, comboStep: 1,
    });
    expect(inactive?.active).toBe(false);
  });

  it("exposes unified ground colliders and rotates the 8-way player foot capsule perpendicular to facing", () => {
    const southCol = playerFootCollider({ x: 2, y: 3, facingX: 0, facingY: 1, elevation: 1 });
    expect(southCol.halfX).toBeCloseTo(0.11, 5);
    expect(Math.abs(Math.cos(southCol.angleRad ?? 0))).toBeCloseTo(1, 5);
    expect(southCol.elevation).toBe(1);

    const eastCol = playerFootCollider({ x: 2, y: 3, facingX: 1, facingY: 0 });
    expect(Math.abs(Math.sin(eastCol.angleRad ?? 0))).toBeCloseTo(1, 5);
    expect(eastCol.halfX).toBeLessThan(southCol.halfX);

    const seCol = playerFootCollider({ x: 2, y: 3, facingX: 1, facingY: 1 });
    expect(Math.abs(Math.cos(seCol.angleRad ?? 0))).toBeGreaterThan(0.5);
    expect(Math.abs(Math.sin(seCol.angleRad ?? 0))).toBeGreaterThan(0.5);

    const eCol = entityFootCollider({ x: 4, y: 6 }, "golem");
    expect(eCol.halfX).toBe(0);
    expect(eCol.radius).toBe(0.62);

    const cache = new (class extends WorldChunkCache {
      override tileAt() { return { ground: 0, elevation: 0, stairs: false }; }
      override propsNear() {
        return [{ id: "pal-1", kind: PropKind.Palisade, x: 8, y: 8, variant: 0, elevation: 0, radius: 0.48, blocksMovement: true }];
      }
      override poisNear() { return []; }
    })(1);
    const palObs = cache.blockingObstaclesNear(8, 8)[0];
    expect(palObs).toBeDefined();
    if (!palObs) return;
    const shape = obstacleToColliderShape(palObs);
    expect(shape.halfX).toBeGreaterThan(0);
    expect(shape.halfY).toBeGreaterThan(0);
  });

  it("blocks melee hits across cliff elevations unless bridged by 1-tile stairs and projects downhill projectiles", () => {
    const boar = { kind: "boar" as const, x: 10, y: 10, elevation: 0, facingX: 1, facingY: 0 };
    const boarHitbox = buildEntityAttackHitbox(boar);
    expect(attackHitboxHitsHurtbox(boarHitbox, playerHurtbox({ x: 10.9, y: 10, elevation: 1 }))).toBe(false);
    expect(attackHitboxHitsHurtbox(boarHitbox, playerHurtbox({ x: 10.9, y: 10, elevation: 1, onStairs: true }))).toBe(true);
    expect(attackHitboxHitsHurtbox(boarHitbox, playerHurtbox({ x: 10.9, y: 10, elevation: 2, onStairs: true }))).toBe(false);

    expect(canAttackReachElevation({ attackerElevation: 1, targetElevation: 0, attackerOnStairs: false, targetOnStairs: false })).toBe(false);
    expect(canAttackReachElevation({ attackerElevation: 1, targetElevation: 0, attackerOnStairs: true, targetOnStairs: false })).toBe(true);
    expect(canAttackReachElevation({ attackerElevation: 2, targetElevation: 0, attackerOnStairs: true, targetOnStairs: true })).toBe(false);

    const lowMob = entityHurtbox({ x: 12, y: 10, elevation: 0 }, "goblin");
    const highMob = entityHurtbox({ x: 12, y: 10, elevation: 1 }, "goblin");
    expect(projectileHitsHurtbox({ x0: 10, y0: 9.5, x1: 12.5, y1: 9.5, projectileElevation: 0, box: highMob })).toBeNull();
    expect(projectileHitsHurtbox({ x0: 10, y0: 10.15, x1: 12.5, y1: 10.15, projectileElevation: 1, box: lowMob })).not.toBeNull();
    expect(projectileHitsHurtbox({ x0: 10, y0: 9.5, x1: 12.5, y1: 9.5, projectileElevation: 0, box: lowMob })).not.toBeNull();
  });
});
