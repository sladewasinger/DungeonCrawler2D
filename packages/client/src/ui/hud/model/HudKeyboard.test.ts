/** Guards the shared HUD shortcut boundary independently of browser rendering. */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TextEntryTarget,
  install,
  keyboardEvent,
  model,
} from "./HudKeyboard.testSupport.js";

afterEach(() => vi.unstubAllGlobals());

describe("HudKeyboard", () => {
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

  it("uses Tab for inventory even when chat owns focus", () => {
    const state = model();
    state.setChatFocused(true);
    const listener = install(state);
    const event = keyboardEvent("Tab");

    listener(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(state.actions.toggleInventory).toHaveBeenCalledOnce();
    expect(state.actions.closeInventory).not.toHaveBeenCalled();
  });

  it("prevents browser focus traversal from ordinary HUD elements", () => {
    const state = model();
    const listener = install(state);
    const event = keyboardEvent("Tab", {} as EventTarget);

    listener(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(state.actions.toggleInventory).toHaveBeenCalledOnce();
  });

  it("opens the session menu when Escape is pressed outside an overlay", () => {
    const state = model();
    const listener = install(state);
    const event = keyboardEvent("Escape");

    expect(() => listener(event)).not.toThrow();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(state.actions.toggleSessionMenu).toHaveBeenCalledOnce();
  });

  it("lets Phaser movement keys pass through the shared HUD listener", () => {
    const state = model();
    const listener = install(state);
    const event = keyboardEvent("KeyW");

    expect(() => listener(event)).not.toThrow();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(state.actions.toggleInventory).not.toHaveBeenCalled();
  });

  it("leaves F12 completely untouched for browser developer tools", () => {
    const state = model();
    const listener = install(state);
    const event = keyboardEvent("F12");

    listener(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopImmediatePropagation).not.toHaveBeenCalled();
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
