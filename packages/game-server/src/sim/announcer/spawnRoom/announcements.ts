import {
  CHUNK_SIZE,
  roomKindAt,
  spawnRoomSpeakerPosition,
} from "@dc2d/engine";
import type { PlayerSlot, SimState } from "../../state/state.js";
import {
  SPAWN_ROOM_ANNOUNCEMENT_CONFIG,
  announcementDurationMs,
  announcementIntervalTicks,
  configuredSpawnAnnouncement,
  initialAnnouncementDelayTicks,
} from "./spawnRoomAnnouncementConfig.js";

export const SPAWN_INTERCOM_ID =
  SPAWN_ROOM_ANNOUNCEMENT_CONFIG.speaker.id;
export const SPAWN_INTERCOM_NAME =
  SPAWN_ROOM_ANNOUNCEMENT_CONFIG.speaker.name;
export const SPAWN_ANNOUNCEMENT_MS = announcementDurationMs();

interface SpawnAnnouncementState {
  lineIndex: number;
  nextAtTick: number;
}

const states = new WeakMap<SimState, SpawnAnnouncementState>();

export function spawnRoomAnnouncement(
  lineIndex: number,
  playerName: string,
): string {
  return configuredSpawnAnnouncement(lineIndex, playerName);
}

export function stepSpawnRoomAnnouncements(sim: SimState): void {
  const occupants = spawnRoomOccupants(sim);
  if (occupants.length === 0) {
    states.delete(sim);
    return;
  }
  const state = states.get(sim) ?? {
    lineIndex: 0,
    nextAtTick: sim.tickCount + initialAnnouncementDelayTicks(),
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
  const messageCount = SPAWN_ROOM_ANNOUNCEMENT_CONFIG.messages.length;
  state.lineIndex = (state.lineIndex + 1) % messageCount;
  state.nextAtTick = sim.tickCount +
    announcementIntervalTicks(sim.rng.next());
}
