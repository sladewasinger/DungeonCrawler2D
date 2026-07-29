import { describe, expect, it, vi } from "vitest";
import {
  EntityStatusVisualPool,
  type StatusVisualRigFactory,
} from "./entityStatusVisualPool.js";
import { statusVisualBudgetFor } from "./statusVisualBudget.js";
import type { StatusVisualRig } from "./statusVisualRig.js";

function combatant(fx: readonly string[], hp = 10) {
  return {
    visual: { body: {}, shadow: { y: 42 } },
    view: { fx, hp },
  };
}

function fakeFactory(rigs: StatusVisualRig[]): StatusVisualRigFactory {
  return () => {
    const rig: StatusVisualRig = {
      activate: vi.fn(),
      sync: vi.fn(),
      reset: vi.fn(),
      destroy: vi.fn(),
    };
    rigs.push(rig);
    return rig;
  };
}

function sync(pool: EntityStatusVisualPool, id: string, fx: readonly string[]): void {
  const target = combatant(fx);
  pool.syncEntity(id, target.visual as never, target.view);
}

describe("EntityStatusVisualPool", () => {
  it("uses the same on-fire and oil lifecycle for enemy, local, and remote combatants", () => {
    const rigs: StatusVisualRig[] = [];
    const pool = new EntityStatusVisualPool(
      fakeFactory(rigs),
      statusVisualBudgetFor(false, false),
    );
    pool.beginFrame(100);
    for (const id of ["enemy", "local-player", "remote-player"]) {
      sync(pool, id, ["on-fire", "oiled"]);
    }
    pool.endFrame();
    expect(rigs).toHaveLength(3);
    for (const rig of rigs) expect(rig.sync).toHaveBeenCalledOnce();
  });

  it("releases immediately on expiry, death, and despawn, then clears a reused rig", () => {
    const rigs: StatusVisualRig[] = [];
    const pool = new EntityStatusVisualPool(
      fakeFactory(rigs),
      statusVisualBudgetFor(false, false),
    );
    pool.beginFrame(0);
    sync(pool, "first", ["on-fire"]);
    pool.endFrame();
    pool.beginFrame(16);
    sync(pool, "first", []);
    pool.endFrame();
    expect(rigs[0]?.reset).toHaveBeenCalled();

    pool.beginFrame(32);
    sync(pool, "second", ["on-fire"]);
    pool.endFrame();
    expect(rigs).toHaveLength(1);
    expect(rigs[0]?.activate).toHaveBeenCalledTimes(2);

    pool.beginFrame(48);
    const dead = combatant(["on-fire"], 0);
    pool.syncEntity("second", dead.visual as never, dead.view);
    pool.endFrame();
    pool.beginFrame(64);
    sync(pool, "third", ["on-fire"]);
    pool.endFrame();
    pool.beginFrame(80);
    pool.endFrame();
    expect(rigs[0]?.reset).toHaveBeenCalledTimes(3);
  });

  it("reuses rigs across sustained frames and enforces the configured active cap", () => {
    const rigs: StatusVisualRig[] = [];
    const budget = { ...statusVisualBudgetFor(true, true), maximumActiveRigs: 1 };
    const pool = new EntityStatusVisualPool(fakeFactory(rigs), budget);
    for (let frame = 0; frame < 1_000; frame++) {
      pool.beginFrame(frame * 16);
      sync(pool, "kept", ["on-fire"]);
      sync(pool, "over-budget", ["on-fire"]);
      pool.endFrame();
    }
    expect(rigs).toHaveLength(1);
    expect(rigs[0]?.sync).toHaveBeenCalledTimes(1_000);
  });
});
