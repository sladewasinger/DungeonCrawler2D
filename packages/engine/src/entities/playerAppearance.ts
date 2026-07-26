export const PLAYER_GENDERS = ["female", "male"] as const;
export type PlayerGender = (typeof PLAYER_GENDERS)[number];

export const PLAYER_MODELS = [
  "knight",
  "elf",
  "wizzard",
  "lizard",
  "dwarf",
] as const;
export type PlayerModel = (typeof PLAYER_MODELS)[number];

export const PLAYER_SKINS = [
  "knight_f",
  "knight_m",
  "elf_f",
  "elf_m",
  "wizzard_f",
  "wizzard_m",
  "lizard_f",
  "lizard_m",
  "dwarf_f",
  "dwarf_m",
] as const;
export type PlayerSkin = (typeof PLAYER_SKINS)[number];

export const DEFAULT_PLAYER_GENDER: PlayerGender = "female";
export const DEFAULT_PLAYER_MODEL: PlayerModel = "knight";
export const DEFAULT_PLAYER_SKIN: PlayerSkin = "knight_f";

export function playerSkin(
  model: PlayerModel,
  gender: PlayerGender,
): PlayerSkin {
  return `${model}_${gender === "female" ? "f" : "m"}` as PlayerSkin;
}

export function isPlayerSkin(value: unknown): value is PlayerSkin {
  return typeof value === "string" &&
    (PLAYER_SKINS as readonly string[]).includes(value);
}
