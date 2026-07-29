import { describe, expect, it } from "vitest";
import type { EffectEvent } from "@dc2d/engine";
import { addEnemyTestPlayer, createEnemyTestSim, findEnemyTestFloor } from "../../enemies/tests/enemyAiTestSupport.js";
import { applyAreaContact } from "../statuses.js";
import { resolveFireContact } from "./fireContact.js";

const FIRE_STATUS_ID = "on-fire";
const OIL_STATUS_ID = "oiled";
const FIRE_SOURCE_TAG = "fire";
const TORCH_SOURCE_ID = "torch-owner";
const BURNING_SOURCE_ID = "first-flame";

describe("authoritative fire contacts", () => {
  it("carries a burning entity's attribution into an oil area once", () => {
    const sim = createEnemyTestSim();
    const spot = findEnemyTestFloor(sim);
    const player = addEnemyTestPlayer(sim, spot);
    const events: EffectEvent[] = [];
    sim.effects.applyStatus({
      entity: player.entity,
      statusId: FIRE_STATUS_ID,
      sourceId: BURNING_SOURCE_ID,
      events,
    });
    const x = Math.floor(spot.x);
    const y = Math.floor(spot.y);
    sim.areas.place({ defId: "area-oil", x, y, steps: 0, sourceId: "oil" });

    applyAreaContact(sim, events);
    expect(sim.areas.defAt(x, y)).toBe("area-fire");
    expect(sim.areas.sourceIdAt(x, y)).toBe(BURNING_SOURCE_ID);
    applyAreaContact(sim, events);
    expect(sim.areas.sourceIdAt(x, y)).toBe(BURNING_SOURCE_ID);
  });

  it("ignites only oiled entities and consumes their oil", () => {
    const sim = createEnemyTestSim();
    const spot = findEnemyTestFloor(sim);
    const oiled = addEnemyTestPlayer(sim, spot, "oiled");
    const bare = addEnemyTestPlayer(sim, { x: spot.x + 2, y: spot.y }, "bare");
    const events: EffectEvent[] = [];
    sim.effects.applyStatus({ entity: oiled.entity, statusId: OIL_STATUS_ID, events });

    expect(resolveFireContact({
      sim,
      source: { tags: new Set([FIRE_SOURCE_TAG]), sourceId: TORCH_SOURCE_ID },
      target: { kind: "entity", entity: oiled.entity },
      effectEvents: events,
    })).toBe(true);
    expect(oiled.entity.statuses).toContainEqual(expect.objectContaining({
      defId: FIRE_STATUS_ID,
      sourceId: TORCH_SOURCE_ID,
    }));
    expect(oiled.entity.statuses.some((status) => status.defId === "oiled")).toBe(false);
    expect(oiled.entity.hp).toBe(oiled.entity.maxHp);

    expect(resolveFireContact({
      sim,
      source: { tags: new Set([FIRE_SOURCE_TAG]), sourceId: TORCH_SOURCE_ID },
      target: { kind: "entity", entity: bare.entity },
      effectEvents: events,
    })).toBe(false);
    expect(bare.entity.statuses).toHaveLength(0);
  });
});
