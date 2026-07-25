/** Exercises the authoritative Three HUD health-event bridge through its public update lifecycle. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Connection } from "../net/connection.js";
import { ThreeHealthFeedback } from "./ThreeHealthFeedback.js";

interface FakeElement {
  hidden: boolean;
  textContent: string;
  style: { cssText: string; color: string };
}

const element = (): FakeElement => ({
  hidden: false,
  textContent: "",
  style: { cssText: "", color: "" },
});

afterEach(() => vi.unstubAllGlobals());

describe("ThreeHealthFeedback", () => {
  it("shows authoritative healing as green +4 feedback, then expires", () => {
    vi.stubGlobal("document", { createElement: () => element() });
    const connection = new Connection("ws://test", "Crawler", "client");
    connection.welcome = { playerId: "self" } as never;
    connection.visualEvents.push({
      t: "health",
      id: "self",
      delta: 4,
      kind: "heal",
    });
    const feedback = new ThreeHealthFeedback();

    feedback.update(connection, 100);
    expect(feedback.element).toMatchObject({
      hidden: false,
      textContent: "+4",
      style: expect.objectContaining({ color: "#58d68d" }),
    });

    feedback.update(connection, 999);
    expect(feedback.element.hidden).toBe(false);
    feedback.update(connection, 1_000);
    expect(feedback.element.hidden).toBe(true);
  });
});
