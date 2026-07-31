import {
  HOTBAR_SLOTS,
  PLAYER_MAX_STAMINA,
  createDebugFlags,
  type Entity,
} from "@dc2d/engine";
import { handicapForPlayer } from "../progression/handicap.js";
import type { PlayerSlot } from "../state/state.js";

export interface NewPlayerSlot {
  entity: Entity;
  clientId: string;
  stored: PlayerSlot["stored"];
  resumeToken: string;
  tick: number;
}

export function createPlayerSlot(request: NewPlayerSlot): PlayerSlot {
  const { entity, clientId, stored, resumeToken, tick } = request;
  const handicap = handicapForPlayer(entity.name ?? "", stored.handicapGranted);
  return {
    entity, clientId, stored, resumeToken,
    ...connectionState(),
    ...inventoryState(stored),
    ...combatState(tick),
    ...(handicap ? { handicap } : {}),
  };
}

function connectionState() {
  return {
    ...connectionTiming(),
    ...connectionGameplay(),
  };
}

function connectionTiming() {
  return {
    lastSeq: -1,
    highestReceivedSeq: -1,
    lastProjectedServerTick: -1,
    pendingInputs: [],
    pendingActions: [],
    connected: true,
    disconnectedAtTick: null,
    reapAtTick: Number.MAX_SAFE_INTEGER,
    known: new Set<string>(),
  };
}

function connectionGameplay() {
  return {
    outbox: [],
    returnStack: [],
    partyId: null,
    respawnAtTick: null,
    needsFullAreas: true,
    downedAtTick: null,
    attackReadyAtTick: 0,
    attackStartedAtTick: Number.NEGATIVE_INFINITY,
    god: false,
    admin: false,
    debugFlags: createDebugFlags(),
    forceDeath: false,
    rescueReadyAtTick: Number.NEGATIVE_INFINITY,
    chatTimestamps: [],
    lastFistbumpOfferAtTick: Number.NEGATIVE_INFINITY,
    spawnGraceUntilTick: 0,
    pendingTransfer: null,
  };
}

function inventoryState(stored: PlayerSlot["stored"]): Pick<PlayerSlot, "inventory" | "hotbar" | "weapon"> {
  return { inventory: [], hotbar: restoredHotbar(stored), weapon: null };
}

function restoredHotbar(stored: PlayerSlot["stored"]): Array<string | null> {
  const hotbar = Array<string | null>(HOTBAR_SLOTS).fill(null);
  const saved = stored.hotbar?.slice(0, HOTBAR_SLOTS) ?? [];
  for (const [index, item] of saved.entries()) hotbar[index] = item;
  return hotbar;
}

function combatState(tick: number): Pick<
  PlayerSlot,
  "stamina" | "maxStamina" | "blocking" |
  "staminaRecoveryDelaySeconds" | "staminaExhausted" |
  "lastDamageAtTick"
> {
  return {
    stamina: PLAYER_MAX_STAMINA,
    maxStamina: PLAYER_MAX_STAMINA,
    blocking: false,
    staminaRecoveryDelaySeconds: 0,
    staminaExhausted: false,
    lastDamageAtTick: tick,
  };
}
