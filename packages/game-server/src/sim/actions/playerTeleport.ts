import { clampFiniteFloorPosition, createBody } from "@dc2d/engine";
import { resetInputTimeline } from "../players/playerInputTimeline.js";
import { clearActiveMeleeAttack } from "../state/meleeAttackState.js";
import type { PlayerSlot, SimState } from "../state/state.js";

export interface PlayerTeleport {
  readonly sim: SimState;
  readonly slot: PlayerSlot;
  readonly to: { readonly x: number; readonly y: number; readonly z?: number };
  readonly remember: boolean;
  readonly clampToFloor?: boolean;
}

export function teleportPlayer(input: PlayerTeleport): void {
  const { sim, slot, to, remember, clampToFloor = false } = input;
  if (remember) rememberReturnPosition(slot);
  const position = clampToFloor
    ? clampFiniteFloorPosition(sim.world.floorBounds, to)
    : { x: to.x, y: to.y };
  const z = to.z ?? sim.world.groundAt(position.x, position.y);
  slot.entity.body = createBody(position.x, position.y, z);
  clearActiveMeleeAttack(slot);
  resetInputTimeline(slot);
  slot.needsFullAreas = true;
  slot.known.clear();
  slot.outbox.push({ t: "teleported" });
}

function rememberReturnPosition(slot: PlayerSlot): void {
  const body = slot.entity.body;
  slot.returnStack.push({ x: body.x, y: body.y, z: body.z });
  if (slot.returnStack.length > 4) slot.returnStack.shift();
}
