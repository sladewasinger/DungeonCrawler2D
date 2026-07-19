// Headless tests for the server-anim -> Phaser-anim/telegraph mapper — no Phaser involved.
import { describe, expect, it } from "vitest";
import { resolveAnimState, telegraphScale, telegraphTint } from "./animState.js";

describe("resolveAnimState", () => {
  it("plays the idle loop for idle and recover", () => {
    expect(resolveAnimState("skelet", "idle")).toEqual({ animKey: "skelet_idle", telegraph: "none" });
    expect(resolveAnimState("skelet", "recover")).toEqual({ animKey: "skelet_idle", telegraph: "none" });
  });

  it("plays the run loop for walk", () => {
    expect(resolveAnimState("skelet", "walk")).toEqual({ animKey: "skelet_run", telegraph: "none" });
  });

  it("telegraphs windup and the ranged spit wind-up on the idle loop", () => {
    expect(resolveAnimState("imp", "windup")).toEqual({ animKey: "imp_idle", telegraph: "windup" });
    expect(resolveAnimState("imp", "spit")).toEqual({ animKey: "imp_idle", telegraph: "windup" });
  });

  it("punches the run loop for attack", () => {
    expect(resolveAnimState("skelet", "attack")).toEqual({ animKey: "skelet_run", telegraph: "strike" });
  });
});

describe("telegraphScale", () => {
  it("stays at 1 for no telegraph", () => {
    expect(telegraphScale("none", 0)).toBe(1);
    expect(telegraphScale("none", 500)).toBe(1);
  });

  it("oscillates around 1 within the pulse amplitude for windup", () => {
    const samples = [0, 55, 110, 165, 220, 330].map((ms) => telegraphScale("windup", ms));
    for (const scale of samples) {
      expect(scale).toBeGreaterThanOrEqual(0.87);
      expect(scale).toBeLessThanOrEqual(1.13);
    }
    expect(Math.max(...samples)).toBeGreaterThan(Math.min(...samples));
  });

  it("punches above 1 immediately and decays back to 1 by the strike duration", () => {
    expect(telegraphScale("strike", 0)).toBeCloseTo(1.22, 2);
    expect(telegraphScale("strike", 160)).toBeCloseTo(1, 5);
    expect(telegraphScale("strike", 400)).toBe(1);
  });
});

describe("telegraphTint", () => {
  it("is null when there is nothing to telegraph", () => {
    expect(telegraphTint("none")).toBeNull();
  });

  it("returns the warm glow color for windup and strike", () => {
    expect(telegraphTint("windup")).toBe(0xffb37a);
    expect(telegraphTint("strike")).toBe(0xffb37a);
  });
});
