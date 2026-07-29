import type { MoveInput } from "@dc2d/engine";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resetViewOrientation,
  setViewOrientation,
} from "../../render/view/index.js";
import {
  attackInKidMode,
  createKidModeState,
  kidAttackDirection,
  kidFacingTarget,
  updateKidFacing,
} from "./kidMode.js";
import type {
  InputConnection,
  InputHooks,
  InputQueries,
  InputState,
} from "./state.js";

afterEach(resetViewOrientation);

describe("kid mode facing", () => {
  it("keeps the last of eight arrow-key directions while idle", () => {
    const state = createKidModeState();
    updateKidFacing(state, move(-1, -1));
    updateKidFacing(state, move(0, 0));
    expect(state).toMatchObject({ facingX: -1, facingY: -1 });
  });

  it("rotates its movement-facing target with the camera", () => {
    const state = { active: true, facingX: 0, facingY: -1 };
    setViewOrientation(90);
    expect(kidFacingTarget(state, { x: 10, y: 20 }, 4))
      .toEqual({ x: 14, y: 20 });
  });
});

describe("kid mode attack aim", () => {
  it("prefers the closest enemy inside four tiles", () => {
    const { state, conn, queries } = attackFixture({ x: 2, y: -1 });
    expect(kidAttackDirection(state, conn, queries)).toEqual({ x: 2, y: -1 });
  });

  it("sends the assisted direction through the shared attack path", () => {
    const fixture = attackFixture({ x: 2, y: -1 });
    attackInKidMode({ ...fixture, nowMs: 100 });
    expect(fixture.conn.attack).toHaveBeenCalledWith(2, -1);
    expect(fixture.hooks.onSwing).toHaveBeenCalledWith(2, -1);
  });
});

function move(moveX: number, moveY: number): MoveInput {
  return { moveX, moveY, jump: false, run: false };
}

function attackFixture(target: { x: number; y: number }) {
  const state = {
    nextSwingAt: 0,
    kidMode: { active: true, facingX: 0, facingY: 1 },
  } as InputState;
  const conn = {
    body: { x: 0, y: 0 },
    canAct: true,
    weapon: null,
    attack: vi.fn(),
  } as unknown as InputConnection;
  const queries = {
    attackCooldownMs: () => 350,
    nearestEnemyDirection: () => target,
  } as unknown as InputQueries;
  const hooks = { onSwing: vi.fn() } as unknown as InputHooks;
  return { state, conn, queries, hooks };
}
