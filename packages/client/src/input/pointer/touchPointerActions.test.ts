import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import type { InputState } from "../controls/state.js";
import { createTouchInputState } from "../touch/index.js";
import {
  handlePointerDown,
  handlePointerUp,
  type PointerDeps,
} from "./pointer.js";

describe("touch action buttons", () => {
  it("routes USE through the same contextual callback as keyboard E", () => {
    const performInteract = vi.fn();
    const touch = createTouchInputState();
    const deps = touchDeps({
      touch,
      hit: "touch:interact",
      performInteract,
    });
    handlePointerDown(inputState(), deps, pointer(4));
    expect(performInteract).toHaveBeenCalledOnce();
    expect(touch.buttons.interact).toBe(4);
  });

  it("routes ATTACK through four-tile assisted targeting", () => {
    const touch = createTouchInputState();
    const nearestEnemyDirection = vi.fn(() => ({ x: -2, y: 1 }));
    const attack = vi.fn();
    const onSwing = vi.fn();
    const deps = touchDeps({
      touch,
      hit: "touch:attack",
      conn: { attack, weapon: null },
      queries: { nearestEnemyDirection, attackCooldownMs: () => 350 },
      hooks: { onSwing },
    });
    handlePointerDown(inputState(), deps, pointer(8));
    expect(nearestEnemyDirection).toHaveBeenCalledWith(deps.conn, 4);
    expect(attack).toHaveBeenCalledWith(-2, 1);
    expect(onSwing).toHaveBeenCalledWith(-2, 1);
  });

  it("holds JUMP until its owning touch pointer releases", () => {
    const sendMovementEdge = vi.fn();
    const touch = createTouchInputState();
    const deps = touchDeps({
      touch,
      hit: "touch:jump",
      sendMovementEdge,
    });
    handlePointerDown(inputState(), deps, pointer(9));
    expect(touch.buttons.jump).toBe(9);
    expect(sendMovementEdge).toHaveBeenCalledOnce();
    handlePointerUp({ touch, pointer: pointer(9), onMovementEdge: sendMovementEdge });
    expect(touch.buttons.jump).toBeNull();
  });
});

function inputState(): InputState {
  return { nextSwingAt: 0 } as InputState;
}

function pointer(id: number): Phaser.Input.Pointer {
  return {
    id,
    x: 0,
    y: 0,
    rightButtonDown: () => false,
  } as unknown as Phaser.Input.Pointer;
}

interface TouchDepsOverrides {
  readonly touch: ReturnType<typeof createTouchInputState>;
  readonly hit: string;
  readonly conn?: Partial<PointerDeps["conn"]>;
  readonly queries?: Partial<PointerDeps["queries"]>;
  readonly hooks?: Partial<PointerDeps["hooks"]>;
  readonly sendMovementEdge?: () => void;
  readonly performInteract?: () => void;
}

function touchDeps(overrides: TouchDepsOverrides): PointerDeps {
  return {
    conn: { body: { x: 0, y: 0 }, canAct: true, ...overrides.conn },
    hud: { hitTest: () => overrides.hit },
    queries: overrides.queries ?? {},
    hooks: overrides.hooks ?? {},
    touch: overrides.touch,
    touchActive: true,
    sendMovementEdge: overrides.sendMovementEdge ?? vi.fn(),
    performInteract: overrides.performInteract ?? vi.fn(),
    throwSelected: vi.fn(),
  } as unknown as PointerDeps;
}
