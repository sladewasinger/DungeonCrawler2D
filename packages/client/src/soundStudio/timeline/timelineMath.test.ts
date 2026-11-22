import { describe, expect, it } from "vitest";
import { normalizeTrackSpec } from "../../audio/proceduralSynth.js";
import {
  applyLeftTrim, applyRightResize, applyTrackMove, computeEnvelopePoints, reorderTracks, trimLeadingSilence,
} from "./timelineMath.js";

describe("timelineMath", () => {
  it("moves tracks forward cleanly and pushes other tracks rightward when dragged past 0ms", () => {
    const base = [
      normalizeTrackSpec({ id: "a", delaySec: 0, durationSec: 0.1 }, "a"),
      normalizeTrackSpec({ id: "b", delaySec: 0.12, durationSec: 0.1 }, "b"),
    ];
    const forward = applyTrackMove({ tracks: base, id: "a", targetDelaySec: 0.063, snapMs: 5 });
    expect(forward[0]?.delaySec).toBeCloseTo(0.065, 4);
    expect(forward[1]?.delaySec).toBeCloseTo(0.12, 4);

    const pushed = applyTrackMove({ tracks: base, id: "a", targetDelaySec: -0.08, snapMs: 5 });
    expect(pushed[0]?.delaySec).toBe(0);
    expect(pushed[1]?.delaySec).toBeCloseTo(0.2, 4);

    const trimmed = trimLeadingSilence([
      normalizeTrackSpec({ id: "a", delaySec: 0.05 }, "a"),
      normalizeTrackSpec({ id: "b", delaySec: 0.2 }, "b"),
    ]);
    expect(trimmed[0]?.delaySec).toBe(0);
    expect(trimmed[1]?.delaySec).toBeCloseTo(0.15, 4);
  });

  it("supports anchored left trim, right resize, track reordering, and attack-hold-decay envelope points", () => {
    const t = normalizeTrackSpec({ id: "x", delaySec: 0.1, durationSec: 0.3, attackSec: 0.06, holdSec: 0.12 }, "x");
    expect(applyLeftTrim({ track: t, targetStartSec: 0.2, snapMs: 10 })).toEqual({ delaySec: 0.2, durationSec: 0.2 });
    expect(applyRightResize({ track: t, targetEndSec: 0.55, snapMs: 5 })).toEqual({ durationSec: 0.45 });

    const reordered = reorderTracks([t, { ...t, id: "y" }], "x", 1);
    expect(reordered.map((r) => r.id)).toEqual(["y", "x"]);

    const env = computeEnvelopePoints(t);
    expect(env[0]).toEqual({ t: 0, amp: 0 });
    expect(env[1]?.amp).toBe(1);
    expect(env[2]?.amp).toBe(1);
    expect(env[env.length - 1]?.amp).toBeLessThan(0.05);
  });
});
