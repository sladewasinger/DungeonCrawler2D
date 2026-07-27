import {
  AreaSystem,
  EffectsEngine,
  Rng,
  type ContentRegistry,
  type World,
} from "@dc2d/engine";
import { PlayerStore } from "../../store.js";
import { seedPets } from "../pets/index.js";
import { createEntityCollections, createReplicationCollections } from "../stateCollections.js";
import type { SimState } from "../state.js";

/** Builds the mutable floor state. Kept separate from state.ts's contract so
 * adding a new feature collection does not turn the contract into a god file. */
export function createSimState(
  world: World,
  content: ContentRegistry,
  store: PlayerStore,
  rngSeed: number,
  opts: SimState["opts"],
): SimState {
  const state: SimState = {
    world, content, store, opts,
    rng: new Rng(rngSeed),
    effects: new EffectsEngine(content, (x, y) => world.isSanctuary(x, y)),
    areas: new AreaSystem(content, world),
    ...createEntityCollections(),
    ...createReplicationCollections(),
    moderationReports: [],
    fistbumpOffers: new Map(),
    reviveAttempts: new Map(),
    activatedChunks: new Set(),
    defeatedMiniBossRooms: new Set(),
    exposure: new Map(),
    worldEvents: [],
    tickCount: 0,
    nextPartyId: 1,
    nextPartyRoom: 0,
    hazardsActive: false,
    outgoingTransfers: [],
    bossGateSealed: false,
    bossArenaOccupants: new Set(),
    bossRespawnAtTick: null,
    crossFloorDirectory: [],
    pendingGlobalChat: [],
  };
  seedPets(state);
  return state;
}
