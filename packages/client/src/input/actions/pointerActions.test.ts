// Regression coverage for the desktop pointer-only split between the network
// reflection direction and the locally rendered swing presentation direction.
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetViewOrientation } from "../../render/view/index.js";
import type { InputState } from "../controls/state.js";
import {
  attackAtPointer,
  type PointerDeps,
} from "./pointerActions.js";

afterEach(resetViewOrientation);

describe("desktop pointer attack aim", () => {
  it("sends projectile-body direction while swinging toward the visible pointer", () => {
    const attack = vi.fn();
    const onSwing = vi.fn();
    const projectileReflectionAim = vi.fn(() => ({
      projectileId: "spit-a",
      networkDirection: { x: 2, y: 0 },
      presentationDirection: { x: 2, y: -1 },
    }));
    const conn = connection(attack);
    const deps = pointerDeps({
      conn,
      queries: { projectileReflectionAim },
      hooks: { onSwing },
    });

    attackAtPointer({
      state: inputState(),
      deps,
      pointer: pointer(20, 10),
      camera: { getWorldPoint: (x, y) => ({ x, y }) },
      tilePx: 10,
    });

    expect(projectileReflectionAim).toHaveBeenCalledWith(conn, {
      pointerView: { x: 2, y: 1 },
      orientation: 0,
    });
    expect(attack).toHaveBeenCalledWith(2, 0);
    expect(onSwing).toHaveBeenCalledWith(2, -1);
  });

  it("keeps the existing terrain pointer fallback when no eligible spit is selected", () => {
    const attack = vi.fn();
    const onSwing = vi.fn();
    const conn = connection(attack);
    const deps = pointerDeps({
      conn,
      queries: { projectileReflectionAim: () => undefined },
      hooks: { onSwing },
    });

    attackAtPointer({
      state: inputState(),
      deps,
      pointer: pointer(20, 10),
      camera: { getWorldPoint: (x, y) => ({ x, y }) },
      tilePx: 10,
    });

    expect(attack).toHaveBeenCalledWith(2, 1);
    expect(onSwing).toHaveBeenCalledWith(2, 1);
  });
});

function inputState(): InputState {
  return {
    nextSwingAt: 0,
    kidMode: { active: false, facingX: 0, facingY: 1 },
  } as InputState;
}

function connection(attack: () => void) {
  return {
    body: { x: 0, y: 0 },
    canAct: true,
    weapon: "sword",
    attack,
  } as unknown as PointerDeps["conn"];
}

function pointer(x: number, y: number) {
  return { x, y, rightButtonDown: () => false } as never;
}

function pointerDeps(overrides: {
  readonly conn: PointerDeps["conn"];
  readonly queries: Partial<PointerDeps["queries"]>;
  readonly hooks: Partial<PointerDeps["hooks"]>;
}): PointerDeps {
  return {
    conn: overrides.conn,
    hud: { hitTest: () => null },
    queries: {
      attackCooldownMs: () => 350,
      ...overrides.queries,
    },
    hooks: { onSwing: overrides.hooks.onSwing },
  } as unknown as PointerDeps;
}
