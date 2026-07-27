/** Verifies 2D reconnect nameplates appear and clear from the live presentation seam. */
import { describe, expect, it } from "vitest";
import { updateNameplate } from "./nameplate.js";

function fakeText() {
  return {
    text: "",
    color: "",
    alpha: 0,
    setText(value: string) { this.text = value; return this; },
    setPosition() { return this; },
    setColor(value: string) { this.color = value; return this; },
    setAlpha(value: number) { this.alpha = value; return this; },
  };
}

describe("updateNameplate", () => {
  it("shows a disconnected label and clears it when the player resumes", () => {
    const text = fakeText();
    updateNameplate(text as never, "Wren", 0, 0, 1, false, false, true);
    expect(text).toMatchObject({ text: "Wren Disconnected", color: "#ffffff" });
    updateNameplate(text as never, "Wren", 0, 0, 1, false, false, false);
    expect(text.text).toBe("Wren");
  });
});
