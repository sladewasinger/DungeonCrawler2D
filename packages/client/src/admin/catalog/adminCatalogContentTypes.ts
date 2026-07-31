import type { AttackProfileInput } from "@dc2d/engine";

export interface EnemyDefinition {
  readonly id: string;
  readonly name: string;
  readonly hp: number;
  readonly speed: number;
  readonly hurtbox: {
    readonly halfWidth: number;
    readonly halfDepth: number;
  };
  readonly attack: {
    readonly damage: number;
    readonly range: number;
  };
  readonly sprite?: string;
}

export interface ItemDefinition {
  readonly id: string;
  readonly name: string;
  readonly maxStack: number;
  readonly tags: readonly string[];
  readonly weapon?: AttackProfileInput;
}

export function isEnemyDefinition(value: unknown): value is EnemyDefinition {
  const definition = value as Partial<EnemyDefinition>;
  return typeof definition.id === "string" &&
    typeof definition.name === "string" &&
    typeof definition.hp === "number" &&
    typeof definition.speed === "number" &&
    hasEnemyHurtbox(definition.hurtbox) &&
    hasEnemyAttack(definition.attack);
}

function hasEnemyHurtbox(value: unknown): value is EnemyDefinition["hurtbox"] {
  const hurtbox = value as Partial<EnemyDefinition["hurtbox"]>;
  return typeof hurtbox?.halfWidth === "number" &&
    typeof hurtbox.halfDepth === "number";
}

function hasEnemyAttack(value: unknown): value is EnemyDefinition["attack"] {
  const attack = value as Partial<EnemyDefinition["attack"]>;
  return typeof attack?.damage === "number" &&
    typeof attack.range === "number";
}

export function isItemDefinition(value: unknown): value is ItemDefinition {
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
