// Projectile entity wiring: velocity-facing sprite + particle trail (motion math lives
// in projectileMotion.ts / projectileVisual.ts).
import type Phaser from "phaser";
import { ASSET_KEYS, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";
import { createProjectileTrail, updateProjectileMotion } from "./projectileVisual.js";
import type { ProjectileVisual } from "./state.js";
import type { ProjectileEntityView } from "./view.js";
import { depthForEntityNow, worldToScreen } from "./worldToScreen.js";

export function createProjectileVisual(scene: Phaser.Scene): ProjectileVisual {
  const body = scene.add.sprite(0, 0, ASSET_KEYS.atlas).setOrigin(0.5, 0.5).setScale(WORLD_PIXEL_SCALE);
  return { kind: "projectile", body, trail: createProjectileTrail(scene, 0) };
}

export function updateProjectileVisual(visual: ProjectileVisual, view: ProjectileEntityView): void {
  if (visual.body.frame.name !== view.frame) visual.body.setFrame(view.frame);
  const screen = worldToScreen(view.x, view.y);
  visual.body.setDepth(depthForEntityNow(view.x, view.y));
  visual.trail.setDepth(visual.body.depth - 0.2);
  updateProjectileMotion(visual.body, visual.trail, screen.x, screen.y, view.vx, view.vy);
}
