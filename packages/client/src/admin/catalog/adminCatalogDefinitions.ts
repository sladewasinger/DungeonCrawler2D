import { enemiesData, itemsData } from "@dc2d/content";
import { resolveWeaponProfile, type AttackProfileInput } from "@dc2d/engine";
import type { AdminSpawnKind } from "../adminPageSupport.js";
import {
  enemyCatalogImage,
  itemCatalogImage,
  type AdminCatalogImage,
} from "./adminCatalogImages.js";

export type { AdminCatalogImage } from "./adminCatalogImages.js";

export interface AdminCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly stats: readonly string[];
  readonly image: AdminCatalogImage | null;
}

interface EnemyDefinition {
  readonly id: string;
  readonly name: string;
  readonly hp: number;
  readonly speed: number;
  readonly attack: {
    readonly damage: number;
    readonly range: number;
  };
  readonly sprite?: string;
}

interface ItemDefinition {
  readonly id: string;
  readonly name: string;
  readonly maxStack: number;
  readonly tags: readonly string[];
  readonly weapon?: AttackProfileInput;
}

const ENEMY_DEFINITIONS = enemiesData.filter(isEnemyDefinition);
const ITEM_DEFINITIONS = itemsData.filter(isItemDefinition);

export function adminCatalogEntries(kind: AdminSpawnKind): readonly AdminCatalogEntry[] {
  return entriesForKind(kind).sort(compareEntries);
}

export function adminCatalogImage(
  kind: AdminSpawnKind,
  definitionId: string | undefined,
): AdminCatalogImage | null {
  if (!definitionId) return null;
  if (kind === "enemy") return enemyCatalogImage(enemyById(definitionId)?.sprite);
  return itemCatalogImage(definitionId);
}

function entriesForKind(kind: AdminSpawnKind): AdminCatalogEntry[] {
  if (kind === "enemy") return ENEMY_DEFINITIONS.map(enemyEntry);
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

function isEnemyDefinition(value: unknown): value is EnemyDefinition {
  const definition = value as Partial<EnemyDefinition>;
  return typeof definition.id === "string" &&
    typeof definition.name === "string" &&
    typeof definition.hp === "number" &&
    typeof definition.speed === "number" &&
    typeof definition.attack?.damage === "number" &&
    typeof definition.attack.range === "number";
}

function isItemDefinition(value: unknown): value is ItemDefinition {
  const definition = value as Partial<ItemDefinition>;
  return typeof definition.id === "string" &&
    typeof definition.name === "string" &&
    typeof definition.maxStack === "number" &&
    Array.isArray(definition.tags) &&
    isAttackProfile(definition.weapon);
}

function isAttackProfile(value: unknown): value is AttackProfileInput | undefined {
  return value === undefined || (typeof value === "object" && value !== null);
}

function upperCase(value: string): string {
  return value.toUpperCase();
}

function compareEntries(left: AdminCatalogEntry, right: AdminCatalogEntry): number {
  return left.name.localeCompare(right.name);
}
