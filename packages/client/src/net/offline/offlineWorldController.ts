/** Stateful offline preview coordinator handling saves, placement/dismantle, chests, beds, and buff steps. */
import { maxStackForItem } from "@dc2d/content";
import {
  PropKind, WorldChunkCache, insertIntoSlots, SANCTUARY_CENTER,
  type InventorySnapshot, type PlayerSnapshot, type WorldChestSnapshot, type WorldEvent,
} from "@dc2d/engine";
import { createStarterInventorySnapshot } from "../clientInventory.js";
import { OfflineWorldSaver, clearOfflineWorldState, loadOfflineWorldState } from "../offlinePersistence.js";
import {
  applyOfflineConsumableUse, bindOfflineBed, buildOfflineWorldSnapshot, createOfflineRuntime,
  dismantleOfflineStructure, hydrateOfflineWorld, isNearOfflinePropKind, placeOfflineStructure,
  resetOfflineDefaults, stepOfflineSurvival, type OfflineRuntimeState,
} from "./offlineWorldSim.js";

export interface OfflineStateSlice {
  cache: WorldChunkCache;
  dayPhase: number;
  player: PlayerSnapshot;
  inventory: InventorySnapshot;
  chests: readonly WorldChestSnapshot[];
  events: WorldEvent[];
}

export class OfflineWorldController {
  private readonly saver = new OfflineWorldSaver();
  private runtime: OfflineRuntimeState = createOfflineRuntime();

  loadSaved(slice: OfflineStateSlice): { readonly player: PlayerSnapshot; readonly chests: readonly WorldChestSnapshot[]; readonly inventory: InventorySnapshot; readonly dayPhase: number } | null {
    const saved = loadOfflineWorldState(slice.cache.worldSeed);
    if (!saved) return null;
    const h = hydrateOfflineWorld({ saved, cache: slice.cache, runtime: this.runtime, player: slice.player });
    return { ...h, dayPhase: saved.dayPhase };
  }

  flushNow(slice: OfflineStateSlice): void {
    this.saver.flushNow(() => buildOfflineWorldSnapshot({
      cache: slice.cache, dayPhase: slice.dayPhase, runtime: this.runtime,
      chests: slice.chests, player: slice.player, inventory: slice.inventory,
    }));
  }

  step(slice: OfflineStateSlice, dt: number): { readonly player: PlayerSnapshot; readonly inventory: InventorySnapshot } {
    const player = stepOfflineSurvival(slice.cache, slice.player, dt);
    const nearCampfire = isNearOfflinePropKind(slice.cache, player, PropKind.Campfire);
    const nearWorkbench = isNearOfflinePropKind(slice.cache, player, PropKind.Workbench);
    const inventory = nearCampfire !== slice.inventory.nearCampfire || nearWorkbench !== slice.inventory.nearWorkbench
      ? { ...slice.inventory, nearCampfire, nearWorkbench }
      : slice.inventory;
    this.saver.markDirty();
    this.saver.maybeFlush(Date.now(), () => buildOfflineWorldSnapshot({
      cache: slice.cache, dayPhase: slice.dayPhase, runtime: this.runtime,
      chests: slice.chests, player, inventory,
    }));
    return { player, inventory };
  }

  place(slice: OfflineStateSlice, req: { readonly itemId: string; readonly x: number; readonly y: number; readonly rotation?: number | undefined }) {
    const res = placeOfflineStructure({ req, cache: slice.cache, runtime: this.runtime, player: slice.player, inventory: slice.inventory, chests: slice.chests, events: slice.events });
    if (!res.ok) return null;
    const placed = this.runtime.structures.at(-1);
    if (placed?.kind === "bed") {
      const bound = bindOfflineBed({ cache: slice.cache, runtime: this.runtime, player: res.player, structureId: placed.id, events: slice.events });
      const player = bound.ok ? bound.player : res.player;
      this.flushNow({ ...slice, player, inventory: res.inventory, chests: res.chests });
      return { ...res, player };
    }
    this.flushNow({ ...slice, player: res.player, inventory: res.inventory, chests: res.chests });
    return res;
  }

  dismantle(slice: OfflineStateSlice, structureId: string) {
    const res = dismantleOfflineStructure({ structureId, cache: slice.cache, runtime: this.runtime, player: slice.player, inventory: slice.inventory, chests: slice.chests, events: slice.events });
    if (res.ok) this.flushNow({ ...slice, player: res.player, inventory: res.inventory, chests: res.chests });
    return res;
  }

  bindBed(slice: OfflineStateSlice, structureId: string): PlayerSnapshot | null {
    const res = bindOfflineBed({ cache: slice.cache, runtime: this.runtime, player: slice.player, structureId, events: slice.events });
    if (!res.ok) return null;
    this.flushNow({ ...slice, player: res.player });
    return res.player;
  }

  useConsumable(slice: OfflineStateSlice, itemId: string | undefined): PlayerSnapshot {
    const player = applyOfflineConsumableUse(slice.player, itemId);
    this.flushNow({ ...slice, player });
    return player;
  }

  giveItem(slice: OfflineStateSlice, itemId: string, count: number): InventorySnapshot {
    const slots = slice.inventory.slots.map((s) => (s ? { ...s } : null));
    insertIntoSlots(slots, { itemId, count: Math.max(1, Math.min(99, Math.round(count))) }, maxStackForItem);
    const inventory = { ...slice.inventory, slots };
    this.flushNow({ ...slice, inventory });
    return inventory;
  }

  respawn(player: PlayerSnapshot): PlayerSnapshot {
    const bed = player.respawnBedPos;
    return { ...player, x: bed?.x ?? SANCTUARY_CENTER.x, y: bed?.y ?? SANCTUARY_CENTER.y, elevation: 0, hp: player.maxHp ?? 100, stamina: player.maxStamina ?? 100 };
  }

  reset(seed: number, currentPlayer: PlayerSnapshot): { readonly cache: WorldChunkCache; readonly player: PlayerSnapshot; readonly inventory: InventorySnapshot } {
    clearOfflineWorldState(seed);
    this.runtime = createOfflineRuntime();
    const fresh = resetOfflineDefaults(currentPlayer);
    return { cache: new WorldChunkCache(seed), player: fresh.player, inventory: { ...createStarterInventorySnapshot(), ...fresh.inventory } };
  }
}
