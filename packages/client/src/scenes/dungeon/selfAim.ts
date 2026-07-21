// Resolves the self player's live weapon-orbit aim angle: mouse-relative on desktop,
// held facing on touch. Split out of index.ts to keep DungeonScene's own file under the
// line cap — this is a thin wrapper around weaponOrbit.ts's pure AimSource resolution.
//
// Transforms the pointer through the scene's own camera explicitly (`camera.getWorldPoint`)
// rather than trusting `pointer.worldX/worldY`: that field is a shared, single Pointer
// property that ANY active scene's InputPlugin can overwrite with ITS OWN camera's
// transform on every pointer move (Phaser's Pointer.updateWorldPoint doc: "the values
// will be automatically replaced the moment the Pointer is updated by an input event...
// should be used immediately") — with the parallel "hud" scene's un-zoomed, unscrolled
// screen-space camera also live, it reliably clobbers a scrolled/zoomed game camera's
// value. Doing the transform locally sidesteps that entirely.
import type Phaser from "phaser";
import { spriteLiftPx } from "../../render/entities/lift.js";
import { resolveAimAngle, type AimSource } from "../../render/entities/weaponOrbit.js";
import { worldToScreen } from "../../render/entities/worldToScreen.js";
import { getViewOrientation, worldToView } from "../../render/view/index.js";
import type { RenderPose } from "./state.js";

/**
 * `touchActive` is input/index.ts's touchVisual() null-ness — the same signal the rest
 * of the input subsystem uses to pick a source. `faceX`/`faceY` (self-cosmetics' own
 * facing, LANE W2) are WORLD-space — the same space remote entities' wire `faceX`/`faceY`
 * already use, so self/remote sprite-flip logic stays symmetric under rotation — but this
 * widget's own orbit angle is a SCREEN-space visual, so the touch branch routes it through
 * worldToView (the forward half of the seam) before handing it to weaponOrbit's atan2.
 */
export function resolveSelfAimAngle(touchActive: boolean, faceX: number, faceY: number, render: RenderPose, camera: Phaser.Cameras.Scene2D.Camera, pointer: Phaser.Input.Pointer): number {
  const source: AimSource = touchActive ? touchFacingSource(faceX, faceY) : mouseAimSource(render, camera, pointer);
  return resolveAimAngle(source);
}

function touchFacingSource(faceX: number, faceY: number): AimSource {
  const screen = worldToView({ x: faceX, y: faceY }, getViewOrientation());
  return { kind: "facing", faceX: screen.x, faceY: screen.y };
}

function mouseAimSource(render: RenderPose, camera: Phaser.Cameras.Scene2D.Camera, pointer: Phaser.Input.Pointer): AimSource {
  const screen = worldToScreen(render.x, render.y);
  const world = camera.getWorldPoint(pointer.x, pointer.y);
  return {
    kind: "mouse",
    playerScreenX: screen.x,
    playerScreenY: screen.y - spriteLiftPx(render.z),
    pointerScreenX: world.x,
    pointerScreenY: world.y,
  };
}
