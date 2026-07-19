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
import { resolveAimAngle, type AimSource } from "../../render/entities/weaponOrbit.js";
import { worldToScreen } from "../../render/entities/worldToScreen.js";
import type { RenderPose } from "./state.js";

/** `touchActive` is input/index.ts's touchVisual() null-ness — the same signal the rest of the input subsystem uses to pick a source. */
export function resolveSelfAimAngle(touchActive: boolean, faceX: number, faceY: number, render: RenderPose, camera: Phaser.Cameras.Scene2D.Camera, pointer: Phaser.Input.Pointer): number {
  const source: AimSource = touchActive ? { kind: "facing", faceX, faceY } : mouseAimSource(render, camera, pointer);
  return resolveAimAngle(source);
}

function mouseAimSource(render: RenderPose, camera: Phaser.Cameras.Scene2D.Camera, pointer: Phaser.Input.Pointer): AimSource {
  const screen = worldToScreen(render.x, render.y);
  const world = camera.getWorldPoint(pointer.x, pointer.y);
  return { kind: "mouse", playerScreenX: screen.x, playerScreenY: screen.y, pointerScreenX: world.x, pointerScreenY: world.y };
}
