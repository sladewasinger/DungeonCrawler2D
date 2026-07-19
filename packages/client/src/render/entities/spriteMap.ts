// Sprite-key resolution: which atlas animation prefix an entity's body sprite plays —
// hashed hero skins for players (palette-distinct disambiguation), content-driven
// remap for monsters (never a second hardcoded copy of enemies.json's sprite field).
import { enemiesData } from "@dc2d/content";

const PLAYER_SKINS = ["knight_m", "elf_f", "wizzard_m", "lizard_f"] as const;
export type PlayerSkin = (typeof PLAYER_SKINS)[number];

const FALLBACK_MONSTER_SPRITE = "skelet";

/** Deterministic small string hash (FNV-1a) so the same playerId always resolves the same skin. */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Picks one of 4 palette-distinct hero classes for a player id — stable across the session. */
export function playerSkinFor(playerId: string): PlayerSkin {
  return PLAYER_SKINS[hashString(playerId) % PLAYER_SKINS.length] ?? PLAYER_SKINS[0];
}

interface EnemyDef {
  readonly id: string;
  readonly sprite: string;
}

function isEnemyDef(value: unknown): value is EnemyDef {
  const record = value as Partial<EnemyDef>;
  return typeof record?.id === "string" && typeof record?.sprite === "string";
}

const enemySpriteById = new Map<string, string>(
  (enemiesData as readonly unknown[]).filter(isEnemyDef).map((def) => [def.id, def.sprite]),
);

/** The atlas animation prefix for an enemy defId, read from content's `sprite` field (the v2 atlas name). */
export function monsterSpriteFor(defId: string | undefined): string {
  if (!defId) return FALLBACK_MONSTER_SPRITE;
  return enemySpriteById.get(defId) ?? FALLBACK_MONSTER_SPRITE;
}
