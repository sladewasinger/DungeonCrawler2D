import {
  hash2D,
  mixSeeds,
  type MiniBossArenaSite,
} from "@dc2d/engine";

const COMPOSITION_SALT = 0xd3a0;

export type MiniBossEncounterId = "orc-warlord" | "greater-demon";

export interface MiniBossEncounterComposition {
  readonly id: MiniBossEncounterId;
  readonly leaderDefId: string;
  readonly minionDefIds: readonly string[];
}

export interface MiniBossEncounterSelection {
  readonly worldSeed: number;
  readonly floor: number;
  readonly arena: Pick<MiniBossArenaSite, "chunk">;
}

const MINI_BOSS_ENCOUNTERS: readonly MiniBossEncounterComposition[] = [
  {
    id: "orc-warlord",
    leaderDefId: "orc-warlord",
    minionDefIds: ["orc-warrior", "orc-shaman", "masked-orc"],
  },
  {
    id: "greater-demon",
    leaderDefId: "big-demon",
    minionDefIds: ["chort", "chort", "chort"],
  },
];

/** Chooses a stable arena composition without consuming simulation RNG. */
export function miniBossEncounterForArena(
  input: MiniBossEncounterSelection,
): MiniBossEncounterComposition {
  const { worldSeed, floor, arena } = input;
  const seed = mixSeeds(worldSeed, floor, COMPOSITION_SALT);
  const roll = hash2D(seed, arena.chunk.cx, arena.chunk.cy);
  return MINI_BOSS_ENCOUNTERS[roll % MINI_BOSS_ENCOUNTERS.length]!;
}
