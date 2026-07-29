export const PERSONAL_ROOM_W = 13;
export const PERSONAL_ROOM_H = 9;
export const PARTY_ROOM_W = 17;
export const PARTY_ROOM_H = 13;
export const SAFE_ROOM_W = 17;
export const SAFE_ROOM_H = 11;
export const SAFE_ROOM_MAX_OCCUPANTS = 20;
/** Chunk rows at/below this cy are deterministic room space. */
export const ROOM_REGION_CY = 4096;
/** Roughly twice the safe room's footprint while remaining one 32×32 chunk. */
export const SPAWN_ROOM_W = 23;
export const SPAWN_ROOM_H = 17;

export type RoomKind = "personal" | "party" | "safe" | "spawn";

export interface RoomSlot {
  kind: RoomKind;
  w: number;
  h: number;
}
