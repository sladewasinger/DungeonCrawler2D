/** Authoritative world combat & ecology event wire schemas. */
import { z } from "zod";
import { ENTITY_KINDS } from "../combat/aiSensing.js";
import { GORE_STYLES, GORE_SUBSTANCES } from "../combat/combatRules.js";
import { WEAPON_ARCHETYPES } from "../combat/weapons/weaponMovesets.js";

export const GoreSubstanceSchema = z.enum(GORE_SUBSTANCES);
export const GoreStyleSchema = z.enum(GORE_STYLES);

const WORLD_EVENT_KINDS = [
  "swing", "hit", "block", "parry", "guardBreak", "riposte", "heavyCharge", "slamImpact", "burnTick", "burnExtinguish",
  "poisonTick", "webSpit", "webCut", "cocoonWrap", "cocoonBreak",
  "arrowFire", "arrowEmbed", "arrowRicochet", "dodge", "heal", "respawn", "telegraph", "chestOpen", "loot",
  "creatureVocal", "playerLeave", "distract", "backstab", "ambushShot", "wolfHowl", "bearBluff", "boarCrash",
  "pebbleLand", "harvestHit", "harvestBreak", "placeStructure", "dismantleStructure", "bedSet",
  "poiDiscover", "shrineActivate", "waystoneAttune", "vaultUnlock", "loreRead", "hubNotice", "goldGain",
] as const;

export const WorldEventSchema = z.object({
  kind: z.enum(WORLD_EVENT_KINDS),
  x: z.number(),
  y: z.number(),
  dirX: z.number().optional(),
  dirY: z.number().optional(),
  value: z.number().optional(),
  hpRatio: z.number().min(0).max(1).optional(),
  reason: z.string().max(64).optional(),
  actorId: z.string().optional(),
  targetId: z.string().optional(),
  comboStep: z.number().int().optional(),
  weaponArchetype: z.enum(WEAPON_ARCHETYPES).optional(),
  sweepDir: z.number().optional(),
  goreStyle: GoreStyleSchema.optional(),
  substance: GoreSubstanceSchema.optional(),
  fatal: z.boolean().optional(),
  heavy: z.boolean().optional(),
  hitstopSec: z.number().optional(),
  shakePx: z.number().optional(),
  entityKind: z.enum(ENTITY_KINDS).optional(),
  vocalKind: z.enum(["alert", "attack", "charge", "hurt", "death"]).optional(),
  label: z.string().max(64).optional(),
  subtitle: z.string().max(140).optional(),
  poiCategory: z.string().max(24).optional(),
});

export type WorldEvent = z.infer<typeof WorldEventSchema>;
export type CreatureVocalKind = NonNullable<WorldEvent["vocalKind"]>;
