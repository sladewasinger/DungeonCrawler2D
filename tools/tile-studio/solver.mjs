/**
 * Tile Studio rule learning + constraint solver — pure logic, no DOM.
 *
 * The studio learns, from a hand-painted example grid, which tiles may
 * sit next to which (in all 8 directions, EMPTY included), then
 * completes the halo around painted seed tiles so borders/corners
 * appear on their own. Kept DOM-free so vitest can drive it directly
 * (tools/tile-studio/solver.test.mjs); index.html imports it as an ES
 * module.
 */

export const EMPTY = -1;

const BUDGET = Symbol("budget-exhausted");

// 8 directions: diagonals matter — without them a border ring can't
// learn that its corners exist, and the solver leaves gaps.
export const DIRS = [
  ["n", 0, -1],
  ["e", 1, 0],
  ["s", 0, 1],
  ["w", -1, 0],
  ["ne", 1, -1],
  ["se", 1, 1],
  ["sw", -1, 1],
  ["nw", -1, -1],
];
export const OVERLAY_SUPPORT_DIRS = [
  ["under", 0, 0],
  ["south", 0, 1],
];
const OPP = { n: "s", s: "n", e: "w", w: "e", ne: "sw", sw: "ne", se: "nw", nw: "se" };

function emptyDirSets() {
  const out = {};
  for (const [dir] of DIRS) out[dir] = new Set();
  return out;
}

/** Deterministic PRNG (mulberry32). */
export function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Learn adjacency rules from an example grid.
 *
 * @param cells row-major array of tile index | EMPTY, length gw*gh
 * @returns {{ rules: Map, weights: Map, tileCount: number, factCount: number }}
 *   rules:   tile -> {n,e,s,w,ne,se,sw,nw: Set of allowed neighbors}
 *   weights: tile -> occurrence count in the example (value ordering)
 */
export function learnRules(cells, gw, gh) {
  const rules = new Map();
  const weights = new Map();
  const entry = (t) => {
    if (!rules.has(t)) rules.set(t, emptyDirSets());
    return rules.get(t);
  };
  for (let r = 0; r < gh; r++) {
    for (let c = 0; c < gw; c++) {
      const a = cells[r * gw + c];
      weights.set(a, (weights.get(a) ?? 0) + 1);
      for (const [dir, dx, dy] of DIRS) {
        const nc = c + dx;
        const nr = r + dy;
        const b = nc < 0 || nr < 0 || nc >= gw || nr >= gh ? EMPTY : cells[nr * gw + nc];
        entry(a)[dir].add(b);
        entry(b)[OPP[dir]].add(a);
      }
    }
  }
  const tileCount = [...rules.keys()].filter((t) => t !== EMPTY).length;
  let factCount = 0;
  for (const d of rules.values()) for (const [dir] of DIRS) factCount += d[dir].size;
  return { rules, weights, tileCount, factCount };
}

export function learnOverlaySupports(ground, overlay, gw, gh) {
  const supports = new Map();
  for (let r = 0; r < gh; r++) {
    for (let c = 0; c < gw; c++) {
      const top = overlay[r * gw + c];
      if (top === EMPTY) continue;
      if (!supports.has(top)) supports.set(top, new Map());
      const entry = supports.get(top);
      for (const [dir, dx, dy] of OVERLAY_SUPPORT_DIRS) {
        const nc = c + dx;
        const nr = r + dy;
        if (nc < 0 || nr < 0 || nc >= gw || nr >= gh) continue;
        const terrain = ground[nr * gw + nc];
        if (terrain === EMPTY) continue;
        if (!entry.has(dir)) entry.set(dir, new Map());
        const options = entry.get(dir);
        options.set(terrain, (options.get(terrain) ?? 0) + 1);
      }
    }
  }
  let factCount = 0;
  for (const entry of supports.values()) for (const options of entry.values()) factCount += options.size;
  return { supports, tileCount: supports.size, factCount };
}

function mostCommon(options) {
  return [...options].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? EMPTY;
}

export function applyOverlaySupports(ground, overlay, supports, gw, gh) {
  const assignment = new Map();
  const unknownSeeds = [];
  let matchingSeedCount = 0;
  for (let i = 0; i < overlay.length; i++) {
    const top = overlay[i];
    if (!top.seed) continue;
    const support = supports.get(top.t);
    if (!support) {
      unknownSeeds.push(top.t);
      continue;
    }
    matchingSeedCount++;
    const c = i % gw;
    const r = Math.floor(i / gw);
    for (const [dir, dx, dy] of OVERLAY_SUPPORT_DIRS) {
      const terrain = mostCommon(support.get(dir) ?? new Map());
      const nc = c + dx;
      const nr = r + dy;
      if (terrain === EMPTY || nc < 0 || nr < 0 || nc >= gw || nr >= gh) continue;
      const target = nr * gw + nc;
      if (ground[target].seed || assignment.has(target)) continue;
      assignment.set(target, terrain);
    }
  }
  return { assignment, matchingSeedCount, unknownSeeds: [...new Set(unknownSeeds)] };
}

/**
 * Complete the halo around seed cells with tiles satisfying the rules.
 *
 * Backtracking search: AC-3-ish propagation over the halo cells, MRV
 * cell picking, values ordered EMPTY-first (don't balloon the shape),
 * then edge-capable before interior tiles, shuffled within each rank
 * by example frequency. Restarts with fresh randomness if an attempt
 * exhausts its work budget; a hard failure leaves the caller's grid
 * untouched (we only return the assignment, never mutate input).
 *
 * Cells NOT owned by the solver (outside the halo) constrain the
 * solve with their painted value — successive strokes knit together
 * instead of seeing phantom emptiness.
 *
 * @param cells row-major array of { t: tile|EMPTY, seed: boolean }
 * @param opts  { rules, weights?, halo?, seed?, restarts?, budget? }
 * @returns {{ ok, assignment: Map<index,tile>|null, unknownSeeds: number[], varCount }}
 */
export function solve(cells, gw, gh, opts) {
  const { rules, weights = new Map(), halo = 2, seed = 1234, restarts = 8, budget = 2_000_000 } = opts;
  if (!rules || rules.size === 0) {
    return { ok: false, assignment: null, unknownSeeds: [], varCount: 0, reason: "no rules" };
  }

  const seeds = [];
  for (let i = 0; i < gw * gh; i++) if (cells[i].seed) seeds.push(i);
  if (seeds.length === 0) {
    return { ok: true, assignment: new Map(), unknownSeeds: [], varCount: 0 };
  }

  // Seed tiles the example never showed: they can't constrain anything
  // (treated as wildcards below) — surfaced so the UI can warn.
  const unknownSeeds = [...new Set(seeds.map((i) => cells[i].t).filter((t) => !rules.has(t)))];

  const isVar = new Array(gw * gh).fill(false);
  for (const s of seeds) {
    const sc = s % gw;
    const sr = Math.floor(s / gw);
    for (let dy = -halo; dy <= halo; dy++) {
      for (let dx = -halo; dx <= halo; dx++) {
        const c = sc + dx;
        const r = sr + dy;
        if (c < 0 || r < 0 || c >= gw || r >= gh) continue;
        const i = r * gw + c;
        if (!cells[i].seed) isVar[i] = true;
      }
    }
  }
  const varCells = [];
  for (let i = 0; i < gw * gh; i++) if (isVar[i]) varCells.push(i);

  const allValues = [...rules.keys()];
  // A fixed (non-solver) cell constrains with its painted value; the
  // world beyond the grid is EMPTY.
  const fixedValue = (i) => cells[i].t;
  // Unknown values act as wildcards: they don't veto any neighbor.
  const supports = (v, dir, b) => {
    if (!rules.has(b)) return true;
    const e = rules.get(v);
    return e ? e[dir].has(b) : false;
  };

  // Value ordering rank: EMPTY, then edge tiles, then interior tiles.
  const canTouchEmpty = new Map();
  for (const v of allValues) {
    const e = rules.get(v);
    canTouchEmpty.set(v, DIRS.some(([dir]) => e[dir].has(EMPTY)));
  }
  const rank = (v) => (v === EMPTY ? 0 : canTouchEmpty.get(v) ? 1 : 2);

  // Precomputed 8-neighborhood per var cell: { dir, j } with j = -1 for
  // out-of-grid (constrains as EMPTY).
  const neighborhood = new Map();
  for (const i of varCells) {
    const c = i % gw;
    const r = Math.floor(i / gw);
    const list = [];
    for (const [dir, dx, dy] of DIRS) {
      const nc = c + dx;
      const nr = r + dy;
      list.push({ dir, j: nc < 0 || nr < 0 || nc >= gw || nr >= gh ? -1 : nr * gw + nc });
    }
    neighborhood.set(i, list);
  }

  const attempt = (rng, budgetBox) => {
    const domains = new Map();
    for (const i of varCells) domains.set(i, new Set(allValues));

    // Prune dom(i) against every neighbor. Returns "fail" | "changed" | "ok".
    const revise = (i) => {
      const dom = domains.get(i);
      let changed = false;
      for (const { dir, j } of neighborhood.get(i)) {
        const nv = j >= 0 && domains.has(j) ? [...domains.get(j)] : [j >= 0 ? fixedValue(j) : EMPTY];
        budgetBox.used += dom.size * nv.length;
        for (const v of [...dom]) {
          if (!nv.some((b) => supports(v, dir, b))) {
            dom.delete(v);
            changed = true;
          }
        }
        if (dom.size === 0) return "fail";
        if (budgetBox.used > budgetBox.max) throw BUDGET;
      }
      return changed ? "changed" : "ok";
    };

    // AC-3 worklist: when a cell's domain shrinks, its var neighbors
    // need rechecking — no full-grid sweeps.
    const propagate = (queue) => {
      const queued = new Set(queue);
      while (queue.length > 0) {
        const i = queue.pop();
        queued.delete(i);
        const res = revise(i);
        if (res === "fail") return false;
        if (res === "changed") {
          for (const { j } of neighborhood.get(i)) {
            if (j >= 0 && domains.has(j) && !queued.has(j)) {
              queue.push(j);
              queued.add(j);
            }
          }
        }
      }
      return true;
    };

    const snapshot = () => {
      const copy = new Map();
      for (const [i, dom] of domains) copy.set(i, new Set(dom));
      return copy;
    };
    const restoreSnap = (snap) => {
      for (const [i, dom] of snap) domains.set(i, new Set(dom));
    };

    const orderValues = (dom) => {
      // Efraimidis–Spirakis weighted shuffle within rank classes.
      const keyed = [...dom].map((v) => {
        const w = Math.max(1, weights.get(v) ?? 1);
        return [v, rank(v), Math.pow(rng(), 1 / w)];
      });
      keyed.sort((a, b) => a[1] - b[1] || b[2] - a[2]);
      return keyed.map(([v]) => v);
    };

    const search = () => {
      let pick = null;
      let pickSize = Infinity;
      for (const [i, dom] of domains) {
        if (dom.size > 1 && dom.size < pickSize) {
          pick = i;
          pickSize = dom.size;
        }
      }
      if (pick === null) return true; // all singletons
      for (const v of orderValues(domains.get(pick))) {
        const snap = snapshot();
        domains.set(pick, new Set([v]));
        const wake = [pick, ...neighborhood.get(pick).flatMap(({ j }) =>
          j >= 0 && domains.has(j) ? [j] : [],
        )];
        if (propagate(wake) && search()) return true;
        restoreSnap(snap);
        if (budgetBox.used > budgetBox.max) throw BUDGET;
      }
      return false;
    };

    if (!propagate([...varCells])) return null;
    if (!search()) return null;
    const out = new Map();
    for (const [i, dom] of domains) out.set(i, [...dom][0]);
    return out;
  };

  for (let round = 0; round < restarts; round++) {
    const rng = makeRng(seed + round * 0x9e3779b9);
    const budgetBox = { used: 0, max: budget };
    try {
      const assignment = attempt(rng, budgetBox);
      if (assignment) {
        return { ok: true, assignment, unknownSeeds, varCount: varCells.length };
      }
    } catch (e) {
      if (e !== BUDGET) throw e; // out of budget → try a fresh ordering
    }
  }
  return { ok: false, assignment: null, unknownSeeds, varCount: varCells.length };
}

/**
 * Validate a full smart grid against rules — every non-solver check a
 * test needs: are all 8-neighborhoods of every painted cell allowed?
 * Returns a list of violations (empty = consistent).
 */
export function violations(cells, gw, gh, rules) {
  const out = [];
  const val = (c, r) => (c < 0 || r < 0 || c >= gw || r >= gh ? EMPTY : cells[r * gw + c].t);
  for (let r = 0; r < gh; r++) {
    for (let c = 0; c < gw; c++) {
      const a = val(c, r);
      if (!rules.has(a)) continue;
      for (const [dir, dx, dy] of DIRS) {
        const b = val(c + dx, r + dy);
        if (!rules.has(b)) continue;
        if (!rules.get(a)[dir].has(b)) out.push({ c, r, dir, a, b });
      }
    }
  }
  return out;
}
