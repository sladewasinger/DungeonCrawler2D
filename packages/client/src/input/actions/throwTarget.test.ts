import { MAX_THROW_RANGE } from "@dc2d/engine";
import type Phaser from "phaser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetViewOrientation } from "../../render/view/index.js";
import { createTouchInputState } from "../touch/index.js";
import type {
  InputConnection,
  InputQueries,
  InputState,
} from "../controls/state.js";
import { throwSelected } from "./aim.js";
import {
  resolveCurrentThrowTarget,
  resolveThrowTarget,
  type CurrentThrowTargetRequest,
} from "./throwTarget.js";

afterEach(() => resetViewOrientation());

describe("throw target clamping", () => {
  it("keeps a pointer target that is already within range", () => {
    expect(resolveThrowTarget({
      slot: 2,
      origin: { x: 1, y: 2 },
      pointerTarget: { x: 4, y: 6 },
      fallbackDirection: { x: -1, y: 0 },
    })).toEqual({ slot: 2, x: 4, y: 6 });
  });

  it("clamps a distant pointer along its original direction", () => {
    const target = resolveThrowTarget({
      slot: 1,
      origin: { x: 3, y: 4 },
      pointerTarget: { x: 33, y: 44 },
      fallbackDirection: { x: 0, y: -1 },
    });
    const scale = MAX_THROW_RANGE / 50;
    expect(target.x).toBeCloseTo(3 + 30 * scale);
    expect(target.y).toBeCloseTo(4 + 40 * scale);
    expect(Math.hypot(target.x - 3, target.y - 4)).toBeCloseTo(MAX_THROW_RANGE);
  });

  it("uses movement-facing at maximum range when no pointer target exists", () => {
    expect(resolveThrowTarget({
      slot: 0,
      origin: { x: 5, y: 5 },
      fallbackDirection: { x: 0, y: -2 },
    })).toEqual({ slot: 0, x: 5, y: 5 - MAX_THROW_RANGE });
  });
});

describe("live throw target parity", () => {
  it("uses the same elevation-aware resolved point for preview and release", () => {
    const useSlot = vi.fn();
    const request = runtimeRequest(useSlot);
    const previewTarget = resolveCurrentThrowTarget(request);

    throwSelected(request);

    expect(previewTarget).toEqual({ slot: 1, x: 6.25, y: 5.125 });
    expect(useSlot).toHaveBeenCalledWith(
      previewTarget!.slot,
      previewTarget!.x,
      previewTarget!.y,
    );
  });
});

function runtimeRequest(useSlot: InputConnection["useSlot"]): CurrentThrowTargetRequest {
  const heightAt = (x: number, y: number) => x === 6 && y === 5 ? 2 : 0;
  const scene = {
    cameras: {
      main: { getWorldPoint: (x: number, y: number) => ({ x: x * 2, y: y * 2 }) },
    },
    input: { activePointer: { x: 100, y: 50 } },
  } as unknown as Phaser.Scene;
  const conn = {
    body: { x: 6.25, y: 3.125 },
    hotbar: ["torch", "bomb"],
    heightAt,
    useSlot,
    throwTorch: vi.fn(),
  } as unknown as InputConnection;
  const state = {
    selectedSlot: 1,
    kidMode: { active: false, facingX: 1, facingY: 0 },
  } as InputState;
  const queries = {
    isThrowable: (id: string) => id === "bomb",
  } as unknown as InputQueries;
  return {
    scene,
    conn,
    state,
    queries,
    touch: createTouchInputState(),
    touchActive: false,
    tilePx: 32,
  };
}
