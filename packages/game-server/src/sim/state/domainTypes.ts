import type { Entity, GameEvent, InvStack } from "@dc2d/engine";
import type { PetSlot } from "../pets/types.js";
import type { PlayerSlot } from "./state.js";

export type FloorArrivalKind = "stairUp" | "deathSpawn";

export interface PendingTransfer {
  targetFloor: number;
  arrival: FloorArrivalKind;
}

export interface ReviveAttempt {
  readonly rescuerId: string;
  readonly targetId: string;
  readonly startedAtTick: number;
  readonly startX: number;
  readonly startY: number;
}

export interface FloorTransferRequest extends PendingTransfer {
  slot: PlayerSlot;
  pets: PetSlot[];
}

export interface Party {
  id: string;
  leaderId: string;
  members: Set<string>;
  roomSlot: number | null;
}

export interface LootChest {
  entity: Entity;
  slots: InvStack[];
  viewerId: string | null;
  victimId: string;
  victimName: string;
  killerId: string | null;
  killerName: string | null;
  unlockAtTick: number;
  expiresAtTick: number;
}

export interface ModerationReport {
  tick: number;
  reporterId: string;
  targetId: string;
  reason: string;
}

export interface JoinResult {
  playerId: string;
  resumeToken: string;
  spawn: { x: number; y: number; z: number };
  resumed: boolean;
  floor: number;
}

export interface WorldEvent {
  ev: GameEvent;
  x: number;
  y: number;
}
