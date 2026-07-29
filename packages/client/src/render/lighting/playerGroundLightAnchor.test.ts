import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { spriteLiftPx } from "../entities/motion/lift.js";
import { resetViewOrientation, setViewOrientation } from "../view/transform/viewState.js";
import { afterEach, describe, expect, it } from "vitest";
import { createPersonalLight } from "./lightingRuntimeStyle.js";
import { applyPlayerLightMode } from "./playerLightMode.js";
import {
  applyPlayerGroundLightAnchor,
  playerGroundLightAnchor,
  projectPlayerGroundLightAnchor,
} from "./playerGroundLightAnchor.js";

const ACTOR = { x: 4.25, y: 6.75, z: 2 };
const PROJECTIONS = [
  { orientation: 0, x: 4.25, y: 6.75 },
  { orientation: 90, x: 6.75, y: -4.25 },
  { orientation: 180, x: -4.25, y: -6.75 },
  { orientation: 270, x: -6.75, y: 4.25 },
] as const;
const MODES = [
  { name: "baseline", carriesTorch: false },
  { name: "carried torch", carriesTorch: true },
] as const;

afterEach(() => resetViewOrientation());

describe("player ground-light anchor", () => {
  for (const mode of MODES) {
    for (const projection of PROJECTIONS) {
      it(`${mode.name} follows the actor at ${projection.orientation} degrees`, () => {
        setViewOrientation(projection.orientation);
        const light = createPersonalLight();
        const anchor = playerGroundLightAnchor(ACTOR);
        applyPlayerLightMode(light, mode.carriesTorch);
        applyPlayerGroundLightAnchor(light, anchor);

        expect(light).toMatchObject(anchor);
        expect(projectPlayerGroundLightAnchor(anchor)).toEqual({
          x: projection.x * SCREEN_TILE_PX,
          y: projection.y * SCREEN_TILE_PX - spriteLiftPx(ACTOR.z),
        });
      });
    }
  }
});
