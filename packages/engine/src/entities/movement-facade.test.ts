import { describe, expect, it } from "vitest";
import { TICK_DT } from "../core/constants.js";
import type { WallFace, WorldView } from "../world/types.js";
import { NEUTRAL_INPUT, createBody, stepBody } from "./movement/index.js";

/** A single span-1 facade at (5, sourceY+1), plus optional extra blocked rows south of it (for eject-fallback cases). */
function facadeWorld(opts: { withRaisedTop?: boolean; blockedRows?: number[] } = {}): WorldView {
  const { withRaisedTop = false, blockedRows = [] } = opts;
  const heightAt = (_x: number, y: number): number => (withRaisedTop && y <= 6 ? 1 : 0);
  const blocked = new Set(blockedRows);
  return {
    isWalkable: (x, y) => !(x === 5 && y === 7) && !(x === 5 && blocked.has(y)),
    heightAt,
    groundAt: (x, y) => heightAt(Math.floor(x), Math.floor(y)),
    wallFaceAt: (x, y) =>
      x === 5 && y === 7 ? { sourceX: 5, sourceY: 6, bottom: 0, top: 1, span: 1 } : null,
  };
}

/** A span-2 facade: source at sourceY, spanned (blocked, facade-carrying) rows sourceY+1 and sourceY+2. */
function spanTwoWorld(): WorldView {
  const sourceY = 5;
  const span = 2;
  const top = 2;
  const spanned = new Set([sourceY + 1, sourceY + 2]);
  const face = (y: number): WallFace | null =>
    spanned.has(y) ? { sourceX: 5, sourceY, bottom: 0, top, span } : null;
  return {
    isWalkable: (x, y) => !(x === 5 && spanned.has(y)),
    heightAt: (_x, y) => (y <= sourceY ? top : 0),
    groundAt: (_x, y) => (Math.floor(y) <= sourceY ? top : 0),
    wallFaceAt: (x, y) => (x === 5 ? face(y) : null),
  };
}

function walkNorth(world: WorldView, body: ReturnType<typeof createBody>, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    stepBody(world, body, { moveX: 0, moveY: -1, jump: false }, TICK_DT);
  }
}

describe("projected wall facade movement", () => {
  it("stops grounded feet at the visible base", () => {
    const body = createBody(5.5, 8.5, 0);
    walkNorth(facadeWorld(), body, 20);
    expect(Math.floor(body.y)).toBe(8);
    expect(body.z).toBe(0);
  });

  it("allows a jump over the facade and onto its raised top", () => {
    const world = facadeWorld({ withRaisedTop: true });
    const body = createBody(5.5, 8.5, 0);
    stepBody(world, body, { moveX: 0, moveY: -1, jump: true }, TICK_DT);
    walkNorth(world, body, 30);
    expect(body.y).toBeLessThan(7);
    expect(body.grounded).toBe(true);
    expect(body.z).toBeCloseTo(1, 5);
  });

  it("ejects a falling body to the base instead of landing inside", () => {
    const body = createBody(5.5, 7.5, 0.3);
    body.grounded = false;
    body.zVel = -1;
    stepBody(facadeWorld(), body, NEUTRAL_INPUT, TICK_DT);
    expect(Math.floor(body.y)).toBe(8);
  });

  it("ejects PAST the whole span of a multi-row facade, not just one row", () => {
    const world = spanTwoWorld();

    // Falling back below top while inside the FIRST spanned row (6).
    const fromFirstRow = createBody(5.5, 6.5, 1);
    fromFirstRow.grounded = false;
    fromFirstRow.zVel = -1;
    stepBody(world, fromFirstRow, NEUTRAL_INPUT, TICK_DT);
    expect(Math.floor(fromFirstRow.y)).toBe(8); // sourceY(5) + span(2) + 1

    // Falling back below top while inside the SECOND spanned row (7) lands
    // at the same south base — the whole span ejects together.
    const fromSecondRow = createBody(5.5, 7.5, 1);
    fromSecondRow.grounded = false;
    fromSecondRow.zVel = -1;
    stepBody(world, fromSecondRow, NEUTRAL_INPUT, TICK_DT);
    expect(Math.floor(fromSecondRow.y)).toBe(8);
  });

  it("a 1-wide eject slot (south neighbor also blocked) searches further south for clear ground", () => {
    // The tile immediately past the span (row 8) is itself a wall — a
    // 1-wide slot — so the eject must keep walking south, up to span+1
    // rows, and land on the first clear cell (row 9).
    const world = facadeWorld({ blockedRows: [8] });
    const body = createBody(5.5, 7.5, 0.3);
    body.grounded = false;
    body.zVel = -1;
    stepBody(world, body, NEUTRAL_INPUT, TICK_DT);
    expect(Math.floor(body.y)).toBe(9);
  });

  it("falls back to standing on the source top when no clear ground exists within the search", () => {
    // Both candidate landing rows (8 and 9, span=1 so span+1=2 candidates)
    // are blocked — there is nowhere legal south of the facade to stand,
    // so the body is pinned to the facade's top instead of left in a wall.
    const world = facadeWorld({ blockedRows: [8, 9] });
    const body = createBody(5.5, 7.5, 0.3);
    const startY = body.y;
    body.grounded = false;
    body.zVel = 0; // isolate the eject's z pin from the same-tick gravity integration
    stepBody(world, body, NEUTRAL_INPUT, TICK_DT);
    expect(body.y).toBe(startY); // x/y untouched
    expect(body.z).toBe(1); // pinned to the facade's top
  });
});
