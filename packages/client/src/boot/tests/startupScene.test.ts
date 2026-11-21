import { describe, expect, it } from "vitest";
import { resolveStartupScene } from "../startupScene.js";

describe("resolveStartupScene", () => {
  it("honors an explicit standalone editor startup without a URL scene parameter", () => {
    expect(resolveStartupScene({ configuredStartupScene: "editor", requestedScene: null, requestedTestbench: null })).toBe("editor");
  });

  it("retains the title fallback for the ordinary game boot", () => {
    expect(resolveStartupScene({ configuredStartupScene: undefined, requestedScene: null, requestedTestbench: null })).toBe("title");
  });
});
