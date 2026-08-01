// Owns the admin-portal enemy spawn and live-target behavior regression coverage.
import { describe, expect, it } from "vitest";
import { FloorRegistry } from "../../floors/floorRegistry.js";
import { GameSim } from "../../sim/core/index.js";
import { ENEMY_SIMULATION_TUNING } from "../../sim/enemies/configuration/enemySimulationTuning.js";
import {
  content,
  findFlatArena,
  findFlatFloor,
  makeSim,
  stepN,
  teleport,
  SEED,
} from "../../sim/integration/support.js";
import { PlayerStore } from "../../store.js";
import {
  executeAdminWorldCommand,
  type AdminWorldContext,
} from "./worldCommands.js";
import { newSpectatorSession } from "./spectator/spectatorSession.js";

describe("admin portal enemy behavior", () => {
  it("launches an admin-spawned Pitchbloom at a live player on the selected floor", () => {
    const sim = makeSim();
    const joined = sim.addPlayer({ name: "Target", clientId: "portal-target" });
    const arena = findFlatArena({ sim, anchor: joined.spawn, clearance: 4 });
    const player = sim.getPlayerEntity(joined.playerId);
    if (!player) throw new Error("missing portal target");
    teleport({ sim, entity: player, x: arena.x, y: arena.y });
    sim.endSpawnGrace(joined.playerId);

    const result = spawnPitchbloom(sim, { x: arena.x + 4, y: arena.y });
    const snapshots = stepN(sim, 6);

    expect(result).toMatchObject({ ok: true });
    expect(snapshots.get(joined.playerId)?.entities.some((entity) =>
      entity.kind === "projectile",
    )).toBe(true);
  });

  it("leaves a portal-spawned Pitchbloom idle until the selected floor has a target", () => {
    const sim = makeSim();
    const pitchbloom = content.enemies.get("pitchbloom");
    if (!pitchbloom) throw new Error("missing Pitchbloom definition");
    const joined = sim.addPlayer({ name: "Observer", clientId: "portal-observer" });
    const arena = findFlatArena({
      sim,
      anchor: joined.spawn,
      clearance: 4,
    });
    const enemyPoint = findFlatFloor(
      sim,
      arena.x + pitchbloom.aggroRadius * 2,
      arena.y,
    );
    const player = sim.getPlayerEntity(joined.playerId);
    if (!player) throw new Error("missing portal observer");
    teleport({ sim, entity: player, x: arena.x, y: arena.y });
    sim.endSpawnGrace(joined.playerId);

    const result = spawnPitchbloom(sim, {
      x: enemyPoint.x,
      y: enemyPoint.y,
    });
    const snapshots = Array.from({
      length: ENEMY_SIMULATION_TUNING.animationTicks.rangedWindup + 2,
    }, () => sim.step().get(joined.playerId));
    const enemySnapshots = snapshots
      .filter((snapshot): snapshot is NonNullable<typeof snapshot> => snapshot !== undefined)
      .map((snapshot) => snapshot.entities.find((entity) =>
        entity.kind === "enemy" && entity.defId === "pitchbloom",
      ));

    expect(result).toMatchObject({ ok: true });
    expect(enemySnapshots.some((enemy) => enemy !== undefined)).toBe(true);
    expect(enemySnapshots.every((enemy) =>
      enemy?.anim !== "windup" && enemy?.anim !== "spit",
    )).toBe(true);
    expect(snapshots.every((snapshot) =>
      !snapshot?.entities.some((entity) => entity.kind === "projectile"),
    )).toBe(true);
  });
});

function spawnPitchbloom(
  sim: GameSim,
  point: { readonly x: number; readonly y: number },
) {
  return executeAdminWorldCommand({
    context: adminWorldContext(sim),
    spectator: newSpectatorSession(),
    command: {
      op: "spawn",
      level: "sandbox",
      floor: sim.world.floor,
      kind: "enemy",
      defId: "pitchbloom",
      x: point.x,
      y: point.y,
    },
  });
}

function adminWorldContext(sim: GameSim): AdminWorldContext {
  return {
    floors: new FloorRegistry({
      worldSeed: SEED,
      content,
      store: new PlayerStore(null),
      rngSeedBase: 19,
      opts: {},
    }),
    sandbox: sim,
    combatSandbox: undefined,
  };
}
