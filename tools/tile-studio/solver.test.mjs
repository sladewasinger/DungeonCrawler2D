import { describe, expect, it } from "vitest";
import { EMPTY, applyOverlaySupports, learnOverlaySupports, learnRules, solve, violations } from "./solver.mjs";

/**
 * Build a row-major tile grid from ASCII art. '.' = EMPTY, everything
 * else looks up the charmap.
 */
function grid(rows, charmap) {
  const gw = rows[0].length;
  const cells = [];
  for (const row of rows) {
    if (row.length !== gw) throw new Error("ragged grid");
    for (const ch of row) cells.push(ch === "." ? EMPTY : charmap[ch]);
  }
  return { cells, gw, gh: rows.length };
}

/** Same, but as smart-grid cells; charmap tiles are seeds. */
function seedGrid(rows, charmap) {
  const { cells, gw, gh } = grid(rows, charmap);
  return { cells: cells.map((t) => ({ t, seed: t !== EMPTY })), gw, gh };
}

// A bordered room the way the studio expects one: interior I, four
// edges, four corners, surrounded by emptiness.
//   8 = NW corner, 1 = N edge, 5 = NE corner
//   4 = W edge,    0 = floor,  2 = E edge
//   7 = SW corner, 3 = S edge, 6 = SE corner
const ROOM_CHARS = { I: 0, N: 1, E: 2, S: 3, W: 4, n: 5, e: 6, s: 7, w: 8 };
const ROOM_EXAMPLE = [
  "........",
  ".wNNNNn.",
  ".WIIIIE.",
  ".WIIIIE.",
  ".WIIIIE.",
  ".WIIIIE.",
  ".sSSSSe.",
  "........",
];

function roomRules() {
  const { cells, gw, gh } = grid(ROOM_EXAMPLE, ROOM_CHARS);
  return learnRules(cells, gw, gh);
}

describe("learnRules", () => {
  it("collects every tile and its 8-direction neighbor sets", () => {
    const { rules, tileCount } = roomRules();
    expect(tileCount).toBe(9);
    // interior sits under interior or under the north edge
    expect([...rules.get(0).n].sort()).toEqual([0, 1]);
    // NW corner: emptiness above/left, edges beside, interior diagonally
    expect(rules.get(8).n.has(EMPTY)).toBe(true);
    expect(rules.get(8).w.has(EMPTY)).toBe(true);
    expect(rules.get(8).e.has(1)).toBe(true);
    expect(rules.get(8).s.has(4)).toBe(true);
    expect(rules.get(8).se.has(0)).toBe(true);
    // learning is symmetric: a allows b on dir ⟺ b allows a opposite
    expect(rules.get(1).sw.has(0) || rules.get(1).s.has(0)).toBe(true);
    expect(rules.get(0).ne.has(1) || rules.get(0).n.has(1)).toBe(true);
  });

  it("counts tile frequency for value ordering", () => {
    const { weights } = roomRules();
    expect(weights.get(0)).toBe(16); // 4×4 interior
    expect(weights.get(8)).toBe(1);
  });
});

describe("solve", () => {
  it("completes the border ring (with corners) around an interior blob", () => {
    const { rules, weights } = roomRules();
    const { cells, gw, gh } = seedGrid(
      [
        "............",
        "............",
        "............",
        "............",
        "............",
        ".....III....",
        ".....III....",
        ".....III....",
        "............",
        "............",
        "............",
        "............",
      ],
      ROOM_CHARS,
    );
    const result = solve(cells, gw, gh, { rules, weights });
    expect(result.ok).toBe(true);
    expect(result.unknownSeeds).toEqual([]);

    // seeds are never part of the assignment
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].seed) expect(result.assignment.has(i)).toBe(false);
    }

    const done = cells.map((cell, i) =>
      result.assignment.has(i) ? { t: result.assignment.get(i), seed: false } : cell,
    );
    // the completed patch violates no learned adjacency
    expect(violations(done, gw, gh, rules)).toEqual([]);

    // a closed ring needs all four edges and all four corners
    const placed = new Set([...result.assignment.values()]);
    for (const tile of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(placed, `tile ${tile} should appear in the ring`).toContain(tile);
    }
    // interior can't touch emptiness, so every seed neighbor is filled
    for (let r = 4; r <= 8; r++) {
      for (let c = 4; c <= 8; c++) {
        const t = done[r * gw + c].t;
        expect(t, `cell ${c},${r} should be filled`).not.toBe(EMPTY);
      }
    }
  });

  it("is deterministic for a given seed", () => {
    const { rules, weights } = roomRules();
    const make = () =>
      seedGrid(
        ["..........", "..........", "....III...", "....III...", "..........", ".........."],
        ROOM_CHARS,
      );
    const a = make();
    const r1 = solve(a.cells, a.gw, a.gh, { rules, weights, seed: 77 });
    const b = make();
    const r2 = solve(b.cells, b.gw, b.gh, { rules, weights, seed: 77 });
    expect(r1.ok).toBe(true);
    expect([...r1.assignment.entries()].sort()).toEqual([...r2.assignment.entries()].sort());
  });

  it("learns and applies a required tile directly below a painted seed", () => {
    // This is the smallest useful authoring example: grass can stand on
    // its own, but a wall-base tile appears only with grass directly south.
    const CHARS = { G: 30, W: 31 };
    const example = grid(
      [
        "........",
        ".G......",
        "...W....",
        "...G....",
        "........",
      ],
      CHARS,
    );
    const { rules, weights } = learnRules(example.cells, example.gw, example.gh);
    const target = seedGrid(
      [
        "........",
        "........",
        "........",
        "....W...",
        "........",
        "........",
        "........",
      ],
      CHARS,
    );

    const result = solve(target.cells, target.gw, target.gh, { rules, weights });

    expect(result.ok).toBe(true);
    expect(result.assignment.get(4 * target.gw + 4)).toBe(CHARS.G);
  });

  it("uses a top-layer seed to place its learned ground support", () => {
    const CHARS = { G: 40, W: 41 };
    const groundExample = grid(
      [
        "........",
        ".G......",
        "...G....",
        "...G....",
        "........",
      ],
      CHARS,
    );
    const topExample = grid(
      [
        "........",
        "........",
        "...W....",
        "........",
        "........",
      ],
      CHARS,
    );
    const { supports } = learnOverlaySupports(
      groundExample.cells,
      topExample.cells,
      groundExample.gw,
      groundExample.gh,
    );
    const ground = seedGrid(
      [
        "........",
        "........",
        "........",
        "........",
        "........",
        "........",
        "........",
      ],
      CHARS,
    );
    const top = ground.cells.map(() => ({ t: EMPTY, seed: false }));
    top[3 * ground.gw + 4] = { t: CHARS.W, seed: true };

    const result = applyOverlaySupports(ground.cells, top, supports, ground.gw, ground.gh);

    expect(result.matchingSeedCount).toBe(1);
    expect(result.assignment.get(3 * ground.gw + 4)).toBe(CHARS.G);
    expect(result.assignment.get(4 * ground.gw + 4)).toBe(CHARS.G);
    expect(ground.cells[3 * ground.gw + 4]).toEqual({ t: EMPTY, seed: false });
  });

  it("fails cleanly on contradictory seeds without touching the input", () => {
    // A/C/B only ever stack vertically: A over C over B.
    const CHARS = { A: 10, B: 11, C: 12 };
    const ex = grid(["......", "...A..", "...C..", "...B..", "......"], CHARS);
    const { rules, weights } = learnRules(ex.cells, ex.gw, ex.gh);

    // Two A's with one gap: the cell between must accept A above (only C
    // does) AND A below (nothing does) — unsolvable.
    const { cells, gw, gh } = seedGrid(
      ["........", "........", "....A...", "........", "....A...", "........", "........", "........"],
      CHARS,
    );
    const before = JSON.stringify(cells);
    const result = solve(cells, gw, gh, { rules, weights, restarts: 3 });
    expect(result.ok).toBe(false);
    expect(result.assignment).toBeNull();
    expect(JSON.stringify(cells)).toBe(before); // caller's grid untouched
  });

  it("treats seed tiles missing from the example as wildcards and reports them", () => {
    const { rules, weights } = roomRules();
    const { cells, gw, gh } = seedGrid(
      ["........", "........", "........", "........", "........", "........", "........", "........"],
      {},
    );
    cells[3 * gw + 3] = { t: 999, seed: true };
    const result = solve(cells, gw, gh, { rules, weights });
    expect(result.ok).toBe(true);
    expect(result.unknownSeeds).toEqual([999]);
  });

  it("no seeds → nothing to do", () => {
    const { rules } = roomRules();
    const { cells, gw, gh } = seedGrid(["....", "....", "....", "...."], {});
    const result = solve(cells, gw, gh, { rules });
    expect(result.ok).toBe(true);
    expect(result.assignment.size).toBe(0);
  });

  it("refuses to run without rules", () => {
    const { cells, gw, gh } = seedGrid(["I...", "....", "....", "...."], ROOM_CHARS);
    const result = solve(cells, gw, gh, { rules: new Map() });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no rules");
  });
});
