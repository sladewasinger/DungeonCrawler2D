import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type { StoredPlayer } from "./store.js";
import {
  currentStoreSchema,
  legacyStoreSchema,
  versionOneStoreSchema,
  versionTwoStoreSchema,
  type StoredFilePlayer,
} from "./storeFileSchemas.js";

export const PLAYER_STORE_VERSION = 3;

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

const descentState = (
  player: StoredFilePlayer,
): Pick<StoredPlayer, "activeFloor" | "descentComplete"> => {
  if (
    "activeFloor" in player
    && typeof player.activeFloor === "number"
    && "descentComplete" in player
    && typeof player.descentComplete === "boolean"
  ) {
    return {
      activeFloor: player.activeFloor,
      descentComplete: player.descentComplete,
    };
  }
  return { activeFloor: 1, descentComplete: false };
};

const profileState = (
  player: StoredFilePlayer,
): Pick<
  StoredPlayer,
  "localProfileId" | "craftedRecipes" | "mutedProfileIds" | "blockedProfileIds"
> => {
  if ("localProfileId" in player && typeof player.localProfileId === "string") {
    return {
      localProfileId: player.localProfileId,
      craftedRecipes: player.craftedRecipes,
      mutedProfileIds: player.mutedProfileIds,
      blockedProfileIds: player.blockedProfileIds,
    };
  }
  return {
    localProfileId: `local-profile-${player.slot}`,
    craftedRecipes: {},
    mutedProfileIds: [],
    blockedProfileIds: [],
  };
};

const decode = (text: string): LoadedPlayerStore => {
  const raw: unknown = JSON.parse(text);
  const version = declaredVersion(raw);
  if (version !== undefined && version !== 1 && version !== 2 && version !== PLAYER_STORE_VERSION) {
    throw new RangeError(`Unsupported player store version ${String(version)}`);
  }
  const parsed = version === undefined
    ? legacyStoreSchema.parse(raw)
    : version === 1
      ? versionOneStoreSchema.parse(raw)
      : version === 2
        ? versionTwoStoreSchema.parse(raw)
        : currentStoreSchema.parse(raw);
  const players = Object.fromEntries(
    Object.entries(parsed.players).map(([id, player]) => [id, {
      slot: player.slot,
      name: player.name,
      stash: player.stash,
      contacts: player.contacts ?? [],
      ...(player.hotbar === undefined ? {} : { hotbar: player.hotbar }),
      ...(player.starterHotbarSchema === undefined
        ? {}
        : { starterHotbarSchema: player.starterHotbarSchema }),
      ...(player.xp === undefined ? {} : { xp: player.xp }),
      ...(player.level === undefined ? {} : { level: player.level }),
      ...(player.deepestFloor === undefined ? {} : { deepestFloor: player.deepestFloor }),
      ...descentState(player),
      ...profileState(player),
    } satisfies StoredPlayer]),
  );
  return {
    nextSlot: parsed.nextSlot,
    players,
    migrated: version !== PLAYER_STORE_VERSION,
  };
};

export const loadPlayerStoreFile = (file: string): LoadedPlayerStore | null => {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    if (nodeErrorCode(error) === "ENOENT") return null;
    throw error;
  }
  try {
    return validateSlots(decode(text));
  } catch (error) {
    if (error instanceof RangeError) throw error;
    quarantine(file, error);
    return null;
  }
};

export const savePlayerStoreFile = (
  file: string,
  data: PlayerStoreFileData,
): void => {
  const temporary = `${file}.${process.pid}.tmp`;
  mkdirSync(dirname(file), { recursive: true });
  try {
    writeFileSync(
      temporary,
      JSON.stringify({
        version: PLAYER_STORE_VERSION,
        nextSlot: data.nextSlot,
        players: data.players,
      }),
      { encoding: "utf8", mode: 0o600 },
    );
    renameSync(temporary, file);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
};
