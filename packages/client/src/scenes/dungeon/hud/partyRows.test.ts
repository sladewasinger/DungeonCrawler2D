import { describe, expect, it } from "vitest";
import { partyRowsView } from "./partyRows.js";

const member = {
  id: "p",
  name: "Wren",
  hp: 1,
  maxHp: 30,
  downed: true,
  x: 1,
  y: 0,
};

describe("partyRowsView", () => {
  it("marks self leadership and nearby revive actions", () => {
    const view = partyRowsView({
      party: { id: "party1", leaderId: "self", members: [member] },
      selfId: "self", bodyPos: { x: 0, y: 0 }, viewBearingDeg: 0,
    });
    expect(view.selfIsLeader).toBe(true);
    expect(view.rows[0]).toMatchObject({ revive: true, leader: false });
  });

  it("preserves disconnected state and identifies a remote leader", () => {
    const view = partyRowsView({
      party: { id: "party1", leaderId: "p", members: [{ ...member, downed: false, disconnected: true }] },
      selfId: "self", bodyPos: { x: 0, y: 0 }, viewBearingDeg: 0,
    });
    expect(view.rows[0]).toMatchObject({
      id: "p",
      disconnected: true,
      leader: true,
      revive: false,
    });
  });
});
