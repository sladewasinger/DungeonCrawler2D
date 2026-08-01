import { GRAVITY, PROJECTILE_CONTACT_RADIUS, TICK_DT, combatHurtboxBounds, type EffectEvent, type Entity } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { doAttack } from "../actions/melee.js";
import { spawnEnemy } from "../core/helpers.js";
import { launchSpit } from "../enemies/ai/combat.js";
import { addEnemyTestPlayer, createEnemyTestSim, findEnemyTestFloor } from "../enemies/tests/enemyAiTestSupport.js";
import type { PlayerSlot, SimState } from "../state/state.js";
import { stepProjectiles } from "./index.js";
import { realizeEffectEvents } from "../progression/statuses.js";

interface ReflectionFixture {
  readonly sim: SimState;
  readonly player: PlayerSlot;
  readonly enemy: Entity;
  readonly projectile: Entity;
}

type ReflectionSpotSelector = (sim: SimState) => { readonly x: number; readonly y: number };

function createReflectionFixture(
  selectSpot: ReflectionSpotSelector = findEnemyTestFloor,
): ReflectionFixture {
  const sim = createEnemyTestSim();
  const spot = selectSpot(sim);
  const player = addEnemyTestPlayer(sim, spot);
  player.weapon = "sword";
  const enemy = spawnEnemy(sim, {
    defId: "spitter",
    x: spot.x + 2.8,
    y: spot.y,
  });
  enemy.body.z = player.entity.body.z;
  const enemySlot = sim.enemies.get(enemy.id);
  if (!enemySlot) throw new Error("missing Spitter fixture");
  launchSpit({ sim, enemy: enemySlot, target: player.entity.body });
  const projectile = sim.projectiles.values().next().value;
  if (!projectile) throw new Error("missing projectile fixture");
  projectile.vel = { x: -10, y: 0, z: 1 };
  return { sim, player, enemy, projectile };
}

function findFlatNorthApproach(sim: SimState): { x: number; y: number } {
  for (let x = 136; x < 264; x++) {
    for (let y = 136; y < 264; y++) {
      if (isFlatNorthApproach(sim, x, y)) return { x: x + 0.5, y: y + 0.5 };
    }
  }
  throw new Error("missing flat north projectile approach");
}

function isFlatNorthApproach(sim: SimState, x: number, y: number): boolean {
  const ground = sim.world.groundAt(x + 0.5, y + 0.5);
  return [0, -1, -2, -3].every((offset) =>
    sim.world.isWalkable(x, y + offset) &&
    sim.world.groundAt(x + 0.5, y + offset + 0.5) === ground);
}

function attack(
  fixture: ReflectionFixture,
  direction: { readonly x: number; readonly y: number },
): EffectEvent[] {
  const events: EffectEvent[] = [];
  doAttack({
    sim: fixture.sim,
    slot: fixture.player,
    dirX: direction.x,
    dirY: direction.y,
    effectEvents: events,
  });
  return events;
}

function placeProjectile(
  fixture: ReflectionFixture,
  offset: { readonly x: number; readonly y: number; readonly z?: number },
): void {
  fixture.projectile.body.x = fixture.player.entity.body.x + offset.x;
  fixture.projectile.body.y = fixture.player.entity.body.y + offset.y;
  fixture.projectile.body.z = fixture.player.entity.body.z + (offset.z ?? 0.8);
}

describe("hostile projectile return positioning", () => {
  it("reconciles elevated rendered aim to the horizontal body direction", () => {
    const visible = createReflectionFixture();
    placeProjectile(visible, { x: 1, y: 0.625, z: 1.25 });
    const renderedDirection = { x: 1, y: -0.625 };
    const renderedBodyZ = visible.projectile.body.z;
    attack(visible, renderedDirection);
    expect(visible.projectile.ownerId).toBe(visible.enemy.id);

    const corrected = createReflectionFixture();
    placeProjectile(corrected, { x: 1, y: 0.625, z: 1.25 });
    const authoritativeDirection = {
      x: corrected.projectile.body.x - corrected.player.entity.body.x,
      y: corrected.projectile.body.y - corrected.player.entity.body.y,
    };
    expect(corrected.projectile.body.z).toBe(renderedBodyZ);
    attack(corrected, authoritativeDirection);
    expect(corrected.projectile.ownerId).toBe(corrected.player.entity.id);
  });

  it("returns inline and offset screen-north spits inside the sword volume", () => {
    const inline = createReflectionFixture();
    placeProjectile(inline, { x: 0, y: -2.1 });
    attack(inline, { x: 0, y: -1 });
    expect(inline.projectile.ownerId).toBe(inline.player.entity.id);

    const offsetInside = createReflectionFixture();
    placeProjectile(offsetInside, { x: 0.35, y: -2.0 });
    attack(offsetInside, { x: 0, y: -1 });
    expect(offsetInside.projectile.ownerId).toBe(offsetInside.player.entity.id);
  });

  it("leaves a screen-north angular near-miss unchanged", () => {
    const fixture = createReflectionFixture();
    placeProjectile(fixture, { x: 2, y: -1.15 });
    attack(fixture, { x: 0, y: -1 });

    expect(fixture.projectile.ownerId).toBe(fixture.enemy.id);
  });

  it("returns a screen-north spit that enters the active sword volume during its step", () => {
    const fixture = createReflectionFixture(findFlatNorthApproach);
    placeProjectile(fixture, { x: 0, y: -2.4 });
    fixture.projectile.vel = { x: 0, y: 10, z: 0 };

    const events = attack(fixture, { x: 0, y: -1 });
    stepProjectiles(fixture.sim, events);

    expect(fixture.projectile.ownerId).toBe(fixture.player.entity.id);
    expect(fixture.projectile.vel).toEqual({
      x: 0,
      y: -10,
      z: GRAVITY * TICK_DT,
    });
    expect(fixture.sim.projectiles.has(fixture.projectile.id)).toBe(true);
  });

  it("returns only a projectile volume that reaches the sword's vertical band", () => {
    const tangent = createReflectionFixture();
    placeProjectile(tangent, { x: 2.1, y: 0, z: 1.25 });
    attack(tangent, { x: 1, y: 0 });
    expect(tangent.projectile.ownerId).toBe(tangent.player.entity.id);

    const above = createReflectionFixture();
    placeProjectile(above, { x: 2.1, y: 0, z: 1.251 });
    attack(above, { x: 1, y: 0 });
    expect(above.projectile.ownerId).toBe(above.enemy.id);
  });

  it("uses the lowered player top for direct contact without changing reflection height", () => {
    const high = createReflectionFixture(); const contactTangent = combatHurtboxBounds(high.player.entity).maxZ + PROJECTILE_CONTACT_RADIUS;
    const highZ = contactTangent + 0.1;
    expect(highZ).toBeGreaterThan(contactTangent); placeProjectile(high, { x: 0, y: 0, z: highZ - high.player.entity.body.z });
    high.projectile.vel = { x: 0, y: 0, z: 0 };
    const highEvents: EffectEvent[] = []; stepProjectiles(high.sim, highEvents); realizeEffectEvents(high.sim, highEvents);
    expect(high.sim.projectiles.has(high.projectile.id)).toBe(true);
    expect(high.player.entity.hp).toBe(high.player.entity.maxHp);

    const inBand = createReflectionFixture(); const inBandTangent = combatHurtboxBounds(inBand.player.entity).maxZ + PROJECTILE_CONTACT_RADIUS;
    const inBandZ = inBandTangent - 0.1;
    expect(inBandZ).toBeLessThan(inBandTangent); placeProjectile(inBand, { x: 0, y: 0, z: inBandZ - inBand.player.entity.body.z });
    inBand.projectile.vel = { x: 0, y: 0, z: 0 };
    const inBandEvents: EffectEvent[] = []; stepProjectiles(inBand.sim, inBandEvents); realizeEffectEvents(inBand.sim, inBandEvents);
    expect(inBand.sim.projectiles.has(inBand.projectile.id)).toBe(false);
    expect(inBand.player.entity.hp).toBe(inBand.player.entity.maxHp - 3);

  });
});
