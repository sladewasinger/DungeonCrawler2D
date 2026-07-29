import { describe, expect, it } from "vitest";
import { newBrain } from "./ai.js";
import {
  ageEnemyMemory,
  beginEnemySearch,
} from "./enemyMemory.js";

describe("enemy search timer", () => {
  it("starts once and is not reset by later waypoint events", () => {
    const brain = newBrain();
    brain.rememberedTarget = {
      targetId: "hidden-player",
      x: 0.5,
      y: 0.5,
      z: 0,
    };
    brain.memorySecondsRemaining = 20;
    beginEnemySearch(brain, 20);
    ageEnemyMemory(brain, 4);
    beginEnemySearch(brain, 20);
    expect(brain.memorySearchSecondsRemaining).toBe(16);
  });
});
