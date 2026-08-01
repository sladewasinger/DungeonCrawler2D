import { describe, expect, it } from "vitest";
import { toggleSwitchPresentation } from "./toggleSwitch.js";

const FREE_CAMERA = "Free camera";

describe("toggle switch presentation", () => {
  it("exposes explicit checked and visible state semantics", () => {
    expect(toggleSwitchPresentation(FREE_CAMERA, true)).toEqual({
      label: FREE_CAMERA,
      state: "ON",
      checked: "true",
    });
    expect(toggleSwitchPresentation(FREE_CAMERA, false)).toEqual({
      label: FREE_CAMERA,
      state: "OFF",
      checked: "false",
    });
  });
});
