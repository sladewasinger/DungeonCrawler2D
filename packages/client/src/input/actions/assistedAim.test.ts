import { describe, expect, it, vi } from "vitest";
import type {
  InputConnection,
  InputHooks,
  InputQueries,
  InputState,
} from "../controls/state.js";
import {
  ASSISTED_TARGET_RANGE_TILES,
  assistedAimActive,
  assistedAttackDirection,
  triggerAssistedAttack,
} from "./assistedAim.js";

describe("assisted aim mode", () => {
  it("activates for touch or keyboard kid mode, but not desktop mouse play", () => {
    expect(assistedAimActive(true, false)).toBe(true);
    expect(assistedAimActive(false, true)).toBe(true);
    expect(assistedAimActive(false, false)).toBe(false);
  });
});

describe("assisted attacks", () => {
  it("prefers the closest enemy within four tiles", () => {
    const { conn, queries } = fixture({ x: -2, y: 1 });
    expect(assistedAttackDirection(conn, queries, { x: 1, y: 0 }))
      .toEqual({ x: -2, y: 1 });
    expect(queries.nearestEnemyDirection)
      .toHaveBeenCalledWith(conn, ASSISTED_TARGET_RANGE_TILES);
  });

  it("falls back to current movement-facing when no enemy is nearby", () => {
    const { conn, queries } = fixture(undefined);
    expect(assistedAttackDirection(conn, queries, { x: 0, y: -1 }))
      .toEqual({ x: 0, y: -1 });
  });

  it("sends the assisted direction through the shared attack path", () => {
    const setup = fixture({ x: -2, y: 1 });
    triggerAssistedAttack({ ...setup, fallbackDirection: { x: 1, y: 0 }, nowMs: 100 });
    expect(setup.conn.attack).toHaveBeenCalledWith(-2, 1);
    expect(setup.hooks.onSwing).toHaveBeenCalledWith(-2, 1);
  });
});

function fixture(target: { x: number; y: number } | undefined) {
  const state = { nextSwingAt: 0 } as InputState;
  const conn = {
    body: { x: 0, y: 0 },
    canAct: true,
    attack: vi.fn(),
  } as unknown as InputConnection;
  const queries = {
    nearestEnemyDirection: vi.fn(() => target),
  } as unknown as InputQueries;
  const hooks = { onSwing: vi.fn() } as unknown as InputHooks;
  return { state, conn, queries, hooks, cooldownMs: 350 };
}
