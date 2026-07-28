import { describe, expect, it } from "vitest";
import {
  createLightStreamState,
  invalidateLightStream,
  refreshLightStreamRevision,
} from "./lightStreamState.js";

describe("light stream state", () => {
  it("clears cached chunk lights when world features change", () => {
    const state = createLightStreamState();
    const chunks = new Map([["0,0", ["door"]]]);

    refreshLightStreamRevision(state, chunks, 4);
    expect(chunks.size).toBe(0);
    expect(state).toEqual({ window: "", revision: 4 });

    chunks.set("0,0", ["door"]);
    state.window = "visible";
    refreshLightStreamRevision(state, chunks, 4);
    expect(chunks.size).toBe(1);
    expect(state.window).toBe("visible");
  });

  it("invalidates both the camera window and revision", () => {
    const state = { window: "visible", revision: 8 };
    const chunks = new Map([["0,0", ["door"]]]);

    invalidateLightStream(state, chunks);

    expect(chunks.size).toBe(0);
    expect(state).toEqual({ window: "", revision: -1 });
  });
});
