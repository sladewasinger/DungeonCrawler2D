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
  giveUp: false,
  ...overrides,
});

const connection = (downed = false) => ({
  body: { x: 0, y: 0 },
  party: {
    id: "party",
    members: [{ id: "ally", name: "Ally", x: 1, y: 0, hp: 0, maxHp: 30, downed }],
  },
  hotbar: [],
  entities: new Map(),
  downed: false,
  attack: vi.fn(),
  interact: vi.fn(),
  pickup: vi.fn(),
  throwTorch: vi.fn(),
  useSlot: vi.fn(),
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

  it("holds near a downed teammate before publishing the revive intent", () => {
    const now = vi.spyOn(performance, "now");
    const conn = connection(true);
    const controller = new ThreeActionController(conn);
    const world = new World(1, 1);

    now.mockReturnValue(0);
    controller.publish(world, sample({ interactPressed: true, interactHeld: true }));
    now.mockReturnValue(599);
    controller.publish(world, sample({ interactHeld: true }));
    expect(conn.interact).not.toHaveBeenCalled();

    now.mockReturnValue(600);
    controller.publish(world, sample({ interactHeld: true }));
    expect(conn.interact).toHaveBeenCalledOnce();
  });

  it("keeps stair descent ahead of a nearby revive target", () => {
    const world = new World(228182761, 1);
    const stairs = stairwayDownPosition(world);
    expect(stairs).not.toBeNull();
    const conn = connection(true);
    conn.body = { x: stairs!.x, y: stairs!.y } as Connection["body"];
    conn.party!.members[0]!.x = stairs!.x;
    conn.party!.members[0]!.y = stairs!.y;
    conn.descend = vi.fn();

    new ThreeActionController(conn).publish(world, sample({
      interactPressed: true,
      interactHeld: true,
    }));

    expect(conn.descend).toHaveBeenCalledOnce();
    expect(conn.interact).not.toHaveBeenCalled();
  });
});
