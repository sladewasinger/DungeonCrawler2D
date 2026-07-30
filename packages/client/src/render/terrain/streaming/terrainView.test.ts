import { describe, expect, it } from "vitest";
import { DESKTOP_TERRAIN_PROFILE, CONSTRAINED_TERRAIN_PROFILE } from "./terrainDeviceProfile.js";
import { terrainBoundsForProfile } from "./terrainView.js";
import { worldBoundsForView } from "../runtime/renderSupport.js";

const VIEW = { x: 128, y: 256, width: 640, height: 480 };

describe("terrainBoundsForProfile", () => {
  it("retains the constrained projection margin for raised caps and wall faces", () => {
    const strictBounds = worldBoundsForView(VIEW, 0, 0);
    const constrainedBounds = terrainBoundsForProfile(
      VIEW,
      0,
      CONSTRAINED_TERRAIN_PROFILE,
    );

    expect(constrainedBounds.x).toBeLessThan(strictBounds.x);
    expect(constrainedBounds.y).toBeLessThan(strictBounds.y);
    expect(constrainedBounds.width).toBeGreaterThan(strictBounds.width);
    expect(constrainedBounds.height).toBeGreaterThan(strictBounds.height);
  });

  it("keeps the constrained terrain window no larger than desktop", () => {
    const constrainedBounds = terrainBoundsForProfile(
      VIEW,
      0,
      CONSTRAINED_TERRAIN_PROFILE,
    );
    const desktopBounds = terrainBoundsForProfile(VIEW, 0, DESKTOP_TERRAIN_PROFILE);

    expect(constrainedBounds.width).toBeLessThanOrEqual(desktopBounds.width);
    expect(constrainedBounds.height).toBeLessThanOrEqual(desktopBounds.height);
  });
});
