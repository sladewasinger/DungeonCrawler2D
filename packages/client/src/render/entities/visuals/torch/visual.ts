// Phaser glue for a thrown torch: flight uses the usual absolute z-lift and velocity
// angle. Once landed, the same sprite remains as a smaller, stable ground object; its
// exact impact anchor is shared with the torch halo and flame VFX.
import type Phaser from "phaser";
import { ASSET_KEYS, WORLD_PIXEL_SCALE } from "../../../../boot/assetManifest.js";
import { depthForEntityNow, worldToScreen } from "../../geometry/worldToScreen.js";
import { spriteLiftPx } from "../../motion/lift.js";
import { velocityAngleDegrees } from "../../motion/projectileMotion.js";
import {
  projectTorchGroundAnchor,
  torchGroundAnchor,
} from "../../presentation/torch/groundAnchor.js";
import type { TorchVisual } from "../state.js";
import type { RenderContext, TorchEntityView } from "../view.js";

const PLACED_TORCH_SCALE = 0.78;

export function createTorchVisual(scene: Phaser.Scene): TorchVisual {
  const body = scene.add.sprite(0, 0, ASSET_KEYS.atlas).setOrigin(0.5, 0.5).setScale(WORLD_PIXEL_SCALE);
  return { kind: "torch", body };
}

export function updateTorchVisual(visual: TorchVisual, view: TorchEntityView, ctx: RenderContext): void {
  const flying = view.state === "flying";
  if (visual.body.frame.name !== view.frame) visual.body.setFrame(view.frame);
  const anchor = torchGroundAnchor(view);
  const screen = flying
    ? worldToScreen(view.x, view.y)
    : projectTorchGroundAnchor(anchor);
  const groundHeight = flying ? ctx.world.groundAt(view.x, view.y) : anchor.groundHeight;
  const liftPx = flying ? spriteLiftPx(view.z) : 0;
  visual.body.setPosition(screen.x, screen.y - liftPx);
  visual.body.setDepth(depthForEntityNow(view.x, view.y, flying ? Math.max(0, view.z - groundHeight) : 0));
  visual.body.setAngle(flying ? velocityAngleDegrees(view.vx, view.vy) : 0);
  visual.body.setScale(WORLD_PIXEL_SCALE * (flying ? 1 : PLACED_TORCH_SCALE));
  visual.body.setVisible(true);
}
