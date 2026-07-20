// Headless coverage for the ATTACK button's rest-alpha pulse — judge-panel finding: at
// the old flat 0.35 it was "so low-contrast... a first-time player likely won't find
// it". attackRestAlpha is a pure function so this doesn't need a live Phaser clock.
import { describe, expect, it } from "vitest";
import { ATTACK_PULSE_DURATION_MS, attackRestAlpha } from "./touchButtons.js";

const ATTACK_REST_ALPHA = 0.55;

describe("attackRestAlpha", () => {
  it("never dips below the raised resting alpha, even at the trough of a pulse", () => {
    for (let ms = 0; ms < ATTACK_PULSE_DURATION_MS; ms += 50) {
      expect(attackRestAlpha(ms)).toBeGreaterThanOrEqual(ATTACK_REST_ALPHA);
    }
  });

  it("stays within a subtle band above resting alpha — discoverability, not a strobe", () => {
    for (let ms = 0; ms < ATTACK_PULSE_DURATION_MS; ms += 50) {
      expect(attackRestAlpha(ms)).toBeLessThanOrEqual(ATTACK_REST_ALPHA + 0.15);
    }
  });

  it("settles flat at the resting alpha once the pulse window ends", () => {
    expect(attackRestAlpha(ATTACK_PULSE_DURATION_MS)).toBe(ATTACK_REST_ALPHA);
    expect(attackRestAlpha(ATTACK_PULSE_DURATION_MS + 60_000)).toBe(ATTACK_REST_ALPHA);
  });

  it("oscillates — the value at a pulse crest differs from the value at a trough", () => {
    const values = new Set<number>();
    for (let ms = 0; ms < 1200; ms += 100) values.add(Math.round(attackRestAlpha(ms) * 1000));
    expect(values.size).toBeGreaterThan(1);
  });

  it("is deterministic for a given elapsed time (pure function, no hidden state)", () => {
    expect(attackRestAlpha(3000)).toBe(attackRestAlpha(3000));
  });
});
