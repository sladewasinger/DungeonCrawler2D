import {
  ADMIN_WORLD_COORDINATE_LIMIT,
  LEVEL_IDS,
  type AdminCommand,
  type LevelId,
} from "@dc2d/engine";
import { parseAdminSpawnCommand } from "./chatSpawnCommand.js";

export function isAdminChatCommand(text: string): boolean {
  return text.trim().toLowerCase().startsWith("/admin");
}

export function parseAdminChatCommand(text: string): AdminCommand | null {
  const [verb, ...args] = text.trim().split(/\s+/);
  if (verb?.toLowerCase() !== "/admin") return null;
  return parseVerb(args);
}

function parseVerb([verb, ...args]: string[]): AdminCommand | null {
  return CHAT_COMMANDS[verb?.toLowerCase() ?? ""]?.(args) ?? null;
}

type ChatCommandParser = (args: string[]) => AdminCommand | null;

const CHAT_COMMANDS: Readonly<Record<string, ChatCommandParser>> = {
  list: () => ({ op: "list" }),
  track: (args) => playerArgument(args, (playerId) => ({ op: "spectate", playerId })),
  free: noArguments(() => ({ op: "spectator", action: "start", mode: "free" })),
  stop: noArguments(() => ({ op: "spectator", action: "stop" })),
  next: noArguments(() => ({ op: "spectator", action: "cycle", direction: "next" })),
  previous: noArguments(() => ({ op: "spectator", action: "cycle", direction: "previous" })),
  heal: (args) => playerArgument(args, (playerId) => ({ op: "heal", playerId })),
  kill: (args) => playerArgument(args, (playerId) => ({ op: "kill", playerId })),
  god: (args) => toggleArgument(args, "god"),
  handicap: (args) => toggleArgument(args, "handicap"),
  "kill-enemies": killEnemies,
  teleport,
  map,
  spawn: parseAdminSpawnCommand,
};

function playerArgument(
  [playerId, ...rest]: string[],
  factory: (playerId: string) => AdminCommand,
): AdminCommand | null {
  return playerId && rest.length === 0 ? factory(playerId) : null;
}

function noArguments(factory: () => AdminCommand): ChatCommandParser {
  return (args) => args.length === 0 ? factory() : null;
}

function toggleArgument(
  [playerId, value, ...rest]: string[],
  op: "god" | "handicap",
): AdminCommand | null {
  if (!playerId || !value || rest.length > 0) return null;
  if (value !== "on" && value !== "off") return null;
  return { op, playerId, enabled: value === "on" };
}

function killEnemies([centerPlayerId, radiusText, ...rest]: string[]): AdminCommand | null {
  const radius = Number(radiusText ?? "8");
  return centerPlayerId && rest.length === 0 && boundedNumber(radius, 1, 64)
    ? { op: "killEnemies", centerPlayerId, radius }
    : null;
}

function teleport([playerId, destination, ...args]: string[]): AdminCommand | null {
  if (!playerId || !destination) return null;
  return simpleTeleport(playerId, destination, args)
    ?? playerTeleport(playerId, destination, args)
    ?? coordinateTeleport(playerId, destination, args);
}

function simpleTeleport(
  playerId: string,
  destination: string,
  args: readonly string[],
): AdminCommand | null {
  const destinations = new Set(["spawn", "safeRoom", "self"]);
  return destinations.has(destination) && args.length === 0
    ? { op: "teleport", playerId, destination: destination as "spawn" | "safeRoom" | "self" }
    : null;
}

function playerTeleport(
  playerId: string,
  destination: string,
  args: readonly string[],
): AdminCommand | null {
  return destination === "player" && args.length === 1 && args[0]
    ? { op: "teleport", playerId, destination: "player", targetPlayerId: args[0] }
    : null;
}

function coordinateTeleport(
  playerId: string,
  destination: string,
  [xText, yText, ...rest]: readonly string[],
): AdminCommand | null {
  const x = Number(xText);
  const y = Number(yText);
  return destination === "coordinates" && rest.length === 0 &&
    worldCoordinate(x) && worldCoordinate(y)
    ? { op: "teleport", playerId, destination: "coordinates", x, y }
    : null;
}

function map([level, floorText, xText, yText, radiusText, ...rest]: string[]): AdminCommand | null {
  const input = { level, floor: Number(floorText), x: Number(xText), y: Number(yText), radius: Number(radiusText ?? "10"), rest };
  return validMapInput(input)
    ? { op: "map", level: input.level, floor: input.floor, x: input.x, y: input.y, radius: input.radius }
    : null;
}

function validMapInput(input: MapInput): input is ValidMapInput {
  return levelIsValid(input.level) && input.rest.length === 0 && Number.isInteger(input.floor) && boundedNumber(input.floor, 1, 64) &&
    worldCoordinate(input.x) && worldCoordinate(input.y) && Number.isInteger(input.radius) && boundedNumber(input.radius, 4, 16);
}

interface MapInput { level: string | undefined; floor: number; x: number; y: number; radius: number; rest: string[] }
interface ValidMapInput { level: LevelId; floor: number; x: number; y: number; radius: number; rest: [] }

function levelIsValid(value: string | undefined): value is LevelId {
  return LEVEL_IDS.some((level) => level === value);
}

function boundedNumber(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function worldCoordinate(value: number): boolean {
  return boundedNumber(value, -ADMIN_WORLD_COORDINATE_LIMIT, ADMIN_WORLD_COORDINATE_LIMIT);
}
