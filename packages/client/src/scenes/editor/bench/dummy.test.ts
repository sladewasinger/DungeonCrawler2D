// The regenerating training-dummy target (Epic 7.11 assumption #27).
import { describe, expect, it } from "vitest";
import { createDummy, DUMMY_MAX_HP, tickDummyRegen } from "./dummy.js";

describe("training dummy regen", () => {
  it("spawns at full hp", () => {
    const dummy = createDummy(10, 10);
    expect(dummy.hp).toBe(DUMMY_MAX_HP);
    expect(dummy.kind).toBe("player");
  });

  it("regenerates back toward max over time, capped at max", () => {
    const dummy = createDummy(10, 10);
    dummy.hp = 10;
    tickDummyRegen(dummy, 5); // 1 hp/s * 5s
    expect(dummy.hp).toBe(15);
    tickDummyRegen(dummy, 1000);
    expect(dummy.hp).toBe(DUMMY_MAX_HP);
  });

  it("regenerates even from 0 — a dummy dips, it never actually dies", () => {
    const dummy = createDummy(10, 10);
    dummy.hp = 0;
    tickDummyRegen(dummy, 2);
    expect(dummy.hp).toBe(2);
  });
});
