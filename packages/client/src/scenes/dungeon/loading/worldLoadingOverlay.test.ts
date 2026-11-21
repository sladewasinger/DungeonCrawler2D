import { describe, expect, it } from "vitest";
import { initialWorldLoadingState } from "./worldLoadingOverlay.js";

describe("initialWorldLoadingState", () => {
  it("keeps the loading fallback visible when world preparation began before mount", () => {
    expect(initialWorldLoadingState({
      worldReady: false,
      worldLoading: true,
      worldLoadError: null,
    })).toEqual({ kind: "loading" });
  });

  it("preserves a preparation failure for the mounted fallback", () => {
    expect(initialWorldLoadingState({
      worldReady: false,
      worldLoading: false,
      worldLoadError: "worker unavailable",
    })).toEqual({ kind: "error", message: "worker unavailable" });
  });

  it("hides the fallback only after the world is ready", () => {
    expect(initialWorldLoadingState({
      worldReady: true,
      worldLoading: false,
      worldLoadError: null,
    })).toEqual({ kind: "hidden" });
  });
});
