import { isWithinFacingArc, type Entity } from "@dc2d/engine";
import type { PlayerSlot } from "../state/state.js";

export const blocksAttackFrom = (
  slot: PlayerSlot | undefined,
  source: Entity,
): boolean => {
  if (!slot?.blocking) return false;
  const victim = slot.entity;
  return isWithinFacingArc({
    facing: victim.facing ?? { x: 1, y: 0 },
    target: { x: source.body.x - victim.body.x, y: source.body.y - victim.body.y },
  });
};

export const blocksAttackDirection = (
  slot: PlayerSlot | undefined,
  sourceX: number,
  sourceY: number,
): boolean => {
  if (!slot?.blocking) return false;
  const victim = slot.entity;
  return isWithinFacingArc({
    facing: victim.facing ?? { x: 1, y: 0 },
    target: { x: sourceX - victim.body.x, y: sourceY - victim.body.y },
  });
};
