/** Guards the shared HUD shortcut boundary independently of browser rendering. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreeHudKeyboard, type ThreeHudKeyboardActions } from "./ThreeHudKeyboard.js";

type KeyListener = (event: KeyboardEvent) => void;

interface KeyboardModel {
  actions: ThreeHudKeyboardActions;
  setChatFocused(value: boolean): void;
  setInventoryOpen(value: boolean): void;
}

function model(): KeyboardModel {
  let chatFocused = false;
  let inventoryOpen = false;
  return {
    actions: {
      toggleInventory: vi.fn(),
      closeInventory: vi.fn(),
      inventoryOpen: () => inventoryOpen,
      selectHotbar: vi.fn(),
      focusChat: vi.fn(),
      leaveChat: vi.fn(),
      chatOwnsFocus: () => chatFocused,
      closeOverlays: () => false,
      sessionMenuOpen: () => false,
      toggleSessionMenu: vi.fn(),
      closeSessionMenu: vi.fn(),
    },
    setChatFocused: (value) => { chatFocused = value; },
    setInventoryOpen: (value) => { inventoryOpen = value; },
  };
}

function keyboardEvent(
  code: string,
  target?: EventTarget,
): KeyboardEvent {
  return {
    code,
    target,
    defaultPrevented: false,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

class TextEntryTarget {
  constructor(private readonly insideInventory: boolean) {}

  matches(selector: string): boolean {
    return selector.includes("input");
  }

  closest(selector: string): TextEntryTarget | null {
    return selector === "[data-inventory-workspace]" && this.insideInventory
      ? this
      : null;
  }
}

function install(modelValue: KeyboardModel): KeyListener {
  let listener: KeyListener | undefined;
  vi.stubGlobal("window", {
    addEventListener: (_type: string, candidate: KeyListener) => {
      listener = candidate;
    },
    removeEventListener: vi.fn(),
  });
  new ThreeHudKeyboard(modelValue.actions, true);
  if (!listener) throw new Error("keyboard listener was not installed");
  return listener;
}

afterEach(() => vi.unstubAllGlobals());

describe("ThreeHudKeyboard", () => {
  it("gives focused chat exclusive ownership of HUD shortcuts", () => {
    const state = model();
    state.setChatFocused(true);
    const listener = install(state);

    listener(keyboardEvent("KeyI"));
    listener(keyboardEvent("Digit4"));
    listener(keyboardEvent("Enter"));

    expect(state.actions.toggleInventory).not.toHaveBeenCalled();
    expect(state.actions.selectHotbar).not.toHaveBeenCalled();
    expect(state.actions.focusChat).not.toHaveBeenCalled();
  });

  it("keeps Tab in focused chat instead of passing it to inventory", () => {
    const state = model();
    state.setChatFocused(true);
    const listener = install(state);
    const event = keyboardEvent("Tab");

    listener(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(state.actions.toggleInventory).not.toHaveBeenCalled();
    expect(state.actions.closeInventory).not.toHaveBeenCalled();
  });

  it("closes an open inventory with Tab instead of focus-cycling its controls", () => {
    const state = model();
    state.setInventoryOpen(true);
    const listener = install(state);

    listener(keyboardEvent("Tab"));

    expect(state.actions.closeInventory).toHaveBeenCalledOnce();
    expect(state.actions.toggleInventory).not.toHaveBeenCalled();
  });

  it("does not leak inventory-filter text into HUD shortcuts", () => {
    vi.stubGlobal("Element", TextEntryTarget);
    const state = model();
    state.setInventoryOpen(true);
    const listener = install(state);
    const target = new TextEntryTarget(true) as unknown as EventTarget;

    listener(keyboardEvent("KeyI", target));
    listener(keyboardEvent("Digit4", target));
    listener(keyboardEvent("Enter", target));

    expect(state.actions.toggleInventory).not.toHaveBeenCalled();
    expect(state.actions.closeInventory).not.toHaveBeenCalled();
    expect(state.actions.selectHotbar).not.toHaveBeenCalled();
    expect(state.actions.focusChat).not.toHaveBeenCalled();
  });

  it("keeps inventory Tab as an explicit close shortcut from its filter", () => {
    vi.stubGlobal("Element", TextEntryTarget);
    const state = model();
    state.setInventoryOpen(true);
    const listener = install(state);
    const event = keyboardEvent(
      "Tab",
      new TextEntryTarget(true) as unknown as EventTarget,
    );

    listener(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(state.actions.closeInventory).toHaveBeenCalledOnce();
    expect(state.actions.toggleInventory).not.toHaveBeenCalled();
  });
});
