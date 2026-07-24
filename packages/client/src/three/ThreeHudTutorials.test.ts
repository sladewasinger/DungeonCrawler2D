/** Verifies Three HUD tutorials wait for live snapshots and dismiss recovered health warnings. */
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
  inventory: [{ item: "bandage", qty: 2 }],
  hotbar: ["bandage", null, null, null, null, null, null, null, null],
  hp: 30,
  maxHp: 30,
  ...patch,
});

const installBrowser = () => {
  const storage = new Map<string, string>();
  vi.stubGlobal("document", {
    createElement: () => {
      const attributes = new Map<string, string>();
      return {
        hidden: false,
        style: { cssText: "" },
        textContent: "",
        setAttribute: (name: string, value: string) => attributes.set(name, value),
        getAttribute: (name: string) => attributes.get(name) ?? null,
      };
    },
  });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  return storage;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThreeHudTutorials", () => {
  it("announces transient guidance as a polite atomic status", () => {
    installBrowser();
    const tutorials = new ThreeHudTutorials("keyboard");
    expect(tutorials.element.getAttribute("role")).toBe("status");
    expect(tutorials.element.getAttribute("aria-live")).toBe("polite");
    expect(tutorials.element.getAttribute("aria-atomic")).toBe("true");
  });

  it("ignores stale pre-snapshot state then warns on initially low live health", () => {
    installBrowser();
    const tutorials = new ThreeHudTutorials("keyboard");
    tutorials.update(connection(false, { hp: 8 }) as never, 0);
    tutorials.update(connection(false, { hp: 8 }) as never, 10_000);
    tutorials.update(connection(false, { hp: 8 }) as never, 20_000);
    tutorials.update(connection(true, { hp: 8 }) as never, 20_001);
    expect(tutorials.element.hidden).toBe(false);
    expect(tutorials.element.textContent).toContain("Health low");
  });

  it("prioritizes low-health guidance then dismisses it on recovery", () => {
    installBrowser();
    const tutorials = new ThreeHudTutorials("keyboard");
    tutorials.update(connection(true) as never, 0);
    const inventory = [
      { item: "bandage", qty: 2 },
      { item: "rag", qty: 1 },
    ];
    tutorials.update(connection(true, { inventory, hp: 8 }) as never, 1);
    expect(tutorials.element.textContent).toContain("Health low");
    tutorials.update(connection(true, { inventory }) as never, 2);
    expect(tutorials.element.hidden).toBe(false);
    expect(tutorials.element.textContent).toContain("bandage");
  });

  it("replays persisted hints after a fresh HUD loads", () => {
    installBrowser();
    const inventory = [
      { item: "bandage", qty: 2 },
      { item: "rag", qty: 1 },
    ];
    const firstHud = new ThreeHudTutorials("keyboard");
    firstHud.update(connection(true) as never, 0);
    firstHud.update(connection(true, { inventory }) as never, 1);
    firstHud.update(connection(true, { inventory }) as never, 10_000);
    firstHud.update(connection(true, { inventory }) as never, 20_000);

    const reloadedHud = new ThreeHudTutorials("keyboard");
    reloadedHud.update(connection(true, { inventory }) as never, 11_000);
    expect(reloadedHud.element.hidden).toBe(true);
    reloadedHud.replay();
    reloadedHud.update(connection(true, { inventory }) as never, 11_001);
    expect(reloadedHud.element.textContent).toContain("bandage");
    expect(reloadedHud.element.hidden).toBe(false);
    reloadedHud.update(connection(true, { inventory }) as never, 21_001);
    expect(reloadedHud.element.textContent).toContain("[Tab]");
  });
});
