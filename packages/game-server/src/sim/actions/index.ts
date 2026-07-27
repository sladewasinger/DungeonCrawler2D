import type { EffectEvent } from "@dc2d/engine";
import { doFistbump } from "../contacts.js";
import { doCraft, doDrop, doPickup, doStash } from "../inventory.js";
import type { PlayerAction, PlayerSlot, SimState } from "../state.js";
import { doDescend } from "./descend.js";
import { dispatchItemAction } from "./items.js";
import { doAttack } from "./melee.js";
import { endSpawnGrace } from "../spawnSafety.js";
import { closeLootChest, openLootChestById, takeLoot } from "../lootChests.js";
import { setReviveHeld, stepRevives } from "../revives.js";
import { dispatchStandingAction } from "./standing.js";

/** Queued player actions: combat, item use, doors, and delegation to
 * inventory/social modules. Downed players can only interact (revive
 * flows) and manage party/chat. */

interface ActionContext {
  sim: SimState;
  slot: PlayerSlot;
  action: PlayerAction;
  effectEvents: EffectEvent[];
}

export function processActions(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const slot of sim.players.values()) processSlotActions(sim, slot, effectEvents);
  stepRevives(sim, effectEvents);
}

function processSlotActions(sim: SimState, slot: PlayerSlot, effectEvents: EffectEvent[]): void {
  const actions = slot.pendingActions.splice(0);
  if (!slot.connected || slot.entity.hp <= 0) return;
  for (const action of actions) {
    if (slot.entity.hp <= 0) return;
    dispatchAction({ sim, slot, action, effectEvents });
  }
}

/** Action types that a downed player (mid-revive, can't act) may not perform. */
const GATED_ON_STANDING = new Set<PlayerAction["type"]>([
  "attack",
  "useSlot",
  "useItem",
  "throwTorch",
  "pickup",
  "drop",
  "craft",
  "stash",
  "lootChest",
  "fistbump",
  "descend",
]);

/** Offensive action types — performing one forfeits spawn grace (spawnSafety.ts). */
const FORFEITS_SPAWN_GRACE = new Set<PlayerAction["type"]>([
  "attack",
  "useSlot",
  "useItem",
  "throwTorch",
]);

const ITEM_ACTIONS = new Set<PlayerAction["type"]>(["useSlot", "useItem", "throwTorch"]);

function dispatchLootChest(
  sim: SimState,
  slot: PlayerSlot,
  action: Extract<PlayerAction, { type: "lootChest" }>,
): void {
  if (action.op === "open") openLootChestById(sim, slot, action.chestId);
  else if (action.op === "close") closeLootChest(sim, slot, action.chestId);
  else takeLoot(sim, slot, { chestId: action.chestId, op: action.op, item: action.item });
}

function dispatchAction({ sim, slot, action, effectEvents }: ActionContext): void {
  if (action.type === "revive") return setReviveHeld({ sim, rescuer: slot, targetId: action.targetId, held: action.held });
  if (isGatedAction(action)) return dispatchStandingGatedAction({ sim, slot, action, effectEvents });
  dispatchStandingAction({ sim, slot, action });
}

function isGatedAction(action: PlayerAction): boolean {
  return GATED_ON_STANDING.has(action.type);
}

function dispatchStandingGatedAction(context: ActionContext): void {
  if (context.slot.downedAtTick !== null) return;
  if (FORFEITS_SPAWN_GRACE.has(context.action.type)) endSpawnGrace(context.slot);
  dispatchGatedAction(context);
}

/** Combat and item actions — dropped outright while downed. */
function dispatchGatedAction({ sim, slot, action, effectEvents }: ActionContext): void {
  if (ITEM_ACTIONS.has(action.type)) return dispatchItemAction({ sim, slot, action, effectEvents });
  gatedHandlers[action.type]?.({ sim, slot, action, effectEvents });
}

type GatedHandler = (context: ActionContext) => void;

const gatedHandlers: Partial<Record<PlayerAction["type"], GatedHandler>> = {
  attack: (context) => dispatchAttack(context),
  pickup: ({ sim, slot }) => doPickup(sim, slot),
  drop: (context) => dispatchDrop(context),
  craft: (context) => dispatchCraft(context),
  stash: (context) => dispatchStash(context),
  lootChest: (context) => dispatchChest(context),
  fistbump: (context) => dispatchFistbump(context),
  descend: ({ sim, slot }) => doDescend(sim, slot),
};

function dispatchAttack({ sim, slot, action, effectEvents }: ActionContext): void {
  if (action.type === "attack") doAttack({ sim, slot, dirX: action.dirX, dirY: action.dirY, effectEvents });
}

function dispatchDrop({ sim, slot, action }: ActionContext): void {
  if (action.type === "drop") doDrop(sim, slot, action.item);
}

function dispatchCraft({ sim, slot, action }: ActionContext): void {
  if (action.type === "craft") doCraft(sim, slot, action.recipe);
}

function dispatchStash({ sim, slot, action }: ActionContext): void {
  if (action.type === "stash") doStash(sim, slot, { op: action.op, index: action.index });
}

function dispatchChest({ sim, slot, action }: ActionContext): void {
  if (action.type === "lootChest") dispatchLootChest(sim, slot, action);
}

function dispatchFistbump({ sim, slot, action }: ActionContext): void {
  if (action.type === "fistbump") doFistbump(sim, slot, action.targetId);
}
