import { SCREEN_TILE_PX } from "../../../../boot/assetManifest.js";
import { spriteLiftPx } from "../../motion/lift.js";
import { resetViewOrientation, setViewOrientation } from "../../../view/transform/viewState.js";
import { afterEach, describe, expect, it } from "vitest";
import {
  projectTorchGroundAnchor,
  torchGroundAnchor,
} from "./groundAnchor.js";

afterEach(() => resetViewOrientation());

describe("torchGroundAnchor", () => {
  it("keeps the continuous landed point and authoritative ground height", () => {
    expect(torchGroundAnchor({ x: 4.25, y: 6.75, z: 2 }))
      .toEqual({ x: 4.25, y: 6.75, groundHeight: 2 });
  });

  it("projects an elevated anchor once at the current view orientation", () => {
    setViewOrientation(90);

    expect(projectTorchGroundAnchor({
      x: 4.25,
      y: 6.75,
      groundHeight: 2,
    })).toEqual({
      x: 6.75 * SCREEN_TILE_PX,
      y: -4.25 * SCREEN_TILE_PX - spriteLiftPx(2),
    });
  });
});
