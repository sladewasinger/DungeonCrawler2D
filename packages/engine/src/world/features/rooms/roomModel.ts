import { ROOM_TUNING } from "./roomConfiguration/roomTuning.js";

export const PERSONAL_ROOM_W = ROOM_TUNING.personal.width;
export const PERSONAL_ROOM_H = ROOM_TUNING.personal.height;
export const PARTY_ROOM_W = ROOM_TUNING.party.width;
export const PARTY_ROOM_H = ROOM_TUNING.party.height;
export const SAFE_ROOM_W = ROOM_TUNING.safe.width;
export const SAFE_ROOM_H = ROOM_TUNING.safe.height;
export const SAFE_ROOM_MAX_OCCUPANTS = ROOM_TUNING.safe.maximumOccupants;
/** Chunk rows at/below this cy are deterministic room space. */
export const ROOM_REGION_CY = ROOM_TUNING.reservedRegionChunkY;
/** Roughly twice the safe room's footprint while remaining one 32×32 chunk. */
export const SPAWN_ROOM_W = ROOM_TUNING.spawn.width;
export const SPAWN_ROOM_H = ROOM_TUNING.spawn.height;

export type RoomKind = "personal" | "party" | "safe" | "spawn";

export interface RoomSlot {
  kind: RoomKind;
  w: number;
  h: number;
}
