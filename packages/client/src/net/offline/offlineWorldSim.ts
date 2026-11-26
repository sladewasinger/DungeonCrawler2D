/** Pure offline world parity helpers for crafting proximity, structure placement/dismantle, beds, and buffs. */
import { RECIPE_CATALOG, getItemDef, maxStackForItem } from "@dc2d/content";
import {
  PALISADE_MAX_HP, PropKind, SURVIVAL_BUFF_TUNING, WorldChunkCache,
  applyWellFedDuration, canPlaceStructure, computeSurvivalRegen, consumeItemFromSlots, insertIntoSlots,
  type InventorySnapshot, type PlacedStructureRecord, type PlayerSnapshot, type WorldChestSnapshot, type WorldEvent,
} from "@dc2d/engine";
import { createStarterInventorySnapshot } from "../clientInventory.js";
import type { ClientHubState } from "../hubClientBridge.js";
import type { OfflineWorldSnapshot } from "../offlinePersistence.js";
import { hydrateOfflineHubState, serializeOfflineHubState } from "./offlineHubs.js";

const STATION_RADIUS_SQ = 2.8 * 2.8;

export function isNearOfflinePropKind(cache: WorldChunkCache, pos: { readonly x: number; readonly y: number; readonly elevation: number }, kind: PropKind): boolean {
  for (const prop of cache.propsNear(pos.x, pos.y)) {
    if (prop.kind !== kind || prop.elevation !== pos.elevation) continue;
    const dx = prop.x - pos.x;
    const dy = prop.y - pos.y;
    if (dx * dx + dy * dy <= STATION_RADIUS_SQ) return true;
  }
  return false;
}

export interface OfflineRuntimeState {
  structures: PlacedStructureRecord[];
  beds: { ownerKey: string; structureId: string; x: number; y: number; elevation: number }[];
  nextStructId: number;
}

export function createOfflineRuntime(): OfflineRuntimeState {
  return { structures: [], beds: [], nextStructId: 1 };
}

export function hydrateOfflineWorld(opts: {
  readonly saved: OfflineWorldSnapshot;
  readonly cache: WorldChunkCache;
  readonly runtime: OfflineRuntimeState;
  readonly player: PlayerSnapshot;
  readonly hub?: ClientHubState | undefined;
}): { readonly player: PlayerSnapshot; readonly chests: WorldChestSnapshot[]; readonly inventory: InventorySnapshot } {
  const { saved, cache, runtime } = opts;
  cache.applyWorldDeltaSnapshot({ depleted: saved.depleted, structures: saved.structures, litBraziers: [] });
  runtime.structures = [...saved.structures];
  runtime.beds = [...saved.beds];
  runtime.nextStructId = saved.structures.reduce((m, s) => Math.max(m, Number(s.id.replace("struct-", "")) || 0), 0) + 1;
  if (opts.hub) hydrateOfflineHubState(saved, opts.hub);
  const bed = saved.beds[0];
  const player: PlayerSnapshot = {
    ...opts.player, x: saved.player.x, y: saved.player.y, elevation: saved.player.elevation,
    wellFedTimer: saved.player.wellFedTimer, invigoratedTimer: saved.player.invigoratedTimer,
    restedTimer: saved.player.restedTimer, hotTimer: saved.player.hotTimer,
    hasBedRespawn: Boolean(bed), ...(bed ? { respawnBedPos: { x: bed.x, y: bed.y } } : {}),
  };
  return { player, chests: [...saved.chests], inventory: saved.player.inventory };
}

export function placeOfflineStructure(opts: {
  readonly req: { readonly itemId: string; readonly x: number; readonly y: number; readonly rotation?: number | undefined };
  readonly cache: WorldChunkCache; readonly runtime: OfflineRuntimeState; readonly player: PlayerSnapshot;
  readonly inventory: InventorySnapshot; readonly chests: readonly WorldChestSnapshot[]; readonly events: WorldEvent[];
}): { readonly ok: boolean; readonly inventory: InventorySnapshot; readonly chests: readonly WorldChestSnapshot[]; readonly player: PlayerSnapshot } {
  const { req, cache, runtime, player, inventory, chests, events } = opts;
  const kind = getItemDef(req.itemId)?.placeStructure;
  if (!kind || !canPlaceStructure({ cache, x: req.x, y: req.y, playerX: player.x, playerY: player.y, playerElev: player.elevation, kind })) {
    return { ok: false, inventory, chests, player };
  }
  const slots = inventory.slots.map((s) => (s ? { ...s } : null));
  if (!consumeItemFromSlots(slots, req.itemId, 1)) return { ok: false, inventory, chests, player };
  const rec: PlacedStructureRecord = {
    id: `struct-${runtime.nextStructId++}`, kind, itemId: req.itemId, x: req.x, y: req.y,
    elevation: player.elevation, ownerName: player.name.toLowerCase(),
    ...(req.rotation !== undefined ? { rotation: req.rotation } : {}),
    ...(kind === "palisade" ? { hp: PALISADE_MAX_HP } : {}),
  };
  runtime.structures.push(rec);
  cache.addPlacedStructure(rec);
  events.push({ kind: "placeStructure", x: rec.x, y: rec.y, actorId: player.id });
  const nextChests = kind === "wood-chest"
    ? [...chests, { id: rec.id, poiKind: "player-chest", x: rec.x, y: rec.y, elevation: rec.elevation, opened: false, slots: Array.from({ length: 27 }, () => null) }]
    : chests;
  return { ok: true, inventory: { ...inventory, slots }, chests: nextChests, player };
}

function refundOfflineIngredients(rec: PlacedStructureRecord, inventory: InventorySnapshot) {
  const slots = inventory.slots.map((s) => (s ? { ...s } : null));
  const recipe = RECIPE_CATALOG.find((r) => r.outputItemId === rec.itemId);
  const ingredients = recipe ? recipe.ingredients : [{ itemId: rec.itemId, count: 1 }];
  const divisor = recipe && recipe.outputCount > 1 ? recipe.outputCount : 1;
  for (const ing of ingredients) {
    insertIntoSlots(slots, { itemId: ing.itemId, count: Math.max(1, Math.floor(ing.count / divisor)) }, maxStackForItem);
  }
  return slots;
}

export function dismantleOfflineStructure(opts: {
  readonly structureId: string; readonly cache: WorldChunkCache; readonly runtime: OfflineRuntimeState;
  readonly player: PlayerSnapshot; readonly inventory: InventorySnapshot; readonly chests: readonly WorldChestSnapshot[];
  readonly events: WorldEvent[];
}): { readonly ok: boolean; readonly inventory: InventorySnapshot; readonly chests: readonly WorldChestSnapshot[]; readonly player: PlayerSnapshot } {
  const { structureId, cache, runtime, player, inventory, chests, events } = opts;
  const idx = runtime.structures.findIndex((s) => s.id === structureId);
  const rec = idx >= 0 ? runtime.structures[idx] : undefined;
  if (!rec || Math.hypot(rec.x - player.x, rec.y - player.y) > 2.4) return { ok: false, inventory, chests, player };
  const matchingChest = rec.kind === "wood-chest" ? chests.find((c) => c.id === rec.id) : undefined;
  if (matchingChest?.slots.some((s) => s !== null)) {
    events.push({ kind: "dismantleStructure", x: rec.x, y: rec.y, actorId: player.id, reason: "Empty chest before dismantling" });
    return { ok: false, inventory, chests, player };
  }
  runtime.structures.splice(idx, 1);
  runtime.beds = runtime.beds.filter((b) => b.structureId !== rec.id);
  cache.removePlacedStructure(rec.id);
  const slots = refundOfflineIngredients(rec, inventory);
  const hasBed = runtime.beds.length > 0;
  const nextPlayer = { ...player, hasBedRespawn: hasBed, ...(hasBed ? {} : { respawnBedPos: undefined }) };
  events.push({ kind: "dismantleStructure", x: rec.x, y: rec.y, actorId: player.id, targetId: rec.id });
  return { ok: true, inventory: { ...inventory, slots }, chests: chests.filter((c) => c.id !== rec.id), player: nextPlayer };
}

const extendTimer = (cur: number | undefined, minDur: number | undefined): number =>
  minDur ? Math.max(cur ?? 0, minDur) : (cur ?? 0);

function applyOfflineBuffTimers(player: PlayerSnapshot, def: NonNullable<ReturnType<typeof getItemDef>>) {
  const wellFedTimer = def.wellFedSec ? applyWellFedDuration(player.wellFedTimer ?? 0, def.wellFedSec) : (player.wellFedTimer ?? 0);
  return {
    wellFedTimer,
    invigoratedTimer: extendTimer(player.invigoratedTimer, def.invigoratedSec),
    hotTimer: extendTimer(player.hotTimer, def.hotDurationSec),
  };
}

export function applyOfflineConsumableUse(player: PlayerSnapshot, itemId: string | undefined): PlayerSnapshot {
  const def = itemId ? getItemDef(itemId) : undefined;
  if (!def) return player;
  const timers = applyOfflineBuffTimers(player, def);
  const maxHp = 100 + (timers.wellFedTimer > 0 ? SURVIVAL_BUFF_TUNING.wellFedMaxHpBonus : 0);
  const hp = Math.min(maxHp, (player.hp ?? 100) + (def.healHp ?? 0));
  return { ...player, hp, maxHp, ...timers };
}

function stepHearthWarmth(cache: WorldChunkCache, player: PlayerSnapshot, dt: number): { readonly restedTimer: number; readonly hearthWarmProgress: number } {
  const r = SURVIVAL_BUFF_TUNING.restedHearthRadiusTiles;
  const nearFire = Array.from(cache.propsNear(player.x, player.y)).some(
    (p) => p.kind === PropKind.Campfire && p.elevation === player.elevation && Math.hypot(p.x - player.x, p.y - player.y) <= r,
  );
  const chargeSec = SURVIVAL_BUFF_TUNING.restedChargeSec;
  let warmSec = (player.hearthWarmProgress ?? 0) * chargeSec;
  let restedTimer = Math.max(0, (player.restedTimer ?? 0) - dt);
  if (nearFire) {
    warmSec = Math.min(chargeSec, warmSec + dt);
    if (warmSec >= chargeSec) restedTimer = SURVIVAL_BUFF_TUNING.restedDurationSec;
  } else {
    warmSec = Math.max(0, warmSec - dt * 2);
  }
  return { restedTimer, hearthWarmProgress: warmSec / chargeSec };
}

export function stepOfflineSurvival(cache: WorldChunkCache, player: PlayerSnapshot, dt: number): PlayerSnapshot {
  const hearth = stepHearthWarmth(cache, player, dt);
  const fed = Math.max(0, (player.wellFedTimer ?? 0) - dt);
  const invig = Math.max(0, (player.invigoratedTimer ?? 0) - dt);
  const hot = Math.max(0, (player.hotTimer ?? 0) - dt);
  const regen = computeSurvivalRegen({ wellFedTimer: fed, restedTimer: hearth.restedTimer, invigoratedTimer: invig, hotTimer: hot, hitTimer: player.hitTimer ?? 0 });
  const maxHp = 100 + regen.maxHpBonus;
  const hp = Math.min(maxHp, (player.hp ?? 100) + regen.hpPerSec * dt);
  const stam = Math.min(player.maxStamina ?? 100, (player.stamina ?? 100) + regen.staminaBonusPerSec * dt);
  return { ...player, hp, maxHp, stamina: stam, wellFedTimer: fed, invigoratedTimer: invig, hotTimer: hot, ...hearth };
}

export function buildOfflineWorldSnapshot(opts: {
  readonly cache: WorldChunkCache; readonly dayPhase: number; readonly runtime: OfflineRuntimeState;
  readonly chests: readonly WorldChestSnapshot[]; readonly player: PlayerSnapshot; readonly inventory: InventorySnapshot;
  readonly hub?: ClientHubState | undefined;
}): OfflineWorldSnapshot {
  const deltas = opts.cache.worldDeltaSnapshot();
  return {
    version: 1, worldSeed: opts.cache.worldSeed, dayPhase: opts.dayPhase,
    depleted: [...deltas.depleted], structures: [...opts.runtime.structures],
    beds: [...opts.runtime.beds], chests: [...opts.chests],
    player: {
      x: opts.player.x, y: opts.player.y, elevation: opts.player.elevation, inventory: opts.inventory,
      wellFedTimer: opts.player.wellFedTimer ?? 0, invigoratedTimer: opts.player.invigoratedTimer ?? 0,
      restedTimer: opts.player.restedTimer ?? 0, hotTimer: opts.player.hotTimer ?? 0,
    },
    ...(opts.hub ? serializeOfflineHubState(opts.hub) : {}),
  };
}

export function bindOfflineBed(opts: {
  readonly cache: WorldChunkCache; readonly runtime: OfflineRuntimeState;
  readonly player: PlayerSnapshot; readonly structureId: string; readonly events: WorldEvent[];
}): { readonly ok: boolean; readonly player: PlayerSnapshot } {
  const bed = opts.runtime.structures.find((s) => s.id === opts.structureId && s.kind === "bed");
  if (!bed || Math.hypot(bed.x - opts.player.x, bed.y - opts.player.y) > 2.6) return { ok: false, player: opts.player };
  const ownerKey = opts.player.name.toLowerCase();
  opts.runtime.beds = [{ ownerKey, structureId: bed.id, x: bed.x, y: bed.y, elevation: bed.elevation }];
  const hp = Math.min(opts.player.maxHp ?? 100, (opts.player.hp ?? 100) + 15);
  opts.events.push({ kind: "bedSet", x: bed.x, y: bed.y, actorId: opts.player.id });
  return { ok: true, player: { ...opts.player, hp, hasBedRespawn: true, respawnBedPos: { x: bed.x, y: bed.y } } };
}

export function resetOfflineDefaults(player: PlayerSnapshot): {
  readonly inventory: InventorySnapshot; readonly player: PlayerSnapshot;
} {
  return {
    inventory: createStarterInventorySnapshot(),
    player: {
      ...player, x: 0.5, y: 0.5, elevation: 0, hp: 100, maxHp: 100, stamina: 100, maxStamina: 100,
      wellFedTimer: 0, invigoratedTimer: 0, restedTimer: 0, hotTimer: 0, hearthWarmProgress: 0, hasBedRespawn: false,
    },
  };
}
