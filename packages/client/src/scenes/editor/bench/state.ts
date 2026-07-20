// Bench state (Epic 7.11): the one live client-only sim world SIMULATE ticks — an
// AreaSystem, an EffectsEngine, painted enemies, painted ground items, and the training
// dummy. Painting mutates this directly (no separate "seed" layer), which is what gives
// toggling SIMULATE off its pause-in-place semantics for free: nothing is torn down,
// ticking just stops.
import { AreaSystem, EffectsEngine, Rng, type ContentRegistry, type Entity, type EnemyBrain, type EnemyDef } from "@dc2d/engine";
import { EDITOR_GRID_SIZE, type EditableWorld } from "../EditableWorld.js";
import { benchContent } from "./content.js";
import { createDummy } from "./dummy.js";

/** Fixed so two fresh benches painted identically tick to byte-identical state — the
 * determinism the SIMULATE test fixture asserts on (Assumption #63). */
const BENCH_RNG_SEED = 1337;

export interface BenchEnemy {
  readonly entity: Entity;
  readonly def: EnemyDef;
  readonly brain: EnemyBrain;
}

export interface BenchItemSpawn {
  readonly id: string;
  readonly defId: string;
  readonly x: number;
  readonly y: number;
}

export interface BenchState {
  readonly content: ContentRegistry;
  readonly world: EditableWorld;
  readonly rng: Rng;
  areas: AreaSystem;
  readonly effects: EffectsEngine;
  readonly enemies: Map<string, BenchEnemy>;
  readonly items: Map<string, BenchItemSpawn>;
  dummy: Entity;
  running: boolean;
  tickAccumMs: number;
  tickCount: number;
}

function freshAreas(world: EditableWorld, content: ContentRegistry): AreaSystem {
  return new AreaSystem(content, world);
}

export function createBenchState(world: EditableWorld): BenchState {
  const content = benchContent();
  const center = Math.floor(EDITOR_GRID_SIZE / 2);
  return {
    content,
    world,
    rng: new Rng(BENCH_RNG_SEED),
    areas: freshAreas(world, content),
    effects: new EffectsEngine(content, (x, y) => world.isSanctuary(x, y)),
    enemies: new Map(),
    items: new Map(),
    dummy: createDummy(center, center),
    running: false,
    tickAccumMs: 0,
    tickCount: 0,
  };
}

export { freshAreas };
