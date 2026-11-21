const CHORT = "chort";
const PITCHBLOOM = "pitchbloom";
const BIG_ZOMBIE = "big-zombie";
const FALLEN_ANGEL = "fallen-angel";
const GOBLIN = "goblin";
const MASKED_ORC = "masked-orc";
const ORC_SHAMAN = "orc-shaman";
const ORC_WARRIOR = "orc-warrior";
const PLANT_CREEPER = "plant-creeper";
const PUMPKIN_FIEND = "pumpkin-fiend";
const SKELETON = "skeleton";
const SLIME = "slime";
const SPITTER = "spitter";
const TINY_ZOMBIE = "tiny-zombie";
const WOGOL = "wogol";

/** The shared encounter is deliberate, even when the territory has another native roster. */
export const CHORT_PITCHBLOOM_PAIR = [CHORT, PITCHBLOOM] as const;

/**
 * Ownership tags are authored territory contracts, not hints for biome fallback.
 * Every tag in the finite territory catalog is declared here.
 */
export const TERRITORY_FACTION_POLICIES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  goblin: [GOBLIN, MASKED_ORC, ORC_WARRIOR, ORC_SHAMAN],
  sapper: [GOBLIN, ORC_SHAMAN, PITCHBLOOM],
  spider: [SPITTER, PITCHBLOOM, SLIME],
  brood: [SPITTER, PITCHBLOOM, PLANT_CREEPER],
  undead: [SKELETON, TINY_ZOMBIE, BIG_ZOMBIE],
  "bone-cult": [SKELETON, TINY_ZOMBIE, FALLEN_ANGEL],
  jailer: [SKELETON, MASKED_ORC, ORC_WARRIOR],
  guard: [SKELETON, MASKED_ORC, ORC_WARRIOR],
  myconid: [PLANT_CREEPER, PITCHBLOOM, SLIME],
  spore: [PLANT_CREEPER, PITCHBLOOM, SLIME],
  kobold: [GOBLIN, MASKED_ORC, PLANT_CREEPER],
  trapper: [GOBLIN, SPITTER, PLANT_CREEPER],
  cultist: [CHORT, ORC_SHAMAN, FALLEN_ANGEL],
  astral: [CHORT, ORC_SHAMAN, FALLEN_ANGEL],
  ratkin: [GOBLIN, SLIME, SPITTER],
  skinner: [GOBLIN, SLIME, SPITTER],
  "ash-dwarf": [ORC_SHAMAN, MASKED_ORC, ORC_WARRIOR],
  construct: [ORC_SHAMAN, MASKED_ORC, ORC_WARRIOR],
  wraith: [FALLEN_ANGEL, CHORT, SKELETON],
  haunt: [FALLEN_ANGEL, CHORT, SKELETON],
  mimic: [SLIME, MASKED_ORC, SKELETON],
  "treasure-guard": [MASKED_ORC, SKELETON, ORC_WARRIOR],
  clockwork: [ORC_SHAMAN, MASKED_ORC, GOBLIN],
  "thorn-fey": [PLANT_CREEPER, WOGOL, PUMPKIN_FIEND],
  beast: [PLANT_CREEPER, WOGOL, PUMPKIN_FIEND],
  carrion: [FALLEN_ANGEL, SPITTER, WOGOL],
  harpy: [FALLEN_ANGEL, SPITTER, WOGOL],
  alchemist: [SLIME, PLANT_CREEPER, PITCHBLOOM],
  ooze: [SLIME, PLANT_CREEPER, PITCHBLOOM],
  orc: [ORC_WARRIOR, MASKED_ORC, ORC_SHAMAN],
  warband: [ORC_WARRIOR, MASKED_ORC, ORC_SHAMAN],
  inquisitor: [FALLEN_ANGEL, SKELETON, ORC_SHAMAN],
  zealot: [FALLEN_ANGEL, SKELETON, ORC_SHAMAN],
  "candle-monk": [FALLEN_ANGEL, SKELETON, PUMPKIN_FIEND],
  scribe: [FALLEN_ANGEL, SKELETON, PUMPKIN_FIEND],
  "crystal-construct": [ORC_SHAMAN, MASKED_ORC, PITCHBLOOM],
  "guild-guard": [ORC_WARRIOR, MASKED_ORC, ORC_SHAMAN],
  "grave-mason": [SKELETON, TINY_ZOMBIE, BIG_ZOMBIE],
});

export function factionRosterForOwnershipTags(
  ownershipTags: readonly string[],
): readonly string[] {
  if (ownershipTags.length === 0) {
    throw new Error("Finite territory is missing ownership tags");
  }
  const rosters = ownershipTags.map((tag) => {
    const roster = TERRITORY_FACTION_POLICIES[tag];
    if (!roster) throw new Error(`No faction policy for territory tag: ${tag}`);
    return roster;
  });
  return [...new Set(rosters.flat())];
}
