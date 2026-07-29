import {
  CHUNK_SIZE,
  TICK_RATE,
  roomKindAt,
  spawnRoomSpeakerPosition,
} from "@dc2d/engine";
import type { PlayerSlot, SimState } from "../../state/state.js";

export const SPAWN_INTERCOM_ID = "spawn-room-intercom";
export const SPAWN_INTERCOM_NAME = "Spawn Room Intercom";
export const SPAWN_ANNOUNCEMENT_MS = 4_000;
const MIN_PAUSE_TICKS = 6 * TICK_RATE;
const RANDOM_PAUSE_TICKS = 5 * TICK_RATE;
const INITIAL_DELAY_TICKS = 2 * TICK_RATE;

const ANNOUNCEMENTS: ReadonlyArray<(name: string) => string> = [
  () => "GET OUT THERE AND DO SOME DAMAGE!!!",
  (name) => `WHY ARE YOU STILL HERE, CRAWLER ${name.toUpperCase()}?!`,
  () => "THE ONLY WAY BACK IN IS THROUGH THE GRAVE.",
  () => "THIS IS A SPAWN ROOM, NOT A RETIREMENT HOME!",
  () => "THE DUNGEON ISN'T GOING TO BLEED ITSELF!",
];

interface SpawnAnnouncementState {
  lineIndex: number;
  nextAtTick: number;
}

const states = new WeakMap<SimState, SpawnAnnouncementState>();

export function spawnRoomAnnouncement(
  lineIndex: number,
  playerName: string,
): string {
  const line = ANNOUNCEMENTS[lineIndex % ANNOUNCEMENTS.length];
  return (line ?? ANNOUNCEMENTS[0]!)(playerName);
}

export function stepSpawnRoomAnnouncements(sim: SimState): void {
  const occupants = spawnRoomOccupants(sim);
  if (occupants.length === 0) {
    states.delete(sim);
    return;
  }
  const state = states.get(sim) ?? {
    lineIndex: 0,
    nextAtTick: sim.tickCount + INITIAL_DELAY_TICKS,
  };
  states.set(sim, state);
  if (sim.tickCount < state.nextAtTick) return;
  broadcastSpawnAnnouncement(occupants, state.lineIndex);
  scheduleNextAnnouncement(sim, state);
}

function spawnRoomOccupants(sim: SimState): PlayerSlot[] {
  return [...sim.players.values()].filter((slot) => {
    if (!slot.connected) return false;
    const cx = Math.floor(slot.entity.body.x / CHUNK_SIZE);
    const cy = Math.floor(slot.entity.body.y / CHUNK_SIZE);
    return roomKindAt(cx, cy) === "spawn";
  });
}

function broadcastSpawnAnnouncement(
  occupants: readonly PlayerSlot[],
  lineIndex: number,
): void {
  const { x, y } = spawnRoomSpeakerPosition();
  for (const slot of occupants) {
    const playerName = slot.entity.name ?? "CRAWLER";
    slot.outbox.push({
      t: "npcSpeech",
      npcId: SPAWN_INTERCOM_ID,
      name: SPAWN_INTERCOM_NAME,
      x,
      y,
      text: spawnRoomAnnouncement(lineIndex, playerName),
      durationMs: SPAWN_ANNOUNCEMENT_MS,
    });
  }
}

function scheduleNextAnnouncement(
  sim: SimState,
  state: SpawnAnnouncementState,
): void {
  const randomDelay = Math.floor(sim.rng.next() * RANDOM_PAUSE_TICKS);
  state.lineIndex = (state.lineIndex + 1) % ANNOUNCEMENTS.length;
  state.nextAtTick = sim.tickCount + MIN_PAUSE_TICKS + randomDelay;
}
