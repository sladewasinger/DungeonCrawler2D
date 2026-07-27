import { describe, expect, it } from "vitest";
import { isSkeletalDefId } from "./boneChipBurst.js";

describe("skeletal impact material", () => {
  it("routes skeleton-family enemies away from blood effects", () => {
    expect(isSkeletalDefId("skeleton")).toBe(true);
    expect(isSkeletalDefId("warden-of-five")).toBe(true);
  });

  it("keeps organic enemies and players on the blood path", () => {
    expect(isSkeletalDefId("slime")).toBe(false);
    expect(isSkeletalDefId("goblin")).toBe(false);
    expect(isSkeletalDefId(undefined)).toBe(false);
  });
});
