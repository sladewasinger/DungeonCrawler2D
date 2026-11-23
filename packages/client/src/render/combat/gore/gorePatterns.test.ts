import { describe, expect, it } from "vitest";
import { ARC_MASKS, WATER_PLUME_MASKS } from "./goreArtMasks.js";
import { planGoreSpawn } from "./gorePatterns.js";

const STYLE_SLICE = "thin-streak" as const;

describe("gorePatterns", () => {
  it("casts varied tangential blade-slice arcs oriented across the swing while flying away", () => {
    expect(ARC_MASKS.length).toBeGreaterThanOrEqual(6);
    const cw = planGoreSpawn({ dirX: 1, dirY: 0, style: STYLE_SLICE, substance: "blood", sweepDir: 1 }, 1);
    const ccw = planGoreSpawn({ dirX: 1, dirY: 0, style: STYLE_SLICE, substance: "blood", sweepDir: -1 }, 1);

    const cwArc = cw.particles.find((p) => p.kind === "arc")!;
    const ccwArc = ccw.particles.find((p) => p.kind === "arc")!;
    expect(cw.particles.filter((p) => p.kind === "arc")).toHaveLength(1);
    expect(cwArc.flipY).toBe(false);
    expect(ccwArc.flipY).toBe(true);
    expect(Math.abs((cwArc.rot ?? cwArc.ang) - cwArc.ang)).toBeGreaterThan(0.4);
    expect(cwArc.scale).toBeLessThanOrEqual(0.95);
    expect(cw.particles.length).toBeLessThanOrEqual(7);
    expect(cw.staticDecal).toBeUndefined();
  });

  it("emits chunky goop globs on slime hits and a glossy goop puddle on kill without blood arcs", () => {
    const hit = planGoreSpawn({ dirX: 1, dirY: 0, style: STYLE_SLICE, substance: "slime" }, 1);
    expect(hit.particles.filter((p) => p.kind === "goop").length).toBeGreaterThanOrEqual(3);
    expect(hit.particles.some((p) => p.kind === "arc" || p.kind === "streak")).toBe(false);
    expect(hit.staticDecal).toBeUndefined();

    const kill = planGoreSpawn({ dirX: 1, dirY: 0, style: "explode-away", substance: "slime", fatal: true }, 1);
    expect(kill.staticDecal?.kind).toBe("goopPuddle");
  });

  it("emits small spinning bone chips on skeleton hits and a bone pile on kill", () => {
    const hit = planGoreSpawn({ dirX: 1, dirY: 0, style: STYLE_SLICE, substance: "bone" }, 1);
    expect(hit.particles).toHaveLength(4);
    expect(hit.particles.every((p) => p.kind === "chunk")).toBe(true);
    expect(hit.staticDecal).toBeUndefined();

    const kill = planGoreSpawn({ dirX: 1, dirY: 0, style: "chunk-spray", substance: "bone", fatal: true }, 1);
    expect(kill.staticDecal?.kind).toBe("bonePile");
  });

  it("emits ephemeral pebbles plus sparks on golem hits and a rubble pile on kill", () => {
    const hit = planGoreSpawn({ dirX: 1, dirY: 0, style: STYLE_SLICE, substance: "stone" }, 1);
    const pebbles = hit.particles.filter((p) => p.kind === "chunk");
    const sparks = hit.particles.filter((p) => p.kind === "spark");
    expect(pebbles.length).toBeGreaterThanOrEqual(3);
    expect(pebbles.every((p) => p.ephemeral)).toBe(true);
    expect(sparks.length).toBeGreaterThanOrEqual(4);
    expect(sparks.every((p) => p.ephemeral)).toBe(true);
    expect(hit.staticDecal).toBeUndefined();

    const kill = planGoreSpawn({ dirX: 1, dirY: 0, style: "chunk-spray", substance: "stone", fatal: true }, 1);
    expect(kill.staticDecal?.kind).toBe("rubblePile");
  });

  it("emits fluttering straw wisps, single passive drips, and organic diffuse water plumes", () => {
    const straw = planGoreSpawn({ dirX: 1, dirY: 0, style: STYLE_SLICE, substance: "straw" }, 1);
    expect(straw.particles.every((p) => p.kind === "chunk" && p.flutter)).toBe(true);

    const bleed = planGoreSpawn({ dirX: 0, dirY: 1, style: "drip", substance: "blood", passiveDrip: true }, 1);
    expect(bleed.particles).toHaveLength(1);
    const stoneBleed = planGoreSpawn({ dirX: 0, dirY: 1, style: "drip", substance: "stone", passiveDrip: true }, 1);
    expect(stoneBleed.particles).toHaveLength(0);

    for (const mask of WATER_PLUME_MASKS) {
      const joined = mask.join("");
      expect(joined).toContain("3");
      expect(joined).toContain("1");
    }
  });

  it("makes reduced gore noticeably lighter with no blade arcs and smaller death pools", () => {
    const full = planGoreSpawn({ dirX: 1, dirY: 0, style: STYLE_SLICE, substance: "blood", fatal: true }, 1);
    const reduced = planGoreSpawn({ dirX: 1, dirY: 0, style: STYLE_SLICE, substance: "blood", fatal: true }, 0.45);
    expect(reduced.particles.some((p) => p.kind === "arc")).toBe(false);
    expect(reduced.particles.length).toBeLessThan(full.particles.length);
    expect(reduced.staticDecal?.scaleMult ?? 1).toBeLessThanOrEqual(0.5);
  });
});
