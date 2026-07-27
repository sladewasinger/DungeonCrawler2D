import type Phaser from "phaser";
import { WORLD_PIXEL_SCALE } from "../../../boot/assetManifest.js";
import { petAssetFor } from "../../../boot/petAssetManifest.js";
import { uiTextStyle } from "../../../ui/font.js";
import { HUD_SCALE } from "../../../ui/hudScale.js";
import { airborneHeightAboveGround, spriteLiftPx } from "../lift.js";
import { createNameplate, updateNameplate } from "../nameplate.js";
import { createShadow, updateShadowPosition } from "../shadow.js";
import type { PetVisual } from "../state.js";
import type { PetEntityView, RenderContext } from "../view.js";
import { depthForEntityNow, worldToScreen } from "../worldToScreen.js";

/** The source sheets leave a transparent foot pad; this keeps visible feet
 * planted on the same ground point as the shadow. */
const PET_BASELINE_OFFSET_PX = 2;
const DINO_BASELINE_OFFSET_PX = PET_BASELINE_OFFSET_PX + 2;
const OWNER_LABEL_OFFSET_PX = 10 * HUD_SCALE;
const baselineOffsetFor = (assetId: string): number => assetId.startsWith("pet-dino-")
  ? DINO_BASELINE_OFFSET_PX
  : PET_BASELINE_OFFSET_PX;

export function createPetVisual(scene: Phaser.Scene, defId: string): PetVisual {
  const asset = petAssetFor(defId);
  const body = scene.add
    .sprite(0, 0, asset?.textureKey ?? "atlas")
    .setOrigin(0.5, 1)
    .setScale(WORLD_PIXEL_SCALE);
  return {
    kind: "pet",
    body,
    shadow: createShadow(scene, 0),
    nameplate: createNameplate(scene, 0),
    ownerLabel: scene.add.text(0, 0, "", uiTextStyle(8 * HUD_SCALE)).setOrigin(0.5, 1),
    assetId: defId,
    lastAnim: undefined,
  };
}

export function updatePetVisual(visual: PetVisual, view: PetEntityView, ctx: RenderContext): void {
  const groundHeight = ctx.world.groundAt(view.x, view.y);
  const heightAboveGround = airborneHeightAboveGround(view.z, groundHeight, view.air);
  const screen = worldToScreen(view.x, view.y);
  const depth = depthForEntityNow(view.x, view.y, heightAboveGround);
  visual.body.setPosition(screen.x, screen.y - spriteLiftPx(view.z) + baselineOffsetFor(visual.assetId));
  visual.body.setDepth(depth);
  visual.body.setFlipX(view.faceX < 0);
  const animationKey = `pet:${visual.assetId}:${view.anim}`;
  if (visual.body.anims.currentAnim?.key !== animationKey) visual.body.play(animationKey);
  visual.body.setScale(WORLD_PIXEL_SCALE);

  const ground = worldToScreen(view.x, view.y);
  updateShadowPosition(
    visual.shadow,
    ground.x,
    ground.y - spriteLiftPx(groundHeight),
    heightAboveGround,
  );
  visual.shadow.setDepth(depth - 0.2);
  visual.nameplate.setDepth(depth + 0.2);
  const headY = visual.body.y - visual.body.displayHeight;
  updateNameplate(
    visual.nameplate,
    view.name,
    visual.body.x,
    headY,
    Math.hypot(view.x - ctx.selfX, view.y - ctx.selfY),
    false,
  );
  visual.ownerLabel
    .setText(view.ownerName ? `pet of ${view.ownerName}` : "")
    .setPosition(visual.nameplate.x, visual.nameplate.y + OWNER_LABEL_OFFSET_PX)
    .setColor("#9a9aae")
    .setAlpha(visual.nameplate.alpha)
    .setDepth(depth + 0.2)
    .setVisible(view.ownerName !== undefined);
  visual.lastAnim = view.anim;
}
