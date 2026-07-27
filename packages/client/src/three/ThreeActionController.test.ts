/* eslint-disable max-lines -- interaction gesture scenarios share one fixture. */
import { World, stairwayDownPosition } from "@dc2d/engine";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Connection } from "../net/connection.js";
import { ThreeActionController } from "./ThreeActionController.js";
import type { ThreeInputSample } from "./ThreeInput.js";

const sample = (overrides: Partial<ThreeInputSample>): ThreeInputSample => ({
  input: { forward: 0, right: 0, jump: false, yaw: 0 },
  yaw: 0,
  pitch: 0,
  mouseCaptured: true,
  attack: false,
  interactPressed: false,
  interactHeld: false,
  throwItem: false,
  bandageOther: false,
  ...overrides,
});

const connection = (downed = false) => ({
  body: { x: 0, y: 0 },
  party: {
    id: "party",
    members: [{ id: "ally", name: "Ally", x: 1, y: 0, hp: 0, maxHp: 30, downed }],
  },
  hotbar: [],
  inventory: [],
  entities: downed
    ? new Map([["ally", {
      snap: {
        id: "ally",
        kind: "player",
        x: 1,
        y: 0,
        z: 0,
        downed: true,
      },
    }]])
    : new Map(),
  downed: false,
  dead: false,
  attack: vi.fn(),
  interact: vi.fn(),
  lootChestOp: vi.fn(),
  pickup: vi.fn(),
  throwTorch: vi.fn(),
  useSlot: vi.fn(),
  useSlotOnPlayer: vi.fn(),
  revive: vi.fn(),
  suicide: vi.fn(),
}) as unknown as Connection;

describe("ThreeActionController interaction gesture", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fires an ordinary use press immediately", () => {
    const conn = connection();
    new ThreeActionController(conn).publish(new World(1, 1), sample({
      interactPressed: true,
      interactHeld: true,
    }));
    expect(conn.interact).toHaveBeenCalledOnce();
  });

  it("publishes held revive state for a nearby downed teammate", () => {
    const now = vi.spyOn(performance, "now");
    const conn = connection(true);
    const controller = new ThreeActionController(conn);
    const world = new World(1, 1);

    now.mockReturnValue(0);
    controller.publish(world, sample({ interactPressed: true, interactHeld: true }));
    expect(conn.revive).toHaveBeenCalledWith("ally", true);
    expect(conn.interact).not.toHaveBeenCalled();

    now.mockReturnValue(600);
    controller.publish(world, sample({ interactHeld: false }));
    expect(conn.revive).toHaveBeenLastCalledWith("ally", false);
  });

  it("keeps stair descent ahead of a nearby revive target", () => {
    const world = new World(228182761, 1);
    const stairs = stairwayDownPosition(world);
    expect(stairs).not.toBeNull();
    const conn = connection(true);
    if (!stairs || !conn.party || !conn.party.members[0]) {
      throw new Error("stair and party fixtures are required");
    }
    conn.body = { x: stairs.x, y: stairs.y } as Connection["body"];
    conn.party.members[0].x = stairs.x;
    conn.party.members[0].y = stairs.y;
    conn.descend = vi.fn();

    new ThreeActionController(conn).publish(world, sample({
      interactPressed: true,
      interactHeld: true,
    }));

    expect(conn.descend).toHaveBeenCalledOnce();
    expect(conn.interact).not.toHaveBeenCalled();
  });

  it("does not accept E as an early-respawn shortcut while dead", () => {
    const now = vi.spyOn(performance, "now");
    const conn = connection();
    Object.defineProperty(conn, "dead", { value: true });
    const controller = new ThreeActionController(conn);
    const world = new World(1, 1);

    now.mockReturnValue(0);
    controller.publish(world, sample({ interactPressed: true, interactHeld: true }));
    now.mockReturnValue(5_000);
    controller.publish(world, sample({ interactHeld: true }));
    expect(conn.suicide).not.toHaveBeenCalled();
  });

  it("opens nearby death loot for the killer but not during another player's lock", () => {
    const conn = connection();
    conn.serverTick = 20;
    conn.welcome = { playerId: "stranger" } as Connection["welcome"];
    conn.entities.set("loot", {
      snap: {
        id: "loot",
        kind: "item",
        defId: "player-loot-chest",
        x: 1,
        y: 0,
        z: 0,
        lootKillerId: "killer",
        lootUnlockAtTick: 1_220,
      },
      samples: [],
    });
    const toggleStash = vi.fn(() => true);
    const controller = new ThreeActionController(conn, {
      toggleCraft: vi.fn(),
      toggleStash,
    });
    const input = sample({ interactPressed: true, interactHeld: true });

    controller.publish(new World(1, 1), input);
    expect(conn.lootChestOp).toHaveBeenCalledWith("loot", "open");
    expect(conn.interact).not.toHaveBeenCalled();
    expect(toggleStash).not.toHaveBeenCalled();

    conn.welcome = { playerId: "killer" } as Connection["welcome"];
    controller.publish(new World(1, 1), input);
    expect(toggleStash).toHaveBeenCalledOnce();
  });

  it("uses F to bandage the nearest player when bandages are selected", () => {
    const conn = connection();
    conn.hotbar = ["bandage"];
    conn.inventory = [{ item: "bandage", qty: 1 }];
    conn.entities.set("near", {
      snap: { id: "near", kind: "player", x: 1, y: 0 },
      samples: [],
    } as never);
    conn.entities.set("far", {
      snap: { id: "far", kind: "player", x: 3, y: 0 },
      samples: [],
    } as never);
    const controller = new ThreeActionController(conn);
    controller.selectHotbar(0);

    controller.publish(new World(1, 1), sample({ bandageOther: true }));

    expect(conn.useSlotOnPlayer).toHaveBeenCalledWith(0, "near");
  });
});
