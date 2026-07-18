export const LEVEL = {
  Dungeon: "dungeon",
  Sandbox: "sandbox",
} as const;

export type LevelId = (typeof LEVEL)[keyof typeof LEVEL];

export const LEVEL_IDS: readonly LevelId[] = [LEVEL.Dungeon, LEVEL.Sandbox];
