import type Phaser from "phaser";
import { spriteLiftPx } from "../motion/lift.js";
import { actorScreenAnchor } from "../presentation/actorScreenAnchor.js";
import { depthForEntityNow, worldToScreen } from "../geometry/worldToScreen.js";
import { playerFacesLeft } from "./playerFacing.js";
import type { PlayerEntityView } from "../visuals/view.js";

export interface PlayerBodyPositionInput {
  readonly body: Phaser.GameObjects.Sprite;
  readonly view: PlayerEntityView;
  readonly heightAboveGround: number;
}

/** Positions only the player art; the gameplay body remains entirely in simulation space. */
export function positionPlayerBody({
  body,
  view,
  heightAboveGround,
}: PlayerBodyPositionInput): void {
  const screen = worldToScreen(view.x, view.y);
  // ELEVATION-PROJECTION section 3: absolute-z lift. Terrain now bakes the matching
  // shift into its own drawn cap (wave E2), so a grounded body (z === groundAt) lands
  // exactly on it — see lift.ts's module doc.
  const anchor = actorScreenAnchor({ screen, liftPx: spriteLiftPx(view.z) });
  body.setPosition(anchor.x, anchor.y);
  body.setDepth(depthForEntityNow(view.x, view.y, heightAboveGround));
  body.setFlipX(playerFacesLeft(view));
}
