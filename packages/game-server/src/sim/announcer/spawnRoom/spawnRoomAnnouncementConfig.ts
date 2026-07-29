import { TICK_RATE } from "@dc2d/engine";
import spawnRoomAnnouncements from "./spawnRoomAnnouncements.json" with { type: "json" };

const MILLISECONDS_PER_SECOND = 1_000;
const PLAYER_NAME_TOKEN = /\{name\}/g;

export const SPAWN_ROOM_ANNOUNCEMENT_CONFIG = spawnRoomAnnouncements;

export function announcementDurationMs(): number {
  return secondsToMilliseconds(
    SPAWN_ROOM_ANNOUNCEMENT_CONFIG.timing.displayDurationSeconds,
  );
}

export function initialAnnouncementDelayTicks(): number {
  return secondsToTicks(
    SPAWN_ROOM_ANNOUNCEMENT_CONFIG.timing.initialDelaySeconds,
  );
}

export function announcementIntervalTicks(randomUnit: number): number {
  const timing = SPAWN_ROOM_ANNOUNCEMENT_CONFIG.timing;
  const fixedSeconds = timing.displayDurationSeconds +
    timing.pauseBetweenMessagesSeconds;
  const randomTicks = Math.floor(
    randomUnit * secondsToTicks(timing.randomAdditionalPauseSeconds),
  );
  return secondsToTicks(fixedSeconds) + randomTicks;
}

export function configuredSpawnAnnouncement(
  lineIndex: number,
  playerName: string,
): string {
  const messages = SPAWN_ROOM_ANNOUNCEMENT_CONFIG.messages;
  const template = messages[lineIndex % messages.length] ?? messages[0];
  if (!template) throw new Error("Spawn-room announcements require a message");
  return template.replace(PLAYER_NAME_TOKEN, playerName.toUpperCase());
}

function secondsToMilliseconds(seconds: number): number {
  return Math.round(seconds * MILLISECONDS_PER_SECOND);
}

function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICK_RATE);
}
