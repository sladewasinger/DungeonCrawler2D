/** Locks the shipped bandage contract to the validated versioned tuning surface. */
import { describe, expect, it } from "vitest";
import tuning from "./liveTuning.json" with { type: "json" };
import { parseLiveTuning } from "./liveTuning.schema.js";
import { tunedBandageStatus } from "./liveTuning.js";

describe("live tuning", () => {
  it("materializes the complete bandage contract from one versioned source", () => {
    const parsed = parseLiveTuning(tuning);
    const status = tunedBandageStatus(parsed);
    expect(parsed.version).toBe(1);
    expect(status).toMatchObject({
      id: "bandaged",
      duration: 5,
      tickEvery: 1,
      stacking: "refresh",
      onTick: [{ primitive: "modify_health", amount: 2 }],
    });
    expect(status.onApply).toEqual(status.onRefresh);
    expect(status.onApply[0]).toEqual({
      primitive: "modify_health",
      amount: 4,
    });
  });

  it("rejects durations that cannot contain a whole number of healing ticks", () => {
    const invalid = {
      ...tuning,
      bandage: { ...tuning.bandage, durationSeconds: 5, tickEverySeconds: 2 },
    };
    expect(() => parseLiveTuning(invalid)).toThrow(
      "bandage duration must contain a whole number of healing ticks",
    );
  });
});
