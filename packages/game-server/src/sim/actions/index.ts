import type { EffectEvent } from "@dc2d/engine";
import { doCraft, doDrop, doPickup, doStash, invIndex } from "../inventory.js";
import { doChat, doParty } from "../social.js";
import type { PlayerAction, PlayerSlot, SimState } from "../state.js";
import { doInteract, teleport } from "./interact.js";
import { doUseSlot } from "./items.js";
import { doAttack } from "./melee.js";

/** Queued player actions: combat, item use, doors, and delegation to
 * inventory/social modules. Downed players can only interact (revive
 * flows) and manage party/chat. */

export function processActions(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const slot of sim.players.values()) {
    const actions = slot.pendingActions.splice(0);
    if (slot.entity.hp <= 0) continue;
    for (const action of actions) {
      if (slot.entity.hp <= 0) break;
      dispatchAction(sim, slot, action, effectEvents);
    }
  }
}

/** Action types that a downed player (mid-revive, can't act) may not perform. */
const GATED_ON_STANDING = new Set<PlayerAction["type"]>([
  "attack",
  "useSlot",
  "pickup",
  "drop",
  "craft",
  "stash",
]);

function dispatchAction(
  sim: SimState,
  slot: PlayerSlot,
  action: PlayerAction,
  effectEvents: EffectEvent[],
): void {
  if (GATED_ON_STANDING.has(action.type)) {
    if (slot.downedAtTick === null) dispatchGatedAction(sim, slot, action, effectEvents);
    return;
  }
  dispatchStandingAction(sim, slot, action, effectEvents);
}

/** Combat and item actions — dropped outright while downed. */
function dispatchGatedAction(
  sim: SimState,
  slot: PlayerSlot,
  action: PlayerAction,
  effectEvents: EffectEvent[],
): void {
  switch (action.type) {
    case "attack":
      doAttack(sim, slot, action.dirX, action.dirY, effectEvents);
      break;
    case "useSlot":
      doUseSlot(sim, slot, action.slot, action.targetX, action.targetY, effectEvents);
      break;
    case "pickup":
      doPickup(sim, slot);
      break;
    case "drop":
      doDrop(sim, slot, action.item);
      break;
    case "craft":
      doCraft(sim, slot, action.recipe);
      break;
    case "stash":
      doStash(sim, slot, action.op, action.index);
      break;
  }
}

/** Menu/social actions and revive-flow interact — allowed even while downed. */
function dispatchStandingAction(
  sim: SimState,
  slot: PlayerSlot,
  action: PlayerAction,
  effectEvents: EffectEvent[],
): void {
  switch (action.type) {
    case "suicide":
      doSuicide(slot);
      break;
    case "assign":
      // Bind an owned def (or clear) — the hotbar holds references.
      if (action.item === null || invIndex(slot, action.item) >= 0) {
        slot.hotbar[action.slot] = action.item;
      }
      break;
    case "equip":
      doEquip(sim, slot, action.item);
      break;
    case "interact":
      doInteract(sim, slot, effectEvents);
      break;
    case "party":
      doParty(sim, slot, action.op, action.target);
      break;
    case "chat":
      doChat(sim, slot, action.channel, action.text);
      break;
    case "debug":
      doDebug(sim, slot, action);
      break;
  }
}

function doSuicide(slot: PlayerSlot): void {
  slot.god = false;
  slot.forceDeath = true;
  slot.downedAtTick = null;
  delete slot.entity.downedUntil;
  slot.entity.hp = 0;
  slot.pendingInputs.length = 0;
}

function doEquip(sim: SimState, slot: PlayerSlot, item: string | null): void {
  if (item === null) {
    slot.weapon = null;
  } else if (invIndex(slot, item) >= 0 && sim.content.items.get(item)?.weapon) {
    slot.weapon = item;
  }
}

/** Dev harness only — a production shard drops these outright. */
function doDebug(
  sim: SimState,
  slot: PlayerSlot,
  action: Extract<PlayerAction, { type: "debug" }>,
): void {
  if (!sim.opts.debugCommands) return;
  if (action.op === "god") {
    slot.god = action.on ?? true;
    slot.outbox.push({ t: "toast", msg: slot.god ? "God mode ON" : "God mode off" });
    return;
  }
  const { x, y } = action;
  // Number.isFinite rejects undefined/NaN but doesn't narrow the optional type for TS.
  if (action.op === "teleport" && Number.isFinite(x) && Number.isFinite(y)) {
    teleport(sim, slot, { x: x as number, y: y as number }, { remember: false });
  }
}
