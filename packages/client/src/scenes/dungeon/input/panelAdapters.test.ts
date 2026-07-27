import { describe, expect, it, vi } from "vitest";
import type { InputConnection, InputQueries } from "../../../input/index.js";
import { createInputPanels, type PanelSource } from "./panelAdapters.js";

const setup = () => {
  let craft = false;
  let stash = false;
  const source = {
    inventoryOpen: () => true,
    blocksGameplay: () => true,
    selectedInventoryItem: () => null,
    closeInventory: vi.fn(),
    craftOpen: () => craft,
    toggleCraftPanel: () => {
      craft = !craft;
    },
    closeCraftPanel: vi.fn(() => {
      craft = false;
    }),
    stashOpen: () => stash,
    openStashPanel: vi.fn(() => {
      stash = true;
    }),
    closeStashPanel: vi.fn(() => {
      stash = false;
    }),
  } satisfies PanelSource;
  const queries = {
    isCraftTableNearby: () => true,
    isStashNearby: () => true,
  } as unknown as InputQueries;
  const conn = { pushToast: vi.fn() } as unknown as InputConnection;
  return { source, panels: createInputPanels(source, queries), conn };
};

describe("input panels", () => {
  it("toggles craft and stash while keeping them mutually exclusive", () => {
    const { panels, conn } = setup();
    panels.toggleCraft(conn);
    expect(panels.craftOpen).toBe(true);
    expect(panels.toggleStash(conn)).toBe(true);
    expect(panels.craftOpen).toBe(false);
    expect(panels.stashOpen).toBe(true);
    expect(panels.toggleStash(conn)).toBe(false);
    expect(panels.stashOpen).toBe(false);
  });

  it("closes every modal panel through the shared Escape path", () => {
    const { panels, source, conn } = setup();
    panels.toggleCraft(conn);
    panels.closeAll(conn);
    expect(source.closeInventory).toHaveBeenCalledOnce();
    expect(source.closeCraftPanel).toHaveBeenCalled();
    expect(source.closeStashPanel).toHaveBeenCalled();
  });
});
