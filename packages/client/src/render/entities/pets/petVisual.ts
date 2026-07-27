import type Phaser from "phaser";
import { WORLD_PIXEL_SCALE } from "../../../boot/assetManifest.js";
import { petAssetFor } from "../../../boot/petAssetManifest.js";
import { uiTextStyle } from "../../../ui/font.js";
import { HUD_SCALE } from "../../../ui/hudScale.js";
import { airborneHeightAboveGround, spriteLiftPx } from "../lift.js";
import { createNameplate, LABEL_LINE_GAP_PX, updateNameplate } from "../nameplate.js";
import { createShadow, updateShadowPosition } from "../shadow.js";
import type { PetVisual } from "../state.js";
import type { PetEntityView, RenderContext } from "../view.js";
import { depthForEntityNow, worldToScreen } from "../worldToScreen.js";

/** The source sheets leave a transparent foot pad; this keeps visible feet
 * planted on the same ground point as the shadow. */
const PET_BASELINE_OFFSET_PX = 2;
const DINO_BASELINE_OFFSET_PX = PET_BASELINE_OFFSET_PX + 2;
const OWNER_LABEL_HEIGHT_PX = 8 * HUD_SCALE;
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
    ownerLabel: scene.add.text(0, 0, "", uiTextStyle(8 * HUD_SCALE, "#ffffff"))
      .setOrigin(0.5, 1)
      .setStroke("#000000", 2),
    assetId: defId,
    lastAnim: undefined,
  };
}

interface PetPresentation {
  readonly depth: number;
  readonly groundHeight: number;
  readonly heightAboveGround: number;
}

interface PetLabelPresentation {
  readonly view: PetEntityView;
  readonly ctx: RenderContext;
  readonly depth: number;
}

function updatePetBody(visual: PetVisual, view: PetEntityView, presentation: PetPresentation): void {
  const screen = worldToScreen(view.x, view.y);
  visual.body.setPosition(screen.x, screen.y - spriteLiftPx(view.z) + baselineOffsetFor(visual.assetId));
  visual.body.setDepth(presentation.depth);
  visual.body.setFlipX(view.faceX < 0);
  const animationKey = `pet:${visual.assetId}:${view.anim}`;
  if (visual.body.anims.currentAnim?.key !== animationKey) visual.body.play(animationKey);
  visual.body.setScale(WORLD_PIXEL_SCALE);
}

function updatePetShadow(visual: PetVisual, view: PetEntityView, presentation: PetPresentation): void {
  const ground = worldToScreen(view.x, view.y);
  updateShadowPosition({
    shadow: visual.shadow,
    groundScreenX: ground.x,
    groundScreenY: ground.y - spriteLiftPx(presentation.groundHeight),
    heightAboveGround: presentation.heightAboveGround,
  });
  visual.shadow.setDepth(presentation.depth - 0.2);
}

function updatePetLabels(visual: PetVisual, presentation: PetLabelPresentation): void {
  const { view, ctx, depth } = presentation;
  const hasOwner = view.ownerName !== undefined;
  visual.nameplate.setDepth(depth + 0.2);
  visual.ownerLabel.setText(hasOwner ? `pet of ${view.ownerName}` : "");
  updateNameplate({
    text: visual.nameplate,
    name: view.name,
    headScreenX: visual.body.x,
    headScreenY: visual.body.y - visual.body.displayHeight,
    distanceTiles: Math.hypot(view.x - ctx.selfX, view.y - ctx.selfY),
    isParty: false,
    additionalOffsetPx: hasOwner ? OWNER_LABEL_HEIGHT_PX + LABEL_LINE_GAP_PX : 0,
  });
  visual.ownerLabel
    .setPosition(visual.nameplate.x, visual.nameplate.y + LABEL_LINE_GAP_PX + OWNER_LABEL_HEIGHT_PX)
    .setColor("#d5d5d5")
    .setAlpha(visual.nameplate.alpha)
    .setDepth(depth + 0.2)
    .setVisible(hasOwner);
}

export function updatePetVisual(visual: PetVisual, view: PetEntityView, ctx: RenderContext): void {
  const groundHeight = ctx.world.groundAt(view.x, view.y);
  const heightAboveGround = airborneHeightAboveGround(view.z, groundHeight, view.air);
  const depth = depthForEntityNow(view.x, view.y, heightAboveGround);
  const presentation = { depth, groundHeight, heightAboveGround };
  updatePetBody(visual, view, presentation);
  updatePetShadow(visual, view, presentation);
  updatePetLabels(visual, { view, ctx, depth });
  visual.lastAnim = view.anim;
}
