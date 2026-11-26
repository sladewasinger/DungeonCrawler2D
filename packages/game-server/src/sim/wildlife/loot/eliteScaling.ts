/** DangerTier stat scaling, biome wildlife rosters, elite titles, and seeded drop spawning. */
import { BIOME_CATALOG, rollEnemyDrop } from "@dc2d/content";
import { computeDangerTier, hashUnit2d, sampleMacroBiome, type BiomeKind, type DangerTier, type WorldChunkCache } from "@dc2d/engine";
import type { WildlifeEntity, WildlifeKind } from "../creatureSpecs.js";
import type { LootManager } from "../lootManager.js";

const TIER_SCALE: Readonly<Record<DangerTier, { readonly hp: number; readonly dmg: number }>> = {
  1: { hp: 1.0, dmg: 1.0 },
  2: { hp: 1.25, dmg: 1.15 },
  3: { hp: 1.55, dmg: 1.3 },
  4: { hp: 1.9, dmg: 1.5 },
};

const ELITE_TITLES: Readonly<Record<WildlifeKind, string>> = {
  spider: "Broodmother",
  orc: "Orc Warchief",
  golem: "Runic Golem",
  skeleton: "Cursed Warden",
  wolf: "Alpha Wolf",
  bear: "Dire Bear",
  boar: "Elder Boar",
  goblin: "Goblin Boss",
  slime: "King Slime",
};

export function dangerTierStatScale(tier: DangerTier, isElite: boolean): { readonly hpMult: number; readonly dmgMult: number } {
  const base = TIER_SCALE[tier];
  return isElite ? { hpMult: base.hp * 2.6, dmgMult: base.dmg * 1.45 } : { hpMult: base.hp, dmgMult: base.dmg };
}

export function defaultEliteTitle(kind: WildlifeKind): string {
  return ELITE_TITLES[kind];
}

export function pickBiomeWildlifeKind(biome: BiomeKind, roll: number): WildlifeKind {
  const roster = BIOME_CATALOG[biome].wildlifeRoster;
  return roster[Math.floor(roll * roster.length) % roster.length] ?? "wolf";
}

export function shouldSpawnWanderingElite(tier: DangerTier, roll: number): boolean {
  return tier >= 3 && roll < 0.08;
}

export function buildChunkWildlifeSpawns(opts: {
  readonly cache: WorldChunkCache;
  readonly cx: number;
  readonly cy: number;
  readonly resolveKind: (raw: WildlifeKind, wx: number, wy: number) => WildlifeKind;
}): readonly {
  readonly kind: WildlifeKind; readonly x: number; readonly y: number; readonly homeRadius: number;
  readonly poiId: null; readonly packId: string | null; readonly packSlot: number;
  readonly dangerTier: DangerTier; readonly isElite: boolean; readonly title?: string | undefined;
}[] {
  const { cache, cx, cy, resolveKind } = opts;
  const baseSeed = cache.worldSeed + cx * 73 + cy * 179;
  const wx = cx * 32 + 10 + hashUnit2d(baseSeed + 7, cx, cy) * 14;
  const wy = cy * 32 + 10 + hashUnit2d(baseSeed + 19, cx, cy) * 14;
  const biome = sampleMacroBiome(cache.worldSeed, wx, wy);
  const dangerTier = computeDangerTier(biome, wx, wy);
  const chosen = resolveKind(pickBiomeWildlifeKind(biome, hashUnit2d(baseSeed, cx, cy)), wx, wy);
  const isElite = shouldSpawnWanderingElite(dangerTier, hashUnit2d(baseSeed + 41, cx, cy));
  const count = !isElite && chosen === "wolf" ? 3 : 1;
  const packId = count > 1 ? `pack:${cx},${cy}` : null;
  return Array.from({ length: count }, (_, i) => ({
    kind: chosen, x: wx + i * 0.85, y: wy + (i % 2) * 0.7, homeRadius: 11, poiId: null, packId, packSlot: i,
    dangerTier, isElite: isElite && i === 0, ...(isElite && i === 0 ? { title: defaultEliteTitle(chosen) } : {}),
  }));
}

export function spawnScaledEnemyDrops(opts: {
  readonly e: WildlifeEntity;
  readonly cache: WorldChunkCache;
  readonly loot: LootManager;
}): void {
  const { e, cache, loot } = opts;
  const biome = sampleMacroBiome(cache.worldSeed, e.x, e.y);
  const tier = computeDangerTier(biome, e.x, e.y);
  const seed = (cache.worldSeed ^ Math.imul(Math.round(e.x * 10), 73856093) ^ Math.imul(Math.round(e.y * 10), 19349663)) >>> 0;
  const drops = rollEnemyDrop({ seed, kind: e.kind, biome, dangerTier: Math.max(e.dangerTier, tier) as DangerTier, isElite: e.isElite });
  drops.forEach((drop, idx) => {
    const ang = idx * 2.1 + Math.random();
    loot.spawnLoot({
      itemId: drop.itemId, count: drop.count, ...(drop.prefixId ? { prefixId: drop.prefixId } : {}),
      x: e.x, y: e.y, vx: Math.cos(ang) * 1.8, vy: Math.sin(ang) * 1.8,
    });
  });
}
