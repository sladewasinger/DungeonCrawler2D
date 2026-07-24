/** Covers combat rules that change specifically when both players share a party. */
import { PLAYER_MAX_HP } from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { GameSim } from "../index.js";
import { makeParty, makeSim, teleport } from "./support.js";

describe("GameSim: party combat", () => {
  let sim: GameSim;

  beforeEach(() => {
    sim = makeSim();
  });

  it("party members deal half direct melee damage to one another", () => {
    const { aId, bId } = makeParty(sim);
    const aEntity = sim.getPlayerEntity(aId)!;
    const bEntity = sim.getPlayerEntity(bId)!;
    sim.endSpawnGrace(aId);
    sim.endSpawnGrace(bId);
    teleport(bEntity, aEntity.body.x + 1, aEntity.body.y, sim);

    sim.queueAction(aId, { type: "attack", dirX: 1, dirY: 0 });
    sim.step();

    expect(PLAYER_MAX_HP - bEntity.hp).toBe(4.5);
  });
});
