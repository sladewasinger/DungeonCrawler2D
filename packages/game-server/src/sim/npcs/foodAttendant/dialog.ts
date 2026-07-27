import { CHUNK_SIZE, TICK_RATE, roomKindAt, safeRoomAttendantPosition } from "@dc2d/engine";
import type { PlayerSlot, SimState } from "../../state.js";
import { foodAttendantGreeting } from "./phrases.js";

export const FOOD_ATTENDANT_ID = "safe-room-food-attendant";
export const SAFE_ROOM_ATTENDANT_NAME = "Nib, Safe Room Attendant";
export const FOOD_ATTENDANT_BUBBLE_MS = 4_000;
const GREETING_TICKS = FOOD_ATTENDANT_BUBBLE_MS / 1_000 * TICK_RATE;

interface PendingGreeting {
  playerId: string;
  playerName: string;
}

interface AttendantDialogState {
  cx: number;
  cy: number;
  queue: PendingGreeting[];
  activeUntilTick: number;
}

const states = new WeakMap<SimState, Map<string, AttendantDialogState>>();
const roomKey = (cx: number, cy: number): string => `${cx},${cy}`;

function dialogsFor(sim: SimState): Map<string, AttendantDialogState> {
  const current = states.get(sim);
  if (current) return current;
  const created = new Map<string, AttendantDialogState>();
  states.set(sim, created);
  return created;
}

export function queueFoodAttendantGreeting(
  sim: SimState,
  slot: PlayerSlot,
  room: { cx: number; cy: number },
): void {
  const dialogs = dialogsFor(sim);
  const key = roomKey(room.cx, room.cy);
  const state = dialogs.get(key) ?? { ...room, queue: [], activeUntilTick: 0 };
  if (!state.queue.some((entry) => entry.playerId === slot.entity.id)) {
    state.queue.push({ playerId: slot.entity.id, playerName: slot.entity.name ?? "Crawler" });
  }
  dialogs.set(key, state);
}

function isInRoom(slot: PlayerSlot, cx: number, cy: number): boolean {
  return slot.connected &&
    Math.floor(slot.entity.body.x / CHUNK_SIZE) === cx &&
    Math.floor(slot.entity.body.y / CHUNK_SIZE) === cy;
}

export function stepFoodAttendantDialogs(sim: SimState): void {
  for (const [key, state] of dialogsFor(sim)) {
    stepFoodAttendantDialog({ sim, key, state });
  }
}

function stepFoodAttendantDialog(input: { sim: SimState; key: string; state: AttendantDialogState }): void {
  if (input.sim.tickCount < input.state.activeUntilTick) return;
  const greeting = input.state.queue.shift();
  if (!greeting) return removeClosedRoomDialog(input);
  broadcastGreeting(input.sim, input.state, greeting);
  input.state.activeUntilTick = input.sim.tickCount + GREETING_TICKS;
}

function removeClosedRoomDialog(input: { sim: SimState; key: string; state: AttendantDialogState }): void {
  if (roomKindAt(input.state.cx, input.state.cy) !== "safe") dialogsFor(input.sim).delete(input.key);
}

function broadcastGreeting(sim: SimState, state: AttendantDialogState, greeting: PendingGreeting): void {
  const position = safeRoomAttendantPosition(state.cx, state.cy);
  const text = foodAttendantGreeting(greeting.playerName, sim.rng.next());
  for (const slot of sim.players.values()) {
    if (!isInRoom(slot, state.cx, state.cy)) continue;
    slot.outbox.push({ t: "npcSpeech", npcId: FOOD_ATTENDANT_ID, name: SAFE_ROOM_ATTENDANT_NAME, ...position, text, durationMs: FOOD_ATTENDANT_BUBBLE_MS });
  }
}
