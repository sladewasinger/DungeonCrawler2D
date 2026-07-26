/** Exercises the rendered Three party tracker reconnect row through its public update method. */
import { afterEach, describe, expect, it, vi } from "vitest";

interface FakeElement {
  hidden: boolean;
  textContent: string;
  className: string;
  style: { cssText: string; color: string; visibility: string };
  children: FakeElement[];
  append(...children: FakeElement[]): void;
  replaceChildren(...children: FakeElement[]): void;
  addEventListener(): void;
  setAttribute(): void;
}

function element(): FakeElement {
  return {
    hidden: false,
    textContent: "",
    className: "",
    style: { cssText: "", color: "", visibility: "" },
    children: [],
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    addEventListener() {},
    setAttribute() {},
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("ThreePartyTracker", () => {
  it("shows and clears disconnected text through the public tracker update", async () => {
    vi.stubGlobal("document", { createElement: () => element() });
    const { ThreePartyTracker } = await import("./ThreePartyTracker.js");
    const connection = {
      party: null,
      welcome: null,
      pendingInvite: null,
      outgoingPartyInvites: new Map(),
      partyOp() {},
    };
    const tracker = new ThreePartyTracker(connection as never);
    const member = { id: "p", name: "Wren", hp: 10, maxHp: 30, downed: false, x: 2, y: 0 };
    connection.party = { id: "party", leaderId: "other", members: [{ ...member, disconnected: true }] } as never;
    tracker.update(connection as never, { x: 0, z: 0 } as never, 0);
    const row = tracker.element.children[2]!;
    expect(row.textContent).toBe("Wren Disconnected");
    connection.party = { id: "party", leaderId: "other", members: [{ ...member, disconnected: false }] } as never;
    tracker.update(connection as never, { x: 0, z: 0 } as never, 0);
    expect(row.textContent).toContain("Wren");
    expect(row.textContent).not.toContain("Disconnected");
  });
});
