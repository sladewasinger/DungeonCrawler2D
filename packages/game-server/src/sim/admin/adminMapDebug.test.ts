import {
  createDebugFlags,
  createBody,
  makeEntity,
  PLAYER_HURTBOX,
  PROJECTILE_CONTACT_RADIUS,
} from "@dc2d/engine";
import { describe, expect, it, vi } from "vitest";
import {
  advanceMeleeTick,
  attack,
  createMeleeFixture,
  spawnSpitter,
} from "../actions/melee/testSupport.js";
import { MELEE_HITBOX_TIMING } from "../actions/melee/meleeHitboxTuning.js";
import { activeMeleeAttackFor } from "../state/meleeAttackState.js";
import { adminDebugEntities, adminMap } from "./adminMap.js";

describe("admin map debug projection", () => {
  it("projects the live player attack from its authoritative combat profile", () => {
    const fixture = createMeleeFixture();
    attack(fixture);

    const entity = mapEntityForPlayer(fixture);
    const activeAttack = activeMeleeAttackFor(fixture.player);
    if (!activeAttack) throw new Error("expected active melee attack");

    expect(entity.debug).toMatchObject({
      hurtbox: { ...PLAYER_HURTBOX },
    });
    expect(entity.debug?.attacks).toEqual([{
      shape: "cone",
      direction: activeAttack.direction,
      range: activeAttack.profile.range,
      arcCos: activeAttack.profile.arcCos,
      strikeHeightOffset: 0.5,
      verticalHalfExtent: 0.5,
    }]);
  });

  it("resolves a final late contact and removes its debug hitbox that tick", () => {
    const fixture = createMeleeFixture();
    const enemy = spawnSpitter(fixture, 8);
    const startedAtTick = fixture.sim.tickCount;
    attack(fixture);
    for (let offset = 1; offset < MELEE_HITBOX_TIMING.lastResolutionOffsetTicks; offset++) {
      advanceMeleeTick(fixture, startedAtTick + offset);
    }
    enemy.body.x = fixture.player.entity.body.x + 1;
    enemy.body.y = fixture.player.entity.body.y;
    const hpBeforeContact = enemy.hp;

    advanceMeleeTick(
      fixture,
      startedAtTick + MELEE_HITBOX_TIMING.lastResolutionOffsetTicks,
    );

    expect(enemy.hp).toBeLessThan(hpBeforeContact);
    expect(activeMeleeAttackFor(fixture.player)).toBeUndefined();
    expect(mapEntityForPlayer(fixture).debug?.attacks).toBeUndefined();
  });

  it("includes projectile attacks only in a private active-admin diagnostic map", () => {
    const fixture = createMeleeFixture();
    const body = fixture.player.entity.body;
    const projectile = makeEntity("projectile", createBody(body.x + 0.5, body.y, body.z), {
      id: "debug-projectile",
      directProjectileImpact: { damage: 2, applies: [] },
    });
    fixture.sim.projectiles.set(projectile.id, projectile);

    const publicMap = adminMap(fixture.sim, {
      x: projectile.body.x,
      y: projectile.body.y,
    });
    const diagnosticMap = adminMap(fixture.sim, {
      x: projectile.body.x,
      y: projectile.body.y,
      includeProjectileDiagnostics: true,
    });
    const entity = diagnosticMap.entities.find((candidate) => candidate.id === projectile.id);

    expect(publicMap.entities.some((candidate) => candidate.id === projectile.id)).toBe(false);
    expect(entity).toMatchObject({
      kind: "projectile",
      debug: { attacks: [{ shape: "circle", radius: PROJECTILE_CONTACT_RADIUS }] },
    });
  });

  it("projects an enemy's authored rectangular hurtbox without approximation", () => {
    const fixture = createMeleeFixture();
    const enemy = spawnSpitter(fixture, 1);
    enemy.combatHurtbox = { halfWidth: 0.8, halfDepth: 0.45 };

    const entity = adminMap(fixture.sim, {
      x: enemy.body.x,
      y: enemy.body.y,
    }).entities.find((candidate) => candidate.id === enemy.id);

    expect(entity?.debug?.hurtbox).toEqual({
      halfWidth: 0.8,
      halfDepth: 0.45,
      height: 1.0833333333,
      bottomOffset: 0.0416666667,
    });
  });

  it("builds active-admin entities without terrain cells or disabled fields", () => {
    const fixture = createMeleeFixture();
    attack(fixture);
    const heightAt = vi.spyOn(fixture.sim.world, "heightAt");
    const flags = { ...createDebugFlags(), attacks: true };
    const body = fixture.player.entity.body;

    const entities = adminDebugEntities(fixture.sim, {
      x: body.x,
      y: body.y,
      radius: 16,
      flags,
    });
    const entity = entities.find((candidate) => candidate.id === fixture.player.entity.id);

    expect(heightAt).not.toHaveBeenCalled();
    expect(entity?.debug).toEqual({
      attacks: [{
        shape: "cone",
        direction: { x: 1, y: 0 },
        range: 2,
        arcCos: expect.any(Number),
        strikeHeightOffset: 0.5,
        verticalHalfExtent: 0.5,
      }],
    });
  });

  it("projects a persistent equipped-weapon preview without an active attack", () => {
    const fixture = createMeleeFixture();
    const flags = { ...createDebugFlags(), hitboxPreview: true };
    const body = fixture.player.entity.body;

    const entities = adminDebugEntities(fixture.sim, {
      x: body.x,
      y: body.y,
      radius: 16,
      flags,
    });
    const entity = entities.find((candidate) => candidate.id === fixture.player.entity.id);

    expect(entity?.debug?.attacks).toEqual([{
      shape: "cone",
      direction: { x: 1, y: 0 },
      range: 2,
      arcCos: expect.any(Number),
      strikeHeightOffset: 0.5,
      verticalHalfExtent: 0.5,
      preview: true,
    }]);
  });
});

function mapEntityForPlayer(fixture: ReturnType<typeof createMeleeFixture>) {
  const body = fixture.player.entity.body;
  return adminMap(fixture.sim, { x: body.x, y: body.y }).entities
    .find((entity) => entity.id === fixture.player.entity.id)!;
}
