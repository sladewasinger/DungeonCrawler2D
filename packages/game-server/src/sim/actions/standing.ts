import { doWho } from "../combat/contacts.js";
import { invIndex } from "../inventory/inventory.js";
import { doModeration } from "../moderation.js";
import { resetInputTimeline } from "../players/playerInputTimeline.js";
import { doRescue } from "../rescue/rescueAction.js";
import { doChat, doParty } from "../social/social.js";
import type { PlayerAction, PlayerSlot, SimState } from "../state/state.js";
import { doInteract } from "./interact.js";
import { teleportPlayer } from "./playerTeleport.js";

export interface StandingActionContext {
  sim: SimState;
  slot: PlayerSlot;
  action: PlayerAction;
}

export function dispatchStandingAction({ sim, slot, action }: StandingActionContext): void {
  standingHandlers[action.type]?.({ sim, slot, action });
}

type StandingHandler = (context: StandingActionContext) => void;

const standingHandlers: Partial<Record<PlayerAction["type"], StandingHandler>> = {
  suicide: ({ slot }) => doSuicide(slot),
  assign: (context) => dispatchAssign(context),
  equip: (context) => dispatchEquip(context),
  interact: ({ sim, slot }) => doInteract({ sim, slot }),
  party: (context) => dispatchSocial(context),
  chat: (context) => dispatchSocial(context),
  who: (context) => dispatchSocial(context),
  moderation: (context) => dispatchSocial(context),
  rescue: ({ sim, slot }) => doRescue(sim, slot),
  debug: (context) => dispatchDebug(context),
};

function dispatchAssign({ sim, slot, action }: StandingActionContext): void {
  if (action.type === "assign") doAssign({ sim, slot, hotbarSlot: action.slot, item: action.item });
}

function dispatchEquip({ sim, slot, action }: StandingActionContext): void {
  if (action.type === "equip") doEquip(sim, slot, action.item);
}

function dispatchSocial({ sim, slot, action }: StandingActionContext): void {
  if (action.type === "party" || action.type === "chat" || action.type === "who" || action.type === "moderation") {
    dispatchSocialAction(sim, slot, action);
  }
}

function dispatchDebug({ sim, slot, action }: StandingActionContext): void {
  if (action.type === "debug") doDebug(sim, slot, action);
}

function dispatchSocialAction(
  sim: SimState,
  slot: PlayerSlot,
  action: Extract<PlayerAction, { type: "party" | "chat" | "who" | "moderation" }>,
): void {
  if (action.type === "party") return dispatchPartyAction(sim, slot, action);
  if (action.type === "chat") return doChat({ sim, slot, channel: action.channel, text: action.text, target: action.target });
  if (action.type === "who") return doWho(sim, slot);
  dispatchModerationAction(sim, slot, action);
}

function dispatchPartyAction(sim: SimState, slot: PlayerSlot, action: Extract<PlayerAction, { type: "party" }>): void {
  if (action.target === undefined) doParty({ sim, slot, op: action.op });
  else doParty({ sim, slot, op: action.op, target: action.target });
}

function dispatchModerationAction(sim: SimState, slot: PlayerSlot, action: Extract<PlayerAction, { type: "moderation" }>): void {
  const input = { sim, slot, op: action.op, targetId: action.target };
  if (action.reason === undefined) doModeration(input);
  else doModeration({ ...input, reason: action.reason });
}

function doSuicide(slot: PlayerSlot): void {
  slot.god = false;
  slot.forceDeath = slot.downedAtTick !== null;
  if (slot.forceDeath) slot.downedAtTick = null;
  if (slot.forceDeath) delete slot.entity.downedUntil;
  slot.entity.hp = 0;
  resetInputTimeline(slot);
}

function doAssign({ sim, slot, hotbarSlot, item }: { sim: SimState; slot: PlayerSlot; hotbarSlot: number; item: string | null }): void {
  if (item === null) return clearAssignedItem({ sim, slot, hotbarSlot });
  if (isAssignableItem(sim, slot, item)) recordAssignedItem({ sim, slot, hotbarSlot, item });
}

function clearAssignedItem({ sim, slot, hotbarSlot }: Omit<Assignment, "item">): void {
  recordAssignedItem({ sim, slot, hotbarSlot, item: null });
}

function isAssignableItem(sim: SimState, slot: PlayerSlot, item: string): boolean {
  const def = sim.content.items.get(item);
  return invIndex(slot, item) >= 0 && !def?.weapon && Boolean(def?.consumable || def?.throwable);
}

interface Assignment {
  sim: SimState;
  slot: PlayerSlot;
  hotbarSlot: number;
  item: string | null;
}

function recordAssignedItem({ sim, slot, hotbarSlot, item }: Assignment): void {
  slot.hotbar[hotbarSlot] = item;
  sim.store.recordHotbar(slot.stored, slot.hotbar);
}

function doEquip(sim: SimState, slot: PlayerSlot, item: string | null): void {
  if (item === null) return void (slot.weapon = null);
  if (invIndex(slot, item) >= 0 && sim.content.items.get(item)?.weapon) slot.weapon = item;
}

function doDebug(sim: SimState, slot: PlayerSlot, action: Extract<PlayerAction, { type: "debug" }>): void {
  if (!sim.opts.debugCommands) return;
  if (action.op === "god") return toggleGod(slot, action.on);
  if (action.op === "teleport" && Number.isFinite(action.x) && Number.isFinite(action.y)) {
    teleportPlayer({
      sim,
      slot,
      to: { x: action.x as number, y: action.y as number },
      remember: false,
    });
  }
}

function toggleGod(slot: PlayerSlot, on: boolean | undefined): void {
  slot.god = on ?? !slot.god;
  slot.outbox.push({ t: "toast", msg: slot.god ? "God mode ON" : "God mode off" });
}
