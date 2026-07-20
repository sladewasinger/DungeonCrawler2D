import { describe, expect, it } from "vitest";
import { descentPromptLabel } from "./descentPrompt.js";

describe("descentPromptLabel", () => {
  it("formats a descend prompt naming the destination floor", () => {
    expect(descentPromptLabel("down", 3)).toBe("Descend to Floor 3");
  });

  it("formats an ascend prompt naming the destination floor", () => {
    expect(descentPromptLabel("up", 1)).toBe("Ascend to Floor 1");
  });
});
