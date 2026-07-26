import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreeDownedOverlay } from "./ThreeDownedOverlay.js";

interface FakeElement {
  hidden: boolean;
  parentElement: FakeElement | null;
  style: { cssText: string; width?: string };
  textContent: string;
  type: string;
  children: FakeElement[];
  append(...children: FakeElement[]): void;
  addEventListener(type: string, listener: (event: { stopPropagation(): void }) => void): void;
  click(): void;
}

const element = (): FakeElement => {
  const listeners = new Map<string, (event: { stopPropagation(): void }) => void>();
  return {
    hidden: false,
    parentElement: null,
    style: { cssText: "" },
    textContent: "",
    type: "",
    children: [],
    append(...children) {
      for (const child of children) child.parentElement = this;
      this.children.push(...children);
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    click() {
      listeners.get("click")?.({ stopPropagation: vi.fn() });
    },
  };
};

const findButton = (root: FakeElement): FakeElement | undefined => {
  if (root.type === "button") return root;
  for (const child of root.children) {
    const match = findButton(child);
    if (match) return match;
  }
  return undefined;
};

afterEach(() => vi.unstubAllGlobals());

describe("ThreeDownedOverlay direct respawn", () => {
  it("shows only while dead and invokes the authoritative action once per click", () => {
    vi.stubGlobal("document", { createElement: element });
    const parent = element();
    const respawnNow = vi.fn();
    const overlay = new ThreeDownedOverlay(parent as never, respawnNow);
    const button = findButton(parent);
    expect(button).toBeDefined();
    overlay.update({
      downed: true,
      dead: false,
      downedSecondsRemaining: 10,
      reviverName: null,
      respawnSecondsRemaining: 0,
      reviveProgress: 0,
    } as never);
    expect(button?.hidden).toBe(true);
    overlay.update({
      downed: false,
      dead: true,
      downedSecondsRemaining: 0,
      reviverName: null,
      respawnSecondsRemaining: 10,
      reviveProgress: 0,
    } as never);
    expect(button?.hidden).toBe(false);
    button?.click();
    expect(respawnNow).toHaveBeenCalledOnce();
  });
});
