import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import type { StoredPlayer } from "./store.js";

export const PLAYER_STORE_VERSION = 1;

const stashEntrySchema = z.object({
  item: z.string().min(1),
  qty: z.number().int().positive(),
}).strict();

const storedPlayerSchema = z.object({
  slot: z.number().int().nonnegative(),
  name: z.string(),
  stash: z.array(stashEntrySchema),
  hotbar: z.array(z.string().nullable()).optional(),
  starterHotbarSchema: z.number().int().nonnegative().optional(),
  contacts: z.array(z.string()).optional(),
  xp: z.number().int().nonnegative().optional(),
  level: z.number().int().positive().optional(),
  deepestFloor: z.number().int().positive().optional(),
}).strict();

const playersSchema = z.record(z.string(), storedPlayerSchema);
const legacyStoreSchema = z.object({
  nextSlot: z.number().int().nonnegative(),
  players: playersSchema,
}).strict();
const currentStoreSchema = legacyStoreSchema.extend({
  version: z.literal(PLAYER_STORE_VERSION),
}).strict();

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
  if (version !== undefined && version !== PLAYER_STORE_VERSION) {
    throw new RangeError(`Unsupported player store version ${String(version)}`);
  }
  const parsed = version === undefined
    ? legacyStoreSchema.parse(raw)
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
    } satisfies StoredPlayer]),
  );
  return {
    nextSlot: parsed.nextSlot,
    players,
    migrated: version === undefined,
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
