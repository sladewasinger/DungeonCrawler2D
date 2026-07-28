import { vi } from "vitest";
import type { HudKeyboardActions } from "./HudKeyboard.js";
import { HudKeyboard } from "./HudKeyboard.js";

export type KeyListener = (event: KeyboardEvent) => void;

export interface KeyboardModel {
  actions: HudKeyboardActions;
  setChatFocused(value: boolean): void;
  setInventoryOpen(value: boolean): void;
}

export function model(): KeyboardModel {
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

export function keyboardEvent(code: string, target?: EventTarget): KeyboardEvent {
  return {
    code,
    target,
    defaultPrevented: false,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

export class TextEntryTarget {
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

export function install(modelValue: KeyboardModel): KeyListener {
  let listener: KeyListener | undefined;
  vi.stubGlobal("window", {
    addEventListener: (_type: string, candidate: KeyListener) => {
      listener = candidate;
    },
    removeEventListener: vi.fn(),
  });
  new HudKeyboard(modelValue.actions, true);
  if (!listener) throw new Error("keyboard listener was not installed");
  return listener;
}
