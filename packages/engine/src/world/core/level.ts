// Level identifiers a World can be constructed against.

export const LEVEL = {
  Dungeon: "dungeon",
  Sandbox: "sandbox",
  CombatSandbox: "combat-sandbox",
} as const;

export type LevelId = (typeof LEVEL)[keyof typeof LEVEL];

export const LEVEL_IDS = [
  LEVEL.Dungeon,
  LEVEL.Sandbox,
  LEVEL.CombatSandbox,
] as const;
