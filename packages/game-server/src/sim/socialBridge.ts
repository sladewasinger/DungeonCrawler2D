import type { GameEvent } from "@dc2d/engine";
import { localProfileId, socialDeliveryAllowedProfile } from "./moderation.js";
import type { SimState } from "./state.js";

export function injectGlobalChat(
  sim: SimState,
  event: GameEvent,
  senderProfileId?: string,
): void {
  for (const slot of sim.players.values()) {
    if (slot.connected && socialDeliveryAllowedProfile(slot, senderProfileId)) {
      slot.outbox.push(event);
    }
  }
}

export function profileIdForPlayer(sim: SimState, playerId: string): string | undefined {
  const slot = sim.players.get(playerId);
  return slot ? localProfileId(slot) : undefined;
}

export function listConnectedPlayers(
  sim: SimState,
): Array<{ name: string; floor: number; profileId: string }> {
  const floor = sim.world.floor;
  const out: Array<{ name: string; floor: number; profileId: string }> = [];
  for (const slot of sim.players.values()) {
    if (slot.connected) {
      out.push({ name: slot.entity.name ?? "?", floor, profileId: localProfileId(slot) });
    }
  }
  return out;
}
