import {
  CHUNK_SIZE,
  ENEMY_ACTIVE_RADIUS,
  KNOCKBACK_FORCE,
  THROW_SPEED,
  TICK_DT,
  applyKnockback,
  createBody,
  enemyThink,
  faceEntity,
  isRoomChunk,
  LEVEL,
  launchVelocity,
  makeEntity,
  newEntityId,
  platformLootSpots,
  stepBody,
  TILE,
  type EffectEvent,
} from "@dc2d/engine";
import { spawnEnemy, spawnItem } from "./helpers";
import type { EnemySlot, SimState } from "./state";
import { populateTestZoneChunk } from "./testzone";

/** Loot table for ruin-platform tops — a reason to make the jump. */
const PLATFORM_LOOT: string[] = ["bandage", "torch", "vodka-bottle", "knife", "water-flask"];
const SPITTER_WINDUP_TICKS = 5;
const SPITTER_SPIT_TICKS = 2;
const SPITTER_RECOVER_TICKS = 3;

/** Enemy population (chunk activation) and per-tick AI. */

export function activateChunksNearPlayers(sim: SimState): void {
  if (sim.world.level === LEVEL.Sandbox && !sim.opts.testFixtures) return;
  for (const slot of sim.players.values()) {
    const ccx = Math.floor(slot.entity.body.x / CHUNK_SIZE);
    const ccy = Math.floor(slot.entity.body.y / CHUNK_SIZE);
    for (let cy = ccy - 1; cy <= ccy + 1; cy++) {
      for (let cx = ccx - 1; cx <= ccx + 1; cx++) {
        const chunkKey = `${cx},${cy}`;
        if (sim.activatedChunks.has(chunkKey)) continue;
        sim.activatedChunks.add(chunkKey);
        populateChunk(sim, cx, cy);
      }
    }
  }
}

function populateChunk(sim: SimState, cx: number, cy: number): void {
  if (isRoomChunk(cy)) return;
  if (sim.world.level === LEVEL.Sandbox) {
    if (sim.opts.testFixtures) populateTestZoneChunk(sim, cx, cy);
    return;
  }

  // Ruin platforms carry loot on their tops — climbing pays.
  for (const spot of platformLootSpots(sim.world.worldSeed, sim.world.floor, cx, cy)) {
    if (sim.rng.next() < 0.6) {
      const def = PLATFORM_LOOT[Math.floor(sim.rng.next() * PLATFORM_LOOT.length)]!;
      spawnItem(sim, def, spot.x, spot.y, 1);
    }
  }

  if (sim.enemies.size > 150) return;
  const table: Array<[string, number]> = [
    ["slime", 0.4],
    ["plant-creeper", 0.25],
    ["skeleton", 0.2],
    ["spitter", 0.15],
  ];
  const count = 2 + Math.floor(sim.rng.next() * 3);
  for (let n = 0; n < count; n++) {
    const wx = cx * CHUNK_SIZE + Math.floor(sim.rng.next() * CHUNK_SIZE);
    const wy = cy * CHUNK_SIZE + Math.floor(sim.rng.next() * CHUNK_SIZE);
    if (!sim.world.isWalkable(wx, wy) || sim.world.isSanctuary(wx, wy)) continue;
    // Enemies can't jump — don't strand spawns on wall tops.
    if (sim.world.tileAt(wx, wy) === TILE.Wall) continue;
    let tooClose = false;
    for (const slot of sim.players.values()) {
      if (Math.hypot(slot.entity.body.x - wx, slot.entity.body.y - wy) < 12) tooClose = true;
    }
    if (tooClose) continue;
    let roll = sim.rng.next();
    let pick = table[0]![0];
    for (const [defId, weight] of table) {
      if (roll < weight) {
        pick = defId;
        break;
      }
      roll -= weight;
    }
    spawnEnemy(sim, pick, wx + 0.5, wy + 0.5);
  }
}

export function stepEnemies(sim: SimState, effectEvents: EffectEvent[]): void {
  const players = [...sim.players.values()]
    .filter((s) => s.entity.hp > 0)
    .map((s) => s.entity);
  for (const enemy of sim.enemies.values()) {
    const entity = enemy.entity;
    if (entity.hp <= 0) continue; // corpses don't bite
    // Freeze enemies far from everyone.
    let near = false;
    for (const p of players) {
      if (
        Math.abs(p.body.x - entity.body.x) < ENEMY_ACTIVE_RADIUS &&
        Math.abs(p.body.y - entity.body.y) < ENEMY_ACTIVE_RADIUS
      ) {
        near = true;
        break;
      }
    }
    if (!near) continue;

    if (advanceRangedAttack(sim, enemy)) continue;

    const decision = enemyThink(
      enemy.brain,
      entity,
      enemy.def,
      players,
      (e) => sim.effects.inSanctuary(e),
      TICK_DT,
      () => sim.rng.next(),
    );
    if (decision.shoot) {
      faceEntity(entity, decision.shoot.x - entity.body.x, decision.shoot.y - entity.body.y);
      enemy.animation = {
        state: "windup",
        ticksRemaining: SPITTER_WINDUP_TICKS,
        target: { x: decision.shoot.x, y: decision.shoot.y, z: decision.shoot.z },
      };
      continue;
    }
    faceEntity(entity, decision.move.moveX, decision.move.moveY);
    stepBody(sim.world, entity.body, decision.move, TICK_DT, {
      speed: entity.baseSpeed * sim.effects.speedMult(entity),
      // Enemies never set foot on sanctuary ground.
      blocked: (x, y) => sim.world.isSanctuary(x, y),
    });
    enemy.animation = {
      state: decision.move.moveX !== 0 || decision.move.moveY !== 0 ? "walk" : "idle",
      ticksRemaining: 0,
    };
    if (decision.strike) {
      const victim = sim.players.get(decision.strike.targetId)?.entity;
      if (victim && victim.hp > 0) {
        faceEntity(entity, victim.body.x - entity.body.x, victim.body.y - entity.body.y);
        const d = Math.hypot(victim.body.x - entity.body.x, victim.body.y - entity.body.y);
        if (d <= enemy.def.attack.range + 0.3) {
          sim.effects.modifyHealth(victim, -enemy.def.attack.damage, effectEvents, {
            sourceTags: enemy.def.tags,
          });
          for (const apply of enemy.def.attack.applies ?? []) {
            if (sim.rng.next() < apply.chance) {
              sim.effects.applyStatus(victim, apply.status, effectEvents);
            }
          }
          applyKnockback(
            victim.body,
            victim.body.x - entity.body.x,
            victim.body.y - entity.body.y,
            KNOCKBACK_FORCE * 0.6,
          );
        }
      }
    }
  }
}

function advanceRangedAttack(sim: SimState, enemy: EnemySlot): boolean {
  if (!enemy.def.attack.ranged || enemy.animation.state === "idle" || enemy.animation.state === "walk") {
    return false;
  }
  enemy.animation.ticksRemaining -= 1;
  if (enemy.animation.ticksRemaining > 0) return true;
  if (enemy.animation.state === "windup") {
    const target = enemy.animation.target;
    if (target) launchSpit(sim, enemy.entity, enemy.def.tags, target);
    enemy.animation = { state: "spit", ticksRemaining: SPITTER_SPIT_TICKS, target };
    return true;
  }
  if (enemy.animation.state === "spit") {
    enemy.animation = { state: "recover", ticksRemaining: SPITTER_RECOVER_TICKS };
    return true;
  }
  enemy.animation = { state: "idle", ticksRemaining: 0 };
  return true;
}

function launchSpit(
  sim: SimState,
  entity: EnemySlot["entity"],
  tags: readonly string[],
  target: { x: number; y: number; z: number },
): void {
  const projectile = makeEntity(
    "projectile",
    createBody(entity.body.x, entity.body.y, entity.body.z + 0.5),
    {
      id: newEntityId("j"),
      ownerId: entity.id,
      tags: new Set(["spit", ...tags]),
      vel: launchVelocity(
        { x: entity.body.x, y: entity.body.y, z: entity.body.z + 0.5 },
        target,
        THROW_SPEED,
      ),
    },
  );
  sim.projectiles.set(projectile.id, projectile);
}
