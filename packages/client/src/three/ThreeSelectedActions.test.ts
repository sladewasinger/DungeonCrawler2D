/** Locks first-person hotbar use/throw priority to the established 2D contract. */
import { TILE, type TileType, World } from "@dc2d/engine";
import { describe, expect, it, vi } from "vitest";
import {
  throwSelectedItem,
  useSelectedOrInteract,
  type ThreeActionPort,
} from "./ThreeSelectedActions.js";

const connection = (
  item: string | null,
) => {
  const port = {
    body: { x: 1.2, y: 1.2 },
    hotbar: [item],
    interact: vi.fn(() => undefined),
    descend: vi.fn(() => undefined),
    useSlot: vi.fn<ThreeActionPort["useSlot"]>(),
    throwTorch: vi.fn<ThreeActionPort["throwTorch"]>(),
  };
  return port satisfies ThreeActionPort;
};

const world = (tile: TileType = TILE.Floor): World => ({
  floor: 1,
  worldSeed: 228182761,
  tileAt: () => tile,
}) as unknown as World;

describe("Three.js selected item actions", () => {
  it("uses a selected bandage when no world interaction wins", () => {
    const port = connection("bandage");
    useSelectedOrInteract(port, world(), 0);
    expect(port.useSlot).toHaveBeenCalledWith(0);
    expect(port.interact).not.toHaveBeenCalled();
  });

  it("gives a nearby door priority over a selected bandage", () => {
    const port = connection("bandage");
    useSelectedOrInteract(port, world(TILE.DoorExit), 0);
    expect(port.interact).toHaveBeenCalledOnce();
    expect(port.useSlot).not.toHaveBeenCalled();
  });

  it("throws torches along first-person yaw", () => {
    const port = connection("torch");
    throwSelectedItem(port, 0, Math.PI / 2);
    expect(port.throwTorch).toHaveBeenCalledWith(-1, expect.closeTo(0));
  });

  it("does not throw non-throwable bandages", () => {
    const port = connection("bandage");
    throwSelectedItem(port, 0, 0);
    expect(port.useSlot).not.toHaveBeenCalled();
    expect(port.throwTorch).not.toHaveBeenCalled();
  });
});
