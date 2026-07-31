import {
  existsSync,
  readFileSync,
  renameSync,
} from "node:fs";
import type { StoredPlayer } from "./store.js";
import { storedPlayer } from "./storeFilePlayer.js";
import { writePlayerStoreFile } from "./storeFileWrite.js";
import {
  currentStoreSchema,
  legacyStoreSchema,
  versionOneStoreSchema,
  versionThreeStoreSchema,
  versionTwoStoreSchema,
} from "./storeFileSchemas.js";

export const PLAYER_STORE_VERSION = 4;
const SUPPORTED_STORE_VERSIONS = new Set<number | undefined>([undefined, 1, 2, 3, PLAYER_STORE_VERSION]);

export interface PlayerStoreFileData {
  nextSlot: number;
  players: Record<string, StoredPlayer>;
}

export interface LoadedPlayerStore extends PlayerStoreFileData {
  migrated: boolean;
}

const nodeErrorCode = (error: unknown): string | undefined =>
  error instanceof Error && "code" in error
    ? String((error as NodeJS.ErrnoException).code)
    : undefined;

const validateSlots = <T extends PlayerStoreFileData>(data: T): T => {
  const slots = Object.values(data.players).map((player) => player.slot);
  const requiredNextSlot = slots.length === 0 ? 0 : Math.max(...slots) + 1;
  if (data.nextSlot < requiredNextSlot) {
    throw new Error(
      `nextSlot ${data.nextSlot} would reuse an existing player slot; expected at least ${requiredNextSlot}`,
    );
  }
  return data;
};

const declaredVersion = (raw: unknown): number | undefined => {
  if (typeof raw !== "object" || raw === null || !("version" in raw)) return undefined;
  const version = (raw as { version?: unknown }).version;
  return typeof version === "number" ? version : Number.NaN;
};

const quarantinePath = (file: string): string => {
  const base = `${file}.corrupt-${Date.now()}`;
  let candidate = base;
  let suffix = 1;
  while (existsSync(candidate)) candidate = `${base}-${suffix++}`;
  return candidate;
};

const quarantine = (file: string, reason: unknown): void => {
  const destination = quarantinePath(file);
  try {
    renameSync(file, destination);
  } catch (error) {
    throw new Error(`Invalid player store could not be preserved at ${file}`, {
      cause: error,
    });
  }
  console.error(`[store] invalid save moved to ${destination}:`, reason);
};

const decode = (text: string): LoadedPlayerStore => {
  const raw: unknown = JSON.parse(text);
  const version = declaredVersion(raw);
  assertSupportedVersion(version);
  const parsed = parseVersionedStore(raw, version);
  const players = Object.fromEntries(Object.entries(parsed.players)
    .map(([id, player]) => [id, storedPlayer(player)]));
  return {
    nextSlot: parsed.nextSlot,
    players,
    migrated: version !== PLAYER_STORE_VERSION,
  };
};

function assertSupportedVersion(version: number | undefined): void {
  if (!SUPPORTED_STORE_VERSIONS.has(version)) {
    throw new RangeError(`Unsupported player store version ${String(version)}`);
  }
}

function parseVersionedStore(raw: unknown, version: number | undefined) {
  if (version === undefined) return legacyStoreSchema.parse(raw);
  if (version === 1) return versionOneStoreSchema.parse(raw);
  if (version === 2) return versionTwoStoreSchema.parse(raw);
  if (version === 3) return versionThreeStoreSchema.parse(raw);
  return currentStoreSchema.parse(raw);
}

export const loadPlayerStoreFile = (file: string): LoadedPlayerStore | null => {
  const text = readPlayerStoreText(file);
  return text === null ? null : decodeOrQuarantine(file, text);
};

function readPlayerStoreText(file: string): string | null {
  try {
    return readFileSync(file, "utf8");
  } catch (error) {
    if (nodeErrorCode(error) === "ENOENT") return null;
    throw error;
  }
}

function decodeOrQuarantine(file: string, text: string): LoadedPlayerStore | null {
  try {
    return validateSlots(decode(text));
  } catch (error) {
    if (error instanceof RangeError) throw error;
    quarantine(file, error);
    return null;
  }
};

export const savePlayerStoreFile = (file: string, data: PlayerStoreFileData): void =>
  writePlayerStoreFile(file, data, PLAYER_STORE_VERSION);
