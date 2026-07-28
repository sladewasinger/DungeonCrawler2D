export const PERSONAL_ROOM_W = 13;
export const PERSONAL_ROOM_H = 9;
export const PARTY_ROOM_W = 17;
export const PARTY_ROOM_H = 13;
export const SAFE_ROOM_W = 17;
export const SAFE_ROOM_H = 11;
export const SAFE_ROOM_MAX_OCCUPANTS = 20;

export type RoomKind = "personal" | "party" | "safe";

export interface RoomSlot {
  kind: RoomKind;
  w: number;
  h: number;
}
