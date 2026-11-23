import { describe, expect, it } from "vitest";
import {
  computeTrackWindow, exactTracksDurationSec, fillNoiseSamples, normalizeTrackSpec,
  type ProceduralTrackSpec,
} from "./proceduralSynth.js";

function meanStepDelta(samples: Float32Array): number {
  let acc = 0;
  for (let i = 1; i < samples.length; i++) acc += Math.abs(samples[i]! - samples[i - 1]!);
  return acc / Math.max(1, samples.length - 1);
}

describe("proceduralSynth", () => {
  it("normalizes missing fields and clamps extreme timing, pan, and frequency ranges", () => {
    const t = normalizeTrackSpec({
      delaySec: -2, durationSec: 12, attackSec: 0, holdSec: 9, pan: 4, f0: 5, f1: 25000, q: 99,
    }, "fallback-1");
    expect(t.id).toBe("fallback-1");
    expect(t.noiseColor).toBe("white");
    expect(t.delaySec).toBe(0);
    expect(t.durationSec).toBe(3);
    expect(t.attackSec).toBe(0.002);
    expect(t.holdSec).toBe(2.5);
    expect(t.pan).toBe(1);
    expect(t.f0).toBe(20);
    expect(t.f1).toBe(10000);
    expect(t.q).toBe(12);
  });

  it("generates bounded white, pink, and brown noise with progressive low-frequency smoothing", () => {
    const white = new Float32Array(4096);
    const pink = new Float32Array(4096);
    const brown = new Float32Array(4096);
    fillNoiseSamples(white, "white");
    fillNoiseSamples(pink, "pink");
    fillNoiseSamples(brown, "brown");
    for (const buf of [white, pink, brown]) {
      for (const s of buf) {
        expect(Number.isFinite(s)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(-1);
        expect(s).toBeLessThanOrEqual(1);
      }
    }
    expect(meanStepDelta(brown)).toBeLessThan(meanStepDelta(pink));
    expect(meanStepDelta(pink)).toBeLessThan(meanStepDelta(white));
  });

  it("slices hold windows accurately and computes exact total duration without dead tail padding", () => {
    const tracks: ProceduralTrackSpec[] = [
      normalizeTrackSpec({ id: "c1", kind: "tone", delaySec: 0, durationSec: 0.044, attackSec: 0.008, holdSec: 0.04, f0: 2900, f1: 2680 }, "c1"),
      normalizeTrackSpec({ id: "c2", kind: "tone", delaySec: 0.075, durationSec: 0.044, attackSec: 0.008, holdSec: 0, f0: 3250, f1: 2990 }, "c2"),
      normalizeTrackSpec({ id: "c3", kind: "tone", delaySec: 0.16, durationSec: 0.05, attackSec: 0.008, holdSec: 0, f0: 3620, f1: 3400 }, "c3"),
    ];
    expect(exactTracksDurationSec(tracks)).toBeCloseTo(0.21, 5);
    const longHold = normalizeTrackSpec({ delaySec: 0.1, durationSec: 0.5, attackSec: 0.05, holdSec: 0.25 }, "h1");
    expect(computeTrackWindow(longHold, 0.05)?.holdSec).toBeCloseTo(0.25, 4);
    expect(computeTrackWindow(longHold, 0.2)?.holdSec).toBeCloseTo(0.194, 4);
    expect(computeTrackWindow(longHold, 0.45)?.holdSec).toBe(0);
  });
});
