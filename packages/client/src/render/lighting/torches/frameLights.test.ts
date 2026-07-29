import { describe, expect, it } from "vitest";
import type { LightSource } from "../core/lightSource.js";
import {
  collectGroundRevealLights,
  collectTorchLights,
  selectFrameLights,
} from "./frameLights.js";

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
    const selected = selectFrameLights({ chunkLights: chunks.values(), accentLights: [light("accent", 2)], center: { x: 0, y: 0 }, personalLight: personal, maxLights: 3, candidates: [], selected: [] });

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
      const result = selectFrameLights({ chunkLights: [[light(`torch-${frame}`, frame, "torch")]], accentLights: [], center: { x: frame, y: 0 }, personalLight: personal, maxLights: 24, candidates, selected });
      expect(result).toBe(selectedIdentity);
      expect(candidates).toBe(candidateIdentity);
      expect(result.at(-1)).toBe(personal);
    }
  });

  it("uses the full cap without appending a radial personal halo when suppressed", () => {
    const selected = selectFrameLights({ chunkLights: [[light("near", 1), light("middle", 2), light("far", 3)]], accentLights: [], center: { x: 0, y: 0 }, personalLight: null, maxLights: 2, candidates: [], selected: [] });

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

describe("collectGroundRevealLights", () => {
  it("includes every world emitter while excluding the separately-managed player light", () => {
    const lights = [
      light("personal", 0, "personal"),
      light("torch-a", 1, "torch"),
      { ...light("flying", 2, "fire"), emitsTorchLight: true },
      light("fire-field", 2, "fire"),
      light("poison", 2, "poison"),
      light("portal", 2, "portal"),
      light("torch-b", 3, "torch"),
    ];

    expect(collectGroundRevealLights(lights, 6, []).map(({ id }) => id))
      .toEqual(["torch-a", "flying", "fire-field", "poison", "portal", "torch-b"]);
  });
});
