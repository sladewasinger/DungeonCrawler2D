import type Phaser from "phaser";
import type { AdminMapEntity } from "@dc2d/engine";
import {
  movementCollision,
  movementCollisionOutline,
  movementGroundProbe,
} from "./adminDebugMovementGeometry.js";
import {
  drawGameplayLine,
  drawGameplayWorldMarker,
} from "./gameplayDebugLineDrawing.js";

const MOVEMENT_COLLISION_COLOR = 0x39d5ff;

interface MovementCollisionDrawingInput {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly entity: AdminMapEntity;
}

export function drawGameplayMovementCollision(
  input: MovementCollisionDrawingInput,
): void {
  const collision = movementCollision(input.entity);
  if (!collision) return;
  drawGameplayLine({
    graphics: input.graphics,
    points: movementCollisionOutline(collision),
    color: MOVEMENT_COLLISION_COLOR,
    width: 2,
  });
  drawGameplayLine({
    graphics: input.graphics,
    points: movementGroundProbe(collision),
    color: MOVEMENT_COLLISION_COLOR,
    width: 2,
    alpha: collision.grounded ? 0.65 : 1,
  });
  drawGameplayWorldMarker(input.graphics, {
    x: collision.center.x,
    y: collision.center.y,
    z: collision.groundHeight,
  }, MOVEMENT_COLLISION_COLOR);
}
