import { BODY_RADIUS } from "@dc2d/engine";
import {
  adminDebugFlagEnabled,
  type AdminEntityDebug,
  type AdminMapDebugInput,
} from "../adminMapDebugTypes.js";

type MovementCollisionDebug = Pick<AdminEntityDebug, "movementCollision">;

const MOVING_ENTITY_KINDS = new Set(["player", "enemy", "pet"]);

/** Exposes the exact horizontal footprint and center terrain probe used by movement. */
export function adminMovementCollisionDebug(
  input: AdminMapDebugInput,
): MovementCollisionDebug {
  if (!adminDebugFlagEnabled(input, "movementCollision")) return {};
  if (!MOVING_ENTITY_KINDS.has(input.entity.kind)) return {};
  const { body } = input.entity;
  return {
    movementCollision: {
      halfWidth: BODY_RADIUS,
      halfDepth: BODY_RADIUS,
      grounded: body.grounded,
      groundHeight: input.sim.world.groundAt(body.x, body.y),
    },
  };
}
