import { describe, expect, it } from "vitest";
import { ModalRouter, type ModalEntry, type ModalId } from "./modalRouter.js";

function makeFakeModal(): { readonly entry: ModalEntry; readonly state: { open: boolean; opens: number; closes: number } } {
  const state = { open: false, opens: 0, closes: 0 };
  return {
    state,
    entry: {
      isOpen: () => state.open,
      open: () => { state.open = true; state.opens += 1; },
      close: () => { state.open = false; state.closes += 1; },
    },
  };
}

describe("ModalRouter [client]", () => {
  it("closes competing open modals when opening or toggling another modal", () => {
    const router = new ModalRouter();
    const inv = makeFakeModal();
    const settings = makeFakeModal();
    const chat = makeFakeModal();
    const entries: readonly [ModalId, ModalEntry][] = [
      ["inventory", inv.entry],
      ["settings", settings.entry],
      ["chat", chat.entry],
    ];
    for (const [id, entry] of entries) router.register(id, entry);

    expect(router.isAnyOpen()).toBe(false);
    router.open("inventory");
    expect(router.activeModal()).toBe("inventory");
    expect(inv.state.open).toBe(true);

    router.toggle("settings");
    expect(inv.state.open).toBe(false);
    expect(settings.state.open).toBe(true);
    expect(router.activeModal()).toBe("settings");

    expect(router.toggle("settings")).toBe(false);
    expect(router.isAnyOpen()).toBe(false);

    router.open("chat");
    expect(router.closeAll()).toBe(true);
    expect(router.closeAll()).toBe(false);
  });
});
