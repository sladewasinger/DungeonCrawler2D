import { describe, expect, it } from "vitest";
import { spectatorCameraResetRequired } from "./spectatorCameraTracking.js";

describe("spectatorCameraResetRequired", () => {
  it("keeps free camera untethered from same-world target teleports", () => {
    expect(spectatorCameraResetRequired({
      free: true,
      teleported: true,
      identityChanged: false,
    })).toBe(false);
  });

  it("resets follow mode and new target or world identities", () => {
    expect(spectatorCameraResetRequired({
      free: false,
      teleported: true,
      identityChanged: false,
    })).toBe(true);
    expect(spectatorCameraResetRequired({
      free: true,
      teleported: false,
      identityChanged: true,
    })).toBe(true);
  });
});
