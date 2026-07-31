import {
  ADMIN_WORLD_COORDINATE_LIMIT,
  LEVEL_IDS,
  type AdminCommand,
  type LevelId,
} from "@dc2d/engine";

export function parseAdminSpawnCommand(args: string[]): AdminCommand | null {
  const input = spawnInput(args);
  if (!validSpawnInput(input)) return null;
  return input.kind === "pet"
    ? petSpawnCommand(input)
    : standardSpawnCommand(input);
}

interface SpawnInput {
  readonly kind: string | undefined;
  readonly defId: string | undefined;
  readonly x: number;
  readonly y: number;
  readonly level: string;
  readonly floor: number;
  readonly ownerPlayerId: string | undefined;
  readonly rest: string[];
}

interface ValidSpawnInput {
  readonly kind: "enemy" | "item" | "weapon" | "pet";
  readonly defId: string;
  readonly x: number;
  readonly y: number;
  readonly level: LevelId;
  readonly floor: number;
  readonly ownerPlayerId: string | undefined;
  readonly rest: string[];
}

function spawnInput(
  [kind, defId, xText, yText, level, floorText, ownerPlayerId, ...rest]: string[],
): SpawnInput {
  return {
    kind,
    defId,
    x: Number(xText),
    y: Number(yText),
    level: level ?? "dungeon",
    floor: Number(floorText ?? "1"),
    ownerPlayerId,
    rest,
  };
}

function validSpawnInput(input: SpawnInput): input is ValidSpawnInput {
  return hasValidSpawnIdentity(input) && hasValidSpawnLocation(input) &&
    validSpawnOwner(input) && input.rest.length === 0;
}

function hasValidSpawnIdentity(input: SpawnInput): boolean {
  return isSpawnKind(input.kind) && Boolean(input.defId) && levelIsValid(input.level);
}

function hasValidSpawnLocation(input: SpawnInput): boolean {
  return worldCoordinate(input.x) && worldCoordinate(input.y) &&
    Number.isInteger(input.floor) && boundedNumber(input.floor, 1, 64);
}

function validSpawnOwner(input: SpawnInput): boolean {
  return input.kind === "pet" ? Boolean(input.ownerPlayerId) : input.ownerPlayerId === undefined;
}

function standardSpawnCommand(input: ValidSpawnInput): AdminCommand {
  return {
    op: "spawn",
    kind: input.kind as "enemy" | "item" | "weapon",
    defId: input.defId,
    x: input.x,
    y: input.y,
    level: input.level,
    floor: input.floor,
  };
}

function petSpawnCommand(input: ValidSpawnInput): AdminCommand {
  return {
    op: "spawn",
    kind: "pet",
    defId: input.defId,
    x: input.x,
    y: input.y,
    level: input.level,
    floor: input.floor,
    ownerPlayerId: input.ownerPlayerId!,
  };
}

function isSpawnKind(value: string | undefined): value is ValidSpawnInput["kind"] {
  return value === "enemy" || value === "item" || value === "weapon" || value === "pet";
}

function levelIsValid(value: string): value is ValidSpawnInput["level"] {
  return LEVEL_IDS.some((level) => level === value);
}

function boundedNumber(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function worldCoordinate(value: number): boolean {
  return boundedNumber(value, -ADMIN_WORLD_COORDINATE_LIMIT, ADMIN_WORLD_COORDINATE_LIMIT);
}
