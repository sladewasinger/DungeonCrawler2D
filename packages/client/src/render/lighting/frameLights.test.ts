import { describe, expect, it } from "vitest";
import type { LightSource } from "./lightSource.js";
import { collectTorchLights, selectFrameLights } from "./frameLights.js";

function light(
  id: string,
  x: number,
  kind: LightSource["kind"] = "fire",
): LightSource {
  return { id, x, y: 0, color: 0xffffff, radiusTiles: 1, kind, seed: 0 };
}

describe("selectFrameLights", () => {
  it("keeps the nearest capped candidates and always appends personal light", () => {
    const chunks = new Map([
      ["a", [light("far", 10), light("near", 1)]],
      ["b", [light("middle", 4)]],
    ]);
    const personal = light("personal", 100, "personal");
    const selected = selectFrameLights(
      chunks.values(),
      [light("accent", 2)],
      0,
      0,
      personal,
      3,
      [],
      [],
    );

    expect(selected.map(({ id }) => id)).toEqual([
      "near",
      "accent",
      "personal",
    ]);
  });

  it("reuses bounded candidate and selected arrays across sustained frames", () => {
    const candidates: LightSource[] = [];
    const selected: LightSource[] = [];
    const personal = light("personal", 0, "personal");
    const candidateIdentity = candidates;
    const selectedIdentity = selected;

    for (let frame = 0; frame < 300; frame++) {
      const result = selectFrameLights(
        [[light(`torch-${frame}`, frame, "torch")]],
        [],
        frame,
        0,
        personal,
        24,
        candidates,
        selected,
      );
      expect(result).toBe(selectedIdentity);
      expect(candidates).toBe(candidateIdentity);
      expect(result.at(-1)).toBe(personal);
    }
  });

  it("uses the full cap without appending a radial personal halo when suppressed", () => {
    const selected = selectFrameLights(
      [[light("near", 1), light("middle", 2), light("far", 3)]],
      [],
      0,
      0,
      null,
      2,
      [],
      [],
    );

    expect(selected.map(({ id }) => id)).toEqual(["near", "middle"]);
    expect(selected.some(({ kind }) => kind === "personal")).toBe(false);
  });
});

describe("collectTorchLights", () => {
  it("reuses output and excludes non-torch accents", () => {
    const output: LightSource[] = [];
    const identity = output;
    const result = collectTorchLights(
      [[light("world", 0, "torch"), light("portal", 0, "portal")]],
      [light("placed", 0, "torch"), light("fire", 0, "fire")],
      output,
    );

    expect(result).toBe(identity);
    expect(result.map(({ id }) => id)).toEqual(["world", "placed"]);
  });
});
