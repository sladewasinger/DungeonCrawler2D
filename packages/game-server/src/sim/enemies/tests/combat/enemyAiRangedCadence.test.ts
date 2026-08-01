// Owns focused ordinary ranged cadence, variation, cancellation, and payload regressions.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { spawnEnemy } from "../../../core/helpers.js";
import type { SimState } from "../../../state/state.js";
import { launchSpit } from "../../ai/combat.js";
import { stepEnemies } from "../../index.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
} from "../enemyAiTestSupport.js";
import {
  advanceFirstRangedRelease,
  advancePendingRangedRelease,
  advancePostRecoveryThinking,
  advanceRangedRecovery,
  collectRangedReleaseTicks,
  expectRangedPayload,
} from "./enemyAiCommittedAnimationSupport.js";

const SPITTER_DEF_ID = "spitter";
const ORC_SHAMAN_DEF_ID = "orc-shaman";

describe("ordinary ranged cadence", () => {
  let sim: SimState;
  let spot: { x: number; y: number };

  beforeEach(() => {
    sim = createEnemyTestSim();
    spot = findEnemyTestFloor(sim);
    addEnemyTestPlayer(sim, spot);
  });

  it.each([
    [SPITTER_DEF_ID, 1], [SPITTER_DEF_ID, 2],
    [ORC_SHAMAN_DEF_ID, 1], [ORC_SHAMAN_DEF_ID, 2],
  ] as const)("%s releases exactly %d projectiles with its payload", (defId, length) => {
    vi.spyOn(sim.rng, "int").mockReturnValue(length);
    const variationDraws = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(0.25).mockReturnValueOnce(1);
    const enemyEntity = spawnEnemy(sim, { defId, x: spot.x + 4, y: spot.y });
    const enemy = sim.enemies.get(enemyEntity.id);
    if (!enemy) throw new Error(`missing ${defId} fixture`);
    sim.rng.next = variationDraws;

    advanceFirstRangedRelease(sim);
    const cooldown = enemy.brain.attackCooldown;
    expect(enemy.animation.state).toBe("spit");
    expect(enemy.animation.releasesRemaining).toBe(length === 2 ? 1 : undefined);
    expect(enemy.brain.attackCooldown).toBe(cooldown);
    expect(sim.projectiles.size).toBe(1);
    const firstProjectile = [...sim.projectiles.values()][0];
    expect(variationDraws).toHaveBeenCalledTimes(2);
    expect(firstProjectile?.vel).toBeDefined();
    if (length === 2) {
      advancePendingRangedRelease(sim);
      expect(sim.projectiles.size).toBe(2);
      expect(enemy.animation.releasesRemaining).toBeUndefined();
      const secondProjectile = [...sim.projectiles.values()][1];
      expect(variationDraws).toHaveBeenCalledTimes(4);
      expect(secondProjectile?.vel).not.toEqual(firstProjectile?.vel);
    }
    expectRangedPayload(sim, enemy, enemyEntity.id);
    advanceRangedRecovery(sim);
    expect(enemy.brain.attackCooldown).toBe(cooldown);
    advancePostRecoveryThinking(sim, enemy, cooldown);
    expect(enemy.brain.attackCooldown).toBeLessThan(cooldown);
    expect(enemy.animation.state).not.toBe("windup");
  });

  it("applies ordinary landing variation to the authored ranged target", () => {
    const enemyEntity = spawnEnemy(sim, { defId: SPITTER_DEF_ID, x: spot.x + 4, y: spot.y });
    const enemy = sim.enemies.get(enemyEntity.id);
    if (!enemy) throw new Error("missing ordinary projectile fixture");
    const target = { x: spot.x, y: spot.y, z: sim.world.groundAt(spot.x, spot.y) };
    const variationDraws = vi.fn()
      .mockReturnValueOnce(0).mockReturnValueOnce(0)
      .mockReturnValueOnce(0.25).mockReturnValueOnce(1);
    sim.rng.next = variationDraws;

    launchSpit({ sim, enemy, target });
    launchSpit({ sim, enemy, target });

    const [centered, edge] = [...sim.projectiles.values()];
    const centeredVelocity = centered?.vel;
    const edgeVelocity = edge?.vel;
    if (!centeredVelocity || !edgeVelocity) throw new Error("missing variation projectiles");
    expect(centeredVelocity.y).toBe(0);
    expect(edgeVelocity.y).toBeCloseTo(10 * 0.2 / Math.hypot(4, 0.2), 10);
    expect(Math.hypot(edgeVelocity.x, edgeVelocity.y)).toBeCloseTo(10, 10);
    expect(variationDraws).toHaveBeenCalledTimes(4);
  });

  it.each([SPITTER_DEF_ID, ORC_SHAMAN_DEF_ID] as const)(
    "%s keeps ordinary release two exactly 10 simulation steps after release one",
    (defId) => {
      vi.spyOn(sim.rng, "int").mockReturnValue(2);
      spawnEnemy(sim, { defId, x: spot.x + 4, y: spot.y });

      const releaseTicks = collectRangedReleaseTicks(sim, 2);

      expect(releaseTicks).toHaveLength(2);
      expect(releaseTicks[1]! - releaseTicks[0]!).toBe(10);
    },
  );

  it.each([SPITTER_DEF_ID, ORC_SHAMAN_DEF_ID] as const)(
    "%s cancels a pending release after target invalidation",
    (defId) => {
      vi.spyOn(sim.rng, "int").mockReturnValue(2);
      const entity = spawnEnemy(sim, { defId, x: spot.x + 4, y: spot.y });
      const enemy = sim.enemies.get(entity.id);
      const player = sim.players.get("p1");
      if (!enemy || !player) throw new Error(`missing ${defId} target`);
      const variationDraws = vi.fn(() => 0.5);
      sim.rng.next = variationDraws;
      advanceFirstRangedRelease(sim);
      expect(variationDraws).toHaveBeenCalledTimes(2);
      enemy.animation.ticksRemaining = 0;
      player.connected = false;
      stepEnemies(sim, []);
      expect(sim.projectiles.size).toBe(1);
      expect(enemy.animation.state).toBe("recover");
      expect(variationDraws).toHaveBeenCalledTimes(2);
    },
  );
});
