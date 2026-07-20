// SIMULATE tick order (Epic 7.11): fire spreads along painted oil exactly like the live
// game (both run the same engine AreaSystem), and two runs over an identical painted
// fixture reach byte-identical state at the same tick count.
import { describe, expect, it } from "vitest";
import { EditableWorld } from "../EditableWorld.js";
import { paintArea, paintEnemy } from "./paint.js";
import { createBenchState, type BenchState } from "./state.js";
import { stepBenchTick } from "./index.js";

/** Fire at (5,5), a 5-tile oil line running east of it — the roadmap's own example. */
function paintFireOilFixture(state: BenchState): void {
  paintArea(state, 5, 5, "area-fire");
  for (let x = 6; x <= 10; x++) paintArea(state, x, 5, "area-oil");
}

function snapshot(state: BenchState): string {
  const areas = state.areas
    .allTiles()
    .map((t) => `${t.x},${t.y}:${t.defId}`)
    .sort()
    .join("|");
  const enemies = [...state.enemies.values()]
    .map((e) => `${e.entity.id}:${e.entity.body.x.toFixed(4)},${e.entity.body.y.toFixed(4)}:${e.entity.hp.toFixed(2)}`)
    .sort()
    .join("|");
  return `areas[${areas}] enemies[${enemies}] dummy[${state.dummy.hp.toFixed(2)}]`;
}

describe("SIMULATE", () => {
  it("spreads fire along a painted oil line within its 40s oil lifetime", () => {
    const state = createBenchState(new EditableWorld());
    paintFireOilFixture(state);
    let caughtFire = false;
    for (let i = 0; i < 700 && !caughtFire; i++) {
      stepBenchTick(state);
      caughtFire = [6, 7, 8, 9, 10].some((x) => state.areas.defAt(x, 5) === "area-fire");
    }
    expect(caughtFire).toBe(true);
  });

  it("ticks to byte-identical state at tick N from an identical painted fixture", () => {
    const runOnce = (): string => {
      const state = createBenchState(new EditableWorld());
      paintFireOilFixture(state);
      paintEnemy(state, 12, 12, "slime");
      for (let i = 0; i < 300; i++) stepBenchTick(state);
      return snapshot(state);
    };
    expect(runOnce()).toBe(runOnce());
  });

  it("a spawned enemy wanders to and strikes the dummy, denting its hp", () => {
    const state = createBenchState(new EditableWorld());
    const centerTile = Math.floor(state.dummy.body.x);
    paintEnemy(state, centerTile + 3, centerTile, "skeleton"); // skeleton: fast + short aggro-safe range
    for (let i = 0; i < 400 && state.dummy.hp >= state.dummy.maxHp; i++) stepBenchTick(state);
    expect(state.dummy.hp).toBeLessThan(state.dummy.maxHp);
  });
});
