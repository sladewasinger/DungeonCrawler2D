import { type EffectEvent, type Entity } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { doAttack, stepActiveMeleeAttacks } from "../actions/melee.js";
import { spawnEnemy } from "../core/helpers.js";
import { launchSpit } from "../enemies/ai/combat.js";
import { addEnemyTestPlayer, createEnemyTestSim, findEnemyTestFloor } from "../enemies/tests/enemyAiTestSupport.js";
import { realizeEffectEvents } from "../progression/statuses.js";
import type { PlayerSlot, SimState } from "../state/state.js";
import { stepProjectiles } from "./index.js";

interface ReflectionFixture { readonly sim: SimState; readonly player: PlayerSlot; readonly enemy: Entity; readonly projectile: Entity; }

function createReflectionFixture(): ReflectionFixture {
  const sim = createEnemyTestSim();
  const spot = findEnemyTestFloor(sim);
  const player = addEnemyTestPlayer(sim, spot);
  player.weapon = "sword";
  const enemy = spawnEnemy(sim, { defId: "spitter", x: spot.x + 2.8, y: spot.y });
  enemy.body.z = player.entity.body.z;
  const enemySlot = sim.enemies.get(enemy.id);
  if (!enemySlot) throw new Error("missing Spitter fixture");
  launchSpit({ sim, enemy: enemySlot, target: player.entity.body });
  const projectile = firstProjectile(sim);
  projectile.body.x = spot.x + 2.1;
  projectile.body.y = spot.y;
  projectile.body.z = player.entity.body.z + 0.8;
  projectile.vel = { x: -10, y: 0, z: 1 };
  return { sim, player, enemy, projectile };
}

function firstProjectile(sim: SimState): Entity { const projectile = sim.projectiles.values().next().value; if (!projectile) throw new Error("missing projectile fixture"); return projectile; }

function attack(fixture: ReflectionFixture, direction = { x: 1, y: 0 }): EffectEvent[] {
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

describe("hostile projectile returns", () => {
  it("returns a nearby hostile spit with its launch-captured payload", () => {
    const fixture = createReflectionFixture();

    attack(fixture);

    expect(fixture.projectile.ownerId).toBe(fixture.player.entity.id);
    expect(fixture.projectile.returnedByPlayerId).toBe(fixture.player.entity.id);
    expect(fixture.projectile.vel).toEqual({ x: 10, y: 0, z: -1 });
    expect(fixture.projectile.directProjectileImpact).toMatchObject({
      damage: 3,
      applies: [{ status: "poisoned", chance: 0.5 }],
    });
  });

  it("leaves hostile spits outside the weapon hitbox unchanged", () => {
    const wrongArc = createReflectionFixture();
    attack(wrongArc, { x: -1, y: 0 });
    expect(wrongArc.projectile.ownerId).toBe(wrongArc.enemy.id);

    const outOfRange = createReflectionFixture();
    outOfRange.projectile.body.x = outOfRange.player.entity.body.x + 2.7;
    attack(outOfRange);
    expect(outOfRange.projectile.ownerId).toBe(outOfRange.enemy.id);
  });

  it("returns a spit that enters the active weapon hitbox after acceptance", () => {
    const fixture = createReflectionFixture();
    fixture.projectile.body.x = fixture.player.entity.body.x + 2.7;

    attack(fixture);
    expect(fixture.projectile.ownerId).toBe(fixture.enemy.id);

    fixture.sim.tickCount++;
    fixture.projectile.body.x = fixture.player.entity.body.x + 2.1;
    stepActiveMeleeAttacks(fixture.sim, []);

    expect(fixture.projectile.ownerId).toBe(fixture.player.entity.id);
  });

  it("does not return a spit that enters after the active weapon window expires", () => {
    const fixture = createReflectionFixture();
    fixture.projectile.body.x = fixture.player.entity.body.x + 2.7;

    attack(fixture);
    fixture.sim.tickCount += 4;
    fixture.projectile.body.x = fixture.player.entity.body.x + 2.1;
    stepActiveMeleeAttacks(fixture.sim, []);

    expect(fixture.projectile.ownerId).toBe(fixture.enemy.id);
  });

  it("does not return a spit from blocked or cooldown-rejected attacks", () => {
    const blocking = createReflectionFixture();
    blocking.player.blocking = true;
    attack(blocking);
    expect(blocking.projectile.ownerId).toBe(blocking.enemy.id);
    blocking.projectile.body.x = blocking.player.entity.body.x; blocking.projectile.body.y = blocking.player.entity.body.y;
    blocking.projectile.vel = { x: 0, y: 0, z: 0 };
    stepProjectiles(blocking.sim, []);
    expect(blocking.player.outbox).toContainEqual({ t: "blockFeedback", kind: "projectile" });

    const coolingDown = createReflectionFixture();
    coolingDown.player.attackReadyAtTick = coolingDown.sim.tickCount + 1;
    attack(coolingDown); expect(coolingDown.projectile.ownerId).toBe(coolingDown.enemy.id);
  });

  it("blocks from the projectile arrival line when the owner has moved", () => {
    const fixture = createReflectionFixture();
    fixture.player.blocking = true;
    fixture.player.entity.facing = { x: 1, y: 0 };
    attack(fixture);
    fixture.enemy.body.x = fixture.player.entity.body.x - 3;
    fixture.projectile.body.x = fixture.player.entity.body.x + 0.5;
    fixture.projectile.body.y = fixture.player.entity.body.y;
    fixture.projectile.vel = { x: -10, y: 0, z: 0 };

    stepProjectiles(fixture.sim, []);

    expect(fixture.player.outbox).toContainEqual({ t: "blockFeedback", kind: "projectile" });
  });

  it("does not return the same projectile twice", () => {
    const fixture = createReflectionFixture();
    attack(fixture);
    fixture.player.attackReadyAtTick = fixture.sim.tickCount;

    attack(fixture);

    expect(fixture.projectile.vel).toEqual({ x: 10, y: 0, z: -1 });
  });

  it("excludes item and oil-lob projectiles from returns", () => {
    const fixture = createReflectionFixture();
    fixture.projectile.defId = "pitchbloom-oil-lob";

    attack(fixture);

    expect(fixture.projectile.ownerId).toBe(fixture.enemy.id);
  });

  it("credits the returner and lets the returned spit hit enemies, not players", () => {
    const fixture = createReflectionFixture();
    fixture.enemy.body.x += 0.2;
    const bystander = addEnemyTestPlayer(
      fixture.sim,
      { x: fixture.enemy.body.x + 0.1, y: fixture.enemy.body.y },
      "p2",
    );
    bystander.entity.body.z = fixture.player.entity.body.z;
    fixture.sim.rng.next = () => 0;
    const events = attack(fixture);
    expect(bystander.entity.hp).toBe(bystander.entity.maxHp);
    expect(fixture.enemy.hp).toBe(fixture.enemy.maxHp);

    stepProjectiles(fixture.sim, events);
    realizeEffectEvents(fixture.sim, events);

    expect(bystander.entity.hp).toBe(bystander.entity.maxHp);
    expect(fixture.enemy.hp).toBe(fixture.enemy.maxHp - 3);
    expect(fixture.enemy.statuses).toContainEqual(expect.objectContaining({
      defId: "poisoned",
      sourceId: fixture.player.entity.id,
    }));
    expect(events).toContainEqual(expect.objectContaining({
      t: "hp",
      id: fixture.enemy.id,
      sourceId: fixture.player.entity.id,
    }));
  });
});
