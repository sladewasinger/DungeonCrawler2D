import { describe, expect, it } from "vitest";
import { shouldRestartAreaRig } from "./areaRigLifecycle.js";

describe("area animated rig lifecycle", () => {
  it("does not restart an unchanged fire placement", () => {
    expect(shouldRestartAreaRig(true, "4,7:0", "4,7:0")).toBe(false);
  });

  it("starts an inactive rig and restarts only after its placement changes", () => {
    expect(shouldRestartAreaRig(false, "", "4,7:0")).toBe(true);
    expect(shouldRestartAreaRig(true, "4,7:0", "4,7:90")).toBe(true);
  });
});
