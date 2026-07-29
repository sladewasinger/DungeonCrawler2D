import { TICK_DT, type EffectEvent } from "@dc2d/engine";
import { processActions } from "../actions/index.js";
import { applyHealthRegeneration } from "../progression/combatResources.js";
import { expireFistbumpOffers } from "../combat/contacts.js";
import { resolveDeaths } from "../combat/deaths.js";
import {
  activateChunksNearPlayers,
  REPOPULATE_INTERVAL_TICKS,
  repopulateNearSpawn,
  stepEnemies,
} from "../enemies/index.js";
import { drainReadyTransfers, stepBoss } from "../floors/index.js";
import { expireLootChests } from "../lootChests/lootChests.js";
import { stepFoodAttendantDialogs } from "../npcs/foodAttendant/index.js";
import { stepPets } from "../pets/index.js";
import { applyGodMode, reapAndRespawn, stepPlayers } from "../players/players.js";
import { stepProjectiles } from "../projectiles/index.js";
import { syncWorldFeatureOverrides } from "./worldFeatureOverrides.js";
import { expireInvites } from "../social/social.js";
import { maintainSpawnClearance } from "../spawnSafety/spawnSafety.js";
import { applyAreaContact, realizeEffectEvents, tickStatuses } from "../progression/statuses.js";
import { TEST_ZONE_RESEED_TICKS, seedTestZoneHazards, seedTestZoneItems } from "./testzone.js";
import { stepTorches } from "../combat/torches.js";
import { stepSpawnRoomAnnouncements } from "../announcer/spawnRoom/announcements.js";
import { stepMiniBossArenaBoundaries } from "../enemies/miniBossArena/boundary.js";
import type { SimState } from "../state/state.js";

export function advanceSimTick(sim: SimState): void {
  sim.tickCount++;
  const effectEvents: EffectEvent[] = [];
  prepareSimTick(sim, effectEvents);
  stepSimActors(sim, effectEvents);
  resolveSimTick(sim, effectEvents);
}

function prepareSimTick(sim: SimState, effectEvents: EffectEvent[]): void {
  reapAndRespawn(sim);
  syncWorldFeatureOverrides(sim);
  stepPlayers(sim, effectEvents);
  processActions(sim, effectEvents);
  stepMiniBossArenaBoundaries(sim);
  stepFoodAttendantDialogs(sim);
  stepSpawnRoomAnnouncements(sim);
  stepPets(sim);
  activateChunksNearPlayers(sim);
  repopulateEnemies(sim);
}

function repopulateEnemies(sim: SimState): void {
  if (sim.tickCount % REPOPULATE_INTERVAL_TICKS === 0) repopulateNearSpawn(sim);
  if (!sim.hazardsActive || sim.tickCount % TEST_ZONE_RESEED_TICKS !== 0) return;
  const claimed = new Set<string>();
  seedTestZoneHazards(sim, claimed);
  seedTestZoneItems(sim, claimed);
}

function stepSimActors(sim: SimState, effectEvents: EffectEvent[]): void {
  maintainSpawnClearance(sim);
  if (!sim.opts.freezeEnemies) {
    stepEnemies(sim, effectEvents);
    stepProjectiles(sim, effectEvents);
  }
  stepTorches(sim, effectEvents);
  sim.areas.tick(TICK_DT, () => sim.rng.next());
}

function resolveSimTick(sim: SimState, effectEvents: EffectEvent[]): void {
  applyAreaContact(sim, effectEvents);
  tickStatuses(sim, effectEvents);
  applyHealthRegeneration(sim, effectEvents);
  realizeEffectEvents(sim, effectEvents);
  applyGodMode(sim);
  resolveDeaths(sim);
  expireLootChests(sim);
  stepBoss(sim);
  expireInvites(sim);
  expireFistbumpOffers(sim);
  drainReadyTransfers(sim);
}
