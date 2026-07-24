import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  LEVEL,
  PLAYER_MAX_HP,
  World,
  buildContentRegistry,
  hashString,
  type ContentRegistry,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { PlayerStore } from "../store.js";
import { resolveDeaths } from "./deaths.js";
import { invQty } from "./inventory.js";
import { addPlayer } from "./join.js";
import { reapAndRespawn } from "./players.js";
import { createSimState, type PlayerSlot, type SimState } from "./state.js";

/**
 * Panel round 4, BookFan: "respawn comes back UNARMED — starter sword not
 * re-granted". Hand-derived expectations for the full join -> death ->
 * respawn inventory flow: the starter kit is exactly 1 "sword" (equipped)
 * + 3 "torch", and a respawn must re-grant it unconditionally — including
 * the round-4 repro where a starter item parked in the STASH made
 * ensureStarterKit's farm-safety check skip the grant entirely.
 */

const content: ContentRegistry = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

function expectFullKit(slot: PlayerSlot): void {
  expect(slot.weapon).toBe("sword");
  expect(invQty(slot, "sword")).toBe(1);
  expect(invQty(slot, "torch")).toBe(3);
  expect(invQty(slot, "bandage")).toBe(2);
  expect(slot.hotbar[0]).toBe("bandage");
}

/** Kill, resolve the death, then jump to the scheduled respawn tick. */
function dieAndRespawn(sim: SimState, slot: PlayerSlot): void {
  slot.entity.hp = 0;
  resolveDeaths(sim);
  // Full-loot death: everything hits the floor, hands go empty.
  expect(slot.weapon).toBeNull();
  expect(slot.inventory).toHaveLength(0);
  expect(slot.respawnAtTick).not.toBeNull();
  sim.tickCount = slot.respawnAtTick as number;
  reapAndRespawn(sim);
}

describe("respawn starter kit (panel round 4)", () => {
  let sim: SimState;
  let slot: PlayerSlot;

  beforeEach(() => {
    const world = new World(hashString("respawn-kit-test"), 1, LEVEL.Dungeon);
    sim = createSimState(world, content, new PlayerStore(null), 9, { spawnRadiusTiles: 12 });
    const join = addPlayer(sim, "Kit", "client-kit");
    slot = sim.players.get(join.playerId)!;
  });

  it("a fresh join is armed and carries torches plus two bandages", () => {
    expectFullKit(slot);
  });

  it("die once -> respawn re-grants the kit, sword equipped again", () => {
    dieAndRespawn(sim, slot);
    expect(slot.entity.hp).toBe(PLAYER_MAX_HP);
    expectFullKit(slot);
  });

  it("regression (BookFan round 4): a starter item in the STASH no longer blocks the re-grant", () => {
    // Pre-fix, ensureStarterKit treated any stashed sword/torch as "has
    // the kit" and skipped the grant — the exact UNARMED respawn seen in
    // the round-4 death screens.
    slot.stored.stash.push({ item: "torch", qty: 2 });
    dieAndRespawn(sim, slot);
    expectFullKit(slot);
    // The stash itself is untouched: the re-grant never raids or dedupes it.
    expect(slot.stored.stash).toEqual([{ item: "torch", qty: 2 }]);
  });

  it("repeat deaths re-arm every time (never permanently Unarmed)", () => {
    dieAndRespawn(sim, slot);
    dieAndRespawn(sim, slot);
    expect(slot.entity.hp).toBe(PLAYER_MAX_HP);
    expectFullKit(slot);
  });
});
