// Phaser glue for a thrown torch: while flying it arcs with the usual absolute z-lift
// (lift.ts, the same convention every jumping/falling entity uses) and points along its
// velocity like a projectile; the instant it lands the body sprite hides — a placed
// torch's visual identity is the flame particle + halo (render/lighting), exactly like
// an authored world torch, which never had a body sprite to begin with.
import type Phaser from "phaser";
import { ASSET_KEYS, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";
import { spriteLiftPx } from "./lift.js";
import { velocityAngleDegrees } from "./projectileMotion.js";
import type { TorchVisual } from "./state.js";
import type { RenderContext, TorchEntityView } from "./view.js";
import { depthForEntityNow, worldToScreen } from "./worldToScreen.js";

export function createTorchVisual(scene: Phaser.Scene): TorchVisual {
  const body = scene.add.sprite(0, 0, ASSET_KEYS.atlas).setOrigin(0.5, 0.5).setScale(WORLD_PIXEL_SCALE);
  return { kind: "torch", body };
}

export function updateTorchVisual(visual: TorchVisual, view: TorchEntityView, ctx: RenderContext): void {
  const flying = view.state === "flying";
  if (visual.body.frame.name !== view.frame) visual.body.setFrame(view.frame);
  const screen = worldToScreen(view.x, view.y);
  const groundHeight = ctx.world.groundAt(view.x, view.y);
  // ELEVATION-PROJECTION section 3: absolute-z lift, same as every other entity.
  const liftPx = flying ? spriteLiftPx(view.z) : 0;
  visual.body.setPosition(screen.x, screen.y - liftPx);
  visual.body.setDepth(depthForEntityNow(view.x, view.y, flying ? Math.max(0, view.z - groundHeight) : 0));
  visual.body.setAngle(flying ? velocityAngleDegrees(view.vx, view.vy) : 0);
  visual.body.setVisible(flying);
}
