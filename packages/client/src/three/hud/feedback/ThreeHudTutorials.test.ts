/** Verifies tutorial presentation, authoritative gating, dismissal, and replay. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreeHudTutorials } from "./ThreeHudTutorials.js";

interface ConnectionState {
  inventory: Array<{ item: string; qty: number }>;
  hotbar: Array<string | null>;
  hp: number;
}

const connection = (
  received: boolean,
  patch: Partial<ConnectionState> = {},
) => ({
  hasReceivedSnapshot: received,
  inventory: [
    { item: "torch", qty: 3 },
    { item: "bandage", qty: 2 },
  ],
  hotbar: ["torch", "bandage", null, null, null, null, null, null, null],
  hp: 30,
  maxHp: 30,
  ...patch,
});

const installBrowser = () => {
  const storage = new Map<string, string>();
  const animate = vi.fn();
  vi.stubGlobal("document", {
    createElement: () => {
      const attributes = new Map<string, string>();
      return {
        animate,
        hidden: false,
        style: { cssText: "" },
        textContent: "",
        setAttribute: (name: string, value: string) =>
          attributes.set(name, value),
        getAttribute: (name: string) => attributes.get(name) ?? null,
      };
    },
  });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  return { animate, storage };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThreeHudTutorials", () => {
  const keyboardHint = "[1–9]";
  const lowHealth = "Health low";
  it("renders a polite borderless hint above the hotbar with gentle motion", () => {
    const { animate } = installBrowser();
    const tutorials = new ThreeHudTutorials("keyboard");
    expect(tutorials.element.getAttribute("role")).toBe("status");
    expect(tutorials.element.getAttribute("aria-live")).toBe("polite");
    expect(tutorials.element.getAttribute("aria-atomic")).toBe("true");
    expect(tutorials.element.style.cssText).toContain("bottom:78px");
    expect(tutorials.element.style.cssText).toContain("background:transparent");
    expect(tutorials.element.style.cssText).toContain("border:0");
    expect(animate).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ duration: 2400, iterations: Infinity }),
    );
  });

  it("ignores stale pre-snapshot state before showing hydration guidance", () => {
    installBrowser();
    const tutorials = new ThreeHudTutorials("keyboard");
    tutorials.update(connection(false) as never, null, 0);
    tutorials.update(connection(false) as never, null, 10_000);
    tutorials.update(connection(false) as never, null, 20_000);
    tutorials.update(connection(true) as never, null, 20_001);
    expect(tutorials.element.hidden).toBe(false);
    expect(tutorials.element.textContent).toContain(keyboardHint);
  });

  it("replaces generic guidance only after a populated slot is selected", () => {
    installBrowser();
    const tutorials = new ThreeHudTutorials("keyboard");
    tutorials.update(connection(true) as never, null, 0);
    expect(tutorials.element.textContent).toContain(keyboardHint);
    tutorials.update(connection(true) as never, 0, 1);
    expect(tutorials.element.textContent).toContain("[G]");
    tutorials.update(connection(true) as never, 1, 2);
    expect(tutorials.element.textContent).toContain("[E]");
  });

  it("dismisses low-health guidance on recovery or bandage depletion", () => {
    installBrowser();
    const tutorials = new ThreeHudTutorials("keyboard");
    tutorials.update(connection(true) as never, null, 0);
    tutorials.update(connection(true, { hp: 8 }) as never, null, 1);
    expect(tutorials.element.textContent).toContain(lowHealth);
    tutorials.update(connection(true, {
      hp: 8,
      inventory: [{ item: "torch", qty: 3 }],
    }) as never, null, 2);
    expect(tutorials.element.textContent).not.toContain(lowHealth);

    const recovered = new ThreeHudTutorials("keyboard");
    recovered.update(connection(true) as never, null, 0);
    recovered.update(connection(true, { hp: 8 }) as never, null, 1);
    recovered.update(connection(true) as never, null, 2);
    expect(recovered.element.textContent).not.toContain(lowHealth);
  });

  it("replays persisted hydration and selected-action hints", () => {
    installBrowser();
    const firstHud = new ThreeHudTutorials("keyboard");
    firstHud.update(connection(true) as never, null, 0);
    firstHud.update(connection(true) as never, 0, 1);
    firstHud.update(connection(true) as never, 0, 10_001);

    const reloadedHud = new ThreeHudTutorials("keyboard");
    reloadedHud.update(connection(true) as never, 0, 11_000);
    expect(reloadedHud.element.hidden).toBe(true);
    reloadedHud.replay();
    reloadedHud.update(connection(true) as never, 0, 11_001);
    expect(reloadedHud.element.textContent).toContain(keyboardHint);
    reloadedHud.update(connection(true) as never, 0, 21_001);
    expect(reloadedHud.element.textContent).toContain("[G]");
  });
});
