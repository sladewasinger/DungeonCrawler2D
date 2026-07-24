/** Exercises the rendered Three party tracker reconnect row through its public update method. */
import { afterEach, describe, expect, it, vi } from "vitest";

interface FakeElement {
  hidden: boolean;
  textContent: string;
  style: { cssText: string; color: string; visibility: string };
  children: FakeElement[];
  append(...children: FakeElement[]): void;
}

function element(): FakeElement {
  return {
    hidden: false,
    textContent: "",
    style: { cssText: "", color: "", visibility: "" },
    children: [],
    append(...children) { this.children.push(...children); },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("ThreePartyTracker", () => {
  it("shows and clears disconnected text through the public tracker update", async () => {
    vi.stubGlobal("document", { createElement: () => element() });
    const { ThreePartyTracker } = await import("./ThreePartyTracker.js");
    const tracker = new ThreePartyTracker();
    const member = { id: "p", name: "Wren", hp: 10, maxHp: 30, downed: false, x: 2, y: 0 };
    tracker.update({ party: { members: [{ ...member, disconnected: true }] } } as never, { x: 0, z: 0 } as never, 0);
    const row = tracker.element.children[1]!;
    expect(row.textContent).toBe("Wren Disconnected");
    tracker.update({ party: { members: [{ ...member, disconnected: false }] } } as never, { x: 0, z: 0 } as never, 0);
    expect(row.textContent).toContain("Wren");
    expect(row.textContent).not.toContain("Disconnected");
  });
});
