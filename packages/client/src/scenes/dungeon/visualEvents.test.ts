/** Ensures authoritative healing feedback never enters the damage/blood presentation path. */
import { describe, expect, it, vi } from "vitest";
import type { Connection } from "../../net/connection.js";
import { HEAL_FEEDBACK_COLOR } from "../../ui/healthFeedback.js";
import type { VfxSystem } from "../../vfx/index.js";
import { applyVisualEvents } from "./visualEvents.js";

describe("visual health events", () => {
  it("shows green +4 feedback without blood or own-hit reactions", () => {
    const spawnDamageNumber = vi.fn();
    const spawnBloodHit = vi.fn();
    const onOwnHit = vi.fn();
    const connection = {
      hp: 14,
      maxHp: 30,
      welcome: { playerId: "player-1" },
      entities: new Map(),
      world: null,
      drainVisualEvents: () => [{
        t: "health",
        id: "player-1",
        delta: 4,
        kind: "heal",
      }],
    } as unknown as Connection;
    const vfx = {
      setSelfHp: vi.fn(),
      spawnDamageNumber,
      spawnBloodHit,
      onOwnHit,
    } as unknown as VfxSystem;

    applyVisualEvents(
      connection,
      vfx,
      { x: 2, y: 3, z: 0 },
      new Map(),
      100,
    );

    expect(spawnDamageNumber).toHaveBeenCalledWith(
      2,
      2.4,
      {
        kind: "heal",
        delta: 4,
        label: "+4",
        color: HEAL_FEEDBACK_COLOR,
      },
      100,
    );
    expect(spawnBloodHit).not.toHaveBeenCalled();
    expect(onOwnHit).not.toHaveBeenCalled();
  });
});
