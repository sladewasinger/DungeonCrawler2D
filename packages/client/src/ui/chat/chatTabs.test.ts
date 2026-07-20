import { describe, expect, it } from "vitest";
import {
  createChatTabsState,
  lastDmPartner,
  lineVisibleOn,
  recordIncoming,
  selectTab,
} from "./chatTabs.js";

describe("chat tabs", () => {
  it("boots with global active (the wave-3 default) and nothing unread", () => {
    const state = createChatTabsState();
    expect(state.active).toBe("global");
    expect(Object.values(state.unread).some(Boolean)).toBe(false);
    expect(state.dmSeen).toBe(false);
  });

  it("dots inactive tabs on traffic, never the active one", () => {
    const state = createChatTabsState();
    recordIncoming(state, "global");
    expect(state.unread.global).toBe(false);
    recordIncoming(state, "local");
    recordIncoming(state, "party");
    expect(state.unread.local).toBe(true);
    expect(state.unread.party).toBe(true);
  });

  it("selecting a tab clears its unread dot", () => {
    const state = createChatTabsState();
    recordIncoming(state, "local");
    selectTab(state, "local");
    expect(state.active).toBe("local");
    expect(state.unread.local).toBe(false);
  });

  it("dm traffic lights the dm tab exactly once", () => {
    const state = createChatTabsState();
    expect(state.dmSeen).toBe(false);
    recordIncoming(state, "dm");
    expect(state.dmSeen).toBe(true);
    expect(state.unread.dm).toBe(true);
  });

  it("system lines belong to every tab and dot none", () => {
    const state = createChatTabsState();
    recordIncoming(state, "system");
    expect(Object.values(state.unread).some(Boolean)).toBe(false);
    expect(lineVisibleOn("system", "global")).toBe(true);
    expect(lineVisibleOn("system", "dm")).toBe(true);
    expect(lineVisibleOn("party", "global")).toBe(false);
    expect(lineVisibleOn("global", "global")).toBe(true);
  });

  it("lastDmPartner follows the most recent dm line in either direction", () => {
    // Server sets `target` to the thread's other side on both sent and received copies.
    const log = [
      { channel: "global" },
      { channel: "dm", target: "Wren" }, // received from Wren
      { channel: "local" },
      { channel: "dm", target: "Rex" }, // sent to Rex — most recent wins
      { channel: "system" },
    ];
    expect(lastDmPartner(log)).toBe("Rex");
    expect(lastDmPartner([{ channel: "global" }])).toBeNull();
    expect(lastDmPartner([])).toBeNull();
  });
});
