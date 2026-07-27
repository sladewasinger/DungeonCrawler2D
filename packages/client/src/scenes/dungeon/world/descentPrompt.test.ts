import { describe, expect, it } from "vitest";
import { descentPromptLabel } from "./descentPrompt.js";

describe("descentPromptLabel", () => {
  it("formats a descend prompt naming the destination floor", () => {
    expect(descentPromptLabel("down", 3)).toBe("Descend to Floor 3");
  });
});
