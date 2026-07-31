import {
  createDebugFlags,
  type AdminCommand,
} from "@dc2d/engine";
import { DEFAULT_HANDICAP } from "../progression/handicap.js";
import type { PlayerSlot, SimState } from "../state/state.js";
import type { AdminMutationResult } from "./adminControls.js";

export function executeAdminPlayerMutation(
  sim: SimState,
  command: AdminCommand,
): AdminMutationResult {
  if (!hasPlayerTarget(command)) return { ok: false, code: "not_a_sim_command" };
  const slot = sim.players.get(command.playerId);
  if (!slot) return { ok: false, code: "player_not_found" };
  return mutateSlot(sim, slot, command);
}

function hasPlayerTarget(command: AdminCommand): command is Extract<AdminCommand, { playerId: string }> {
  return "playerId" in command;
}

function mutateSlot(
  sim: SimState,
  slot: PlayerSlot,
  command: Extract<AdminCommand, { playerId: string }>,
): AdminMutationResult {
  switch (command.op) {
    case "kill":
      killPlayer(slot);
      break;
    case "heal":
      healPlayer(slot);
      break;
    case "god":
      toggleGod(slot, command);
      break;
    case "handicap":
      toggleHandicap(sim, slot, command);
      break;
    case "assignAdmin":
      toggleAdmin(slot, command);
      break;
    default:
      return { ok: false, code: "not_a_sim_command" };
  }
  return { ok: true };
}

function killPlayer(slot: PlayerSlot): void {
  slot.god = false;
  slot.forceDeath = true;
  slot.downedAtTick = null;
  delete slot.entity.downedUntil;
  slot.entity.hp = 0;
  notify(slot, "An admin has slain you.");
}

function healPlayer(slot: PlayerSlot): void {
  slot.entity.hp = slot.entity.maxHp;
  slot.entity.statuses = [];
  slot.downedAtTick = null;
  slot.respawnAtTick = null;
  slot.forceDeath = false;
  delete slot.entity.downedUntil;
  notify(slot, "An admin fully healed you.");
}

function toggleGod(slot: PlayerSlot, command: Extract<AdminCommand, { op: "god" }>): void {
  slot.god = command.enabled;
  notify(slot, `Admin ${command.enabled ? "enabled" : "disabled"} god mode.`);
}

function toggleHandicap(sim: SimState, slot: PlayerSlot, command: Extract<AdminCommand, { op: "handicap" }>): void {
  sim.store.recordHandicapGrant(slot.stored, command.enabled);
  if (command.enabled) slot.handicap = DEFAULT_HANDICAP;
  else delete slot.handicap;
  notify(slot, `Admin ${command.enabled ? "enabled" : "disabled"} handicap.`);
}

function toggleAdmin(slot: PlayerSlot, command: Extract<AdminCommand, { op: "assignAdmin" }>): void {
  slot.admin = command.enabled;
  if (!command.enabled) slot.debugFlags = createDebugFlags();
  notify(slot, `Admin access ${command.enabled ? "granted" : "revoked"} for this live session.`);
}

function notify(slot: PlayerSlot, message: string): void {
  slot.outbox.push({ t: "toast", msg: message });
}
