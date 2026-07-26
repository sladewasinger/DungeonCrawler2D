import { isWithinFacingArc, type Entity } from "@dc2d/engine";
import type { PlayerSlot } from "./state.js";

export const blocksAttackFrom = (
  slot: PlayerSlot | undefined,
  source: Entity,
): boolean => {
  if (!slot?.blocking) return false;
  const victim = slot.entity;
  return isWithinFacingArc(
    victim.facing?.x ?? 1,
    victim.facing?.y ?? 0,
    source.body.x - victim.body.x,
    source.body.y - victim.body.y,
  );
};

export const blocksAttackDirection = (
  slot: PlayerSlot | undefined,
  sourceX: number,
  sourceY: number,
): boolean => {
  if (!slot?.blocking) return false;
  const victim = slot.entity;
  return isWithinFacingArc(
    victim.facing?.x ?? 1,
    victim.facing?.y ?? 0,
    sourceX - victim.body.x,
    sourceY - victim.body.y,
  );
};
