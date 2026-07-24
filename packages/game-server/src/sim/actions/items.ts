import {
  MAX_THROW_RANGE,
  THROW_SPEED,
  createBody,
  faceEntity,
  launchVelocity,
  makeEntity,
  newEntityId,
  type EffectEvent,
} from "@dc2d/engine";
import { invQty, invRemove } from "../inventory.js";
import type { PlayerAction, PlayerSlot, SimState } from "../state.js";
import { doThrowTorch } from "../torches.js";

/** Hotbar item use: throwables launch a projectile, consumables run their effects. */

export function doUseSlot(
  sim: SimState,
  slot: PlayerSlot,
  index: number,
  targetX: number | undefined,
  targetY: number | undefined,
  effectEvents: EffectEvent[],
): void {
  const defId = slot.hotbar[index];
  if (!defId) return;
  const def = sim.content.items.get(defId);
  if (!def || invQty(slot, defId) < 1) return;

  if (targetX !== undefined && targetY !== undefined && def.throwable) {
    throwItem(sim, slot, defId, def.tags, targetX, targetY);
    return;
  }

  consumeItem(sim, slot, defId, effectEvents);
}

export function doUseItem(
  sim: SimState,
  slot: PlayerSlot,
  defId: string,
  effectEvents: EffectEvent[],
): void {
  if (invQty(slot, defId) < 1) return;
  consumeItem(sim, slot, defId, effectEvents);
}

function consumeItem(
  sim: SimState,
  slot: PlayerSlot,
  defId: string,
  effectEvents: EffectEvent[],
): void {
  const consumable = sim.content.items.get(defId)?.consumable;
  if (!consumable) return;
  sim.effects.runPrimitives(slot.entity, consumable.effects, effectEvents, {}, () => sim.rng.next());
  invRemove(slot, defId, 1);
}

function throwItem(
  sim: SimState,
  slot: PlayerSlot,
  defId: string,
  tags: readonly string[],
  targetX: number,
  targetY: number,
): void {
  const from = slot.entity.body;
  let dx = targetX - from.x;
  let dy = targetY - from.y;
  const dist = Math.hypot(dx, dy);
  faceEntity(slot.entity, dx, dy);
  if (dist > MAX_THROW_RANGE) {
    dx *= MAX_THROW_RANGE / dist;
    dy *= MAX_THROW_RANGE / dist;
  }
  const to = {
    x: from.x + dx,
    y: from.y + dy,
    z: sim.world.groundAt(from.x + dx, from.y + dy),
  };
  const projectile = makeEntity("projectile", createBody(from.x, from.y, from.z + 1), {
    id: newEntityId("j"),
    defId,
    ownerId: slot.entity.id,
    tags: new Set(tags),
    vel: launchVelocity({ x: from.x, y: from.y, z: from.z + 1 }, to, THROW_SPEED),
  });
  sim.projectiles.set(projectile.id, projectile);
  invRemove(slot, defId, 1);
}

/** Dispatches the three inventory-use action shapes split from actions/index.ts. */
export function dispatchItemAction(
  sim: SimState,
  slot: PlayerSlot,
  action: PlayerAction,
  effectEvents: EffectEvent[],
): void {
  switch (action.type) {
    case "useSlot":
      doUseSlot(sim, slot, action.slot, action.targetX, action.targetY, effectEvents);
      break;
    case "useItem":
      doUseItem(sim, slot, action.item, effectEvents);
      break;
    case "throwTorch":
      doThrowTorch(sim, slot, action.dirX, action.dirY);
      break;
  }
}
