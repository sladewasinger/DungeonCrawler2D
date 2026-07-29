import {
  TILE,
  TICK_DT,
  containsPoint,
  createBody,
  miniBossArenaForChunk,
  miniBossArenaIsStamped,
  stepBody,
  type MiniBossArenaGate,
  type MiniBossArenaSite,
  type World,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { terrainPropForTile } from "../../render/terrain/planning/tileFeatures.js";
import { resolveInteractionPrompt } from "../../scenes/dungeon/world/interactionPrompt.js";
import { applySnapshot } from "./apply.js";
import {
  freshConnection,
  snapshotAtFloor,
} from "./applyTestSupport.js";

describe("mini-boss arena gate snapshots", () => {
  it("blocks client-predicted movement while the gate is closed", () => {
    const connection = freshConnection(1);
    const world = connection.world!;
    const { arena, gate } = locateArena(world);
    const direction = gateDirection(gate);
    const body = createBody(
      gate.outside.x,
      gate.outside.y,
      world.groundAt(gate.outside.x, gate.outside.y),
    );

    for (let tick = 0; tick < 20; tick++) {
      stepBody(world, body, {
        moveX: direction.x,
        moveY: direction.y,
        jump: false,
      }, TICK_DT);
    }

    expect(containsPoint(arena.interior, body.x, body.y)).toBe(false);
    expect(world.isWalkable(gate.x, gate.y)).toBe(false);
  });

  it("removes collision, rendering, prompt, and teleport state when unlocked", () => {
    const connection = freshConnection(1);
    const world = connection.world!;
    const { gate } = locateArena(world);
    expect(world.featureAt(gate.x, gate.y)).toBe(TILE.ArenaGate);
    expect(world.isWalkable(gate.x, gate.y)).toBe(false);

    const snapshot = snapshotAtFloor(1);
    snapshot.self.x = gate.x + 0.5;
    snapshot.self.y = gate.y + 0.5;
    snapshot.miniBossArenaGates = [gate];
    applySnapshot(connection, snapshot);

    expect(world.featureAt(gate.x, gate.y)).toBe(TILE.Floor);
    expect(world.isWalkable(gate.x, gate.y)).toBe(true);
    expect(terrainPropForTile(world.featureAt(gate.x, gate.y))).toBeNull();
    expect(resolveInteractionPrompt({
      world,
      x: gate.x + 0.5,
      y: gate.y + 0.5,
      items: [],
    })).toBeNull();
    expect(connection.teleported).toBe(false);
  });
});

interface LocatedArena {
  readonly arena: MiniBossArenaSite;
  readonly gate: MiniBossArenaGate;
}

function locateArena(world: World): LocatedArena {
  for (let cy = -10; cy <= 10; cy++) {
    for (let cx = -10; cx <= 10; cx++) {
      const arena = miniBossArenaForChunk({
        worldSeed: world.worldSeed,
        floor: world.floor,
        cx,
        cy,
      });
      const gate = arena?.gates[0];
      if (arena && gate && miniBossArenaIsStamped(world, arena)) {
        return { arena, gate };
      }
    }
  }
  throw new Error("test world produced no mini-boss arena");
}

function gateDirection(
  gate: MiniBossArenaGate,
): { readonly x: number; readonly y: number } {
  const dx = gate.inside.x - gate.outside.x;
  const dy = gate.inside.y - gate.outside.y;
  const distance = Math.hypot(dx, dy);
  return { x: dx / distance, y: dy / distance };
}
