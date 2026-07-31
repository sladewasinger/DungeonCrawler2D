import { enemiesData, itemsData } from "@dc2d/content";
import {
  PET_DEFINITIONS,
  resolveWeaponProfile,
  type PetDefinition,
} from "@dc2d/engine";
import type { AdminSpawnKind } from "../adminPageSupport.js";
import {
  enemyCatalogImage,
  itemCatalogImage,
  petCatalogImage,
  type AdminCatalogVisual,
} from "./adminCatalogImages.js";
import {
  isEnemyDefinition,
  isItemDefinition,
  type EnemyDefinition,
  type ItemDefinition,
} from "./adminCatalogContentTypes.js";

export type {
  AdminCatalogImage,
  AdminCatalogVisual,
} from "./adminCatalogImages.js";

export interface AdminCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly stats: readonly string[];
  readonly image: AdminCatalogVisual | null;
}

const ENEMY_DEFINITIONS = enemiesData.filter(isEnemyDefinition);
const ITEM_DEFINITIONS = itemsData.filter(isItemDefinition);

export function adminCatalogEntries(kind: AdminSpawnKind): readonly AdminCatalogEntry[] {
  return entriesForKind(kind).sort(compareEntries);
}

export function adminCatalogImage(
  kind: AdminSpawnKind,
  definitionId: string | undefined,
): AdminCatalogVisual | null {
  if (!definitionId) return null;
  if (kind === "enemy") return enemyCatalogImage(enemyById(definitionId)?.sprite);
  if (kind === "pet") return petCatalogImage(definitionId);
  return itemCatalogImage(definitionId);
}

function entriesForKind(kind: AdminSpawnKind): AdminCatalogEntry[] {
  if (kind === "enemy") return ENEMY_DEFINITIONS.map(enemyEntry);
  if (kind === "pet") return PET_DEFINITIONS.map(petEntry);
  return itemDefinitionsFor(kind).map((definition) => itemEntry(kind, definition));
}

function itemDefinitionsFor(kind: AdminSpawnKind): readonly ItemDefinition[] {
  return ITEM_DEFINITIONS.filter((definition) => isWeapon(definition) === (kind === "weapon"));
}

function enemyEntry(definition: EnemyDefinition): AdminCatalogEntry {
  return {
    id: definition.id,
    name: definition.name,
    stats: [
      `${definition.hp} HP`,
      `${definition.speed} SPD`,
      `${definition.attack.damage} DMG`,
      `${definition.attack.range} RNG`,
      `${hurtboxDimension(definition.hurtbox.halfWidth)}×${hurtboxDimension(definition.hurtbox.halfDepth)}×${hurtboxHeight(definition.hurtbox.height)} HURTBOX`,
    ],
    image: enemyCatalogImage(definition.sprite),
  };
}

function itemEntry(kind: AdminSpawnKind, definition: ItemDefinition): AdminCatalogEntry {
  return {
    id: definition.id,
    name: definition.name,
    stats: kind === "weapon" ? weaponStats(definition) : itemStats(definition),
    image: itemCatalogImage(definition.id),
  };
}

function petEntry(definition: PetDefinition): AdminCatalogEntry {
  return {
    id: definition.id,
    name: definition.name,
    stats: [`${definition.species.toUpperCase()} PET`, `${definition.speed} SPD`],
    image: petCatalogImage(definition.id),
  };
}

function weaponStats(definition: ItemDefinition): readonly string[] {
  const weapon = resolveWeaponProfile(definition);
  return [
    `${weapon.damage} DMG`,
    `${weapon.range} RNG`,
    `${weapon.knockbackForce} KB`,
    `${weapon.cooldownMs} MS`,
  ];
}

function itemStats(definition: ItemDefinition): readonly string[] {
  return [`STACK ${definition.maxStack}`, ...definition.tags.slice(0, 2).map(upperCase)];
}

function enemyById(id: string): EnemyDefinition | undefined {
  return ENEMY_DEFINITIONS.find((definition) => definition.id === id);
}

function isWeapon(definition: ItemDefinition): boolean {
  return definition.weapon !== undefined;
}

function hurtboxDimension(halfExtent: number): string {
  return Number((halfExtent * 2).toFixed(2)).toString();
}

function hurtboxHeight(height: number): string {
  return Number(height.toFixed(2)).toString();
}

function upperCase(value: string): string {
  return value.toUpperCase();
}

function compareEntries(left: AdminCatalogEntry, right: AdminCatalogEntry): number {
  return left.name.localeCompare(right.name);
}
