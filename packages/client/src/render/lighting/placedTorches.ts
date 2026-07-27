// Pure derivation from live torch entities to render/lighting concerns: the accent
// halos (flying + placed), the BFS seeds a placed torch feeds into the baked chunk
// light, and the frame-to-frame diff that tells the caller which tiles just started
// or stopped glowing — the exact input a targeted rebake needs. No Phaser, no net;
// scenes/dungeon/torchSync.ts is the seam that wires this to live snapshots.
import { hashSeed, type LightSource } from "./lightSource.js";
import { TORCH_COLOR, TORCH_FLIGHT_RADIUS_TILES, TORCH_RADIUS_TILES } from "./torchLightStyle.js";
import type { TilePos } from "./torchPlacement.js";
import { LIGHT_MAX, type DynamicLightSeed } from "../terrain/tileLight.js";

export interface PlacedTorch {
  readonly id: string;
  readonly tileX: number;
  readonly tileY: number;
  /** 0..1 halo strength; omitted/1 = full brightness. See torchEmberFade below. */
  readonly emberFade?: number;
}

/** Seconds before burnout the fading-ember tell begins (docs/ROADMAP.md Epic 7.8's
 * deferred bullet, closed in Epic 7.12). */
export const EMBER_FADE_SECONDS = 15;
/** Halo strength floor as burnout approaches — never fully dark before the actual
 * expiry event does that job (the pickup/burnout rebake-out), so the last visible
 * frames still read as "a dying torch", not "nothing here". */
const EMBER_FADE_FLOOR = 0.35;

/**
 * 1 while a placed torch has more than EMBER_FADE_SECONDS of burn time left, ramping
 * linearly down to EMBER_FADE_FLOOR as `expiresAtTick` approaches. Purely a render-side
 * halo modulation — the baked BFS tile light (terrain/tileLight.ts) this torch also
 * seeds is untouched, so this costs nothing beyond the accent light this system
 * already recomputes every frame (the "zero per-frame cost" property, ASSUMPTIONS.md
 * #10, describes the baked light only).
 */
export function torchEmberFade(ticksRemaining: number, tickRate: number): number {
  const fadeWindowTicks = EMBER_FADE_SECONDS * tickRate;
  if (ticksRemaining >= fadeWindowTicks) return 1;
  if (ticksRemaining <= 0) return EMBER_FADE_FLOOR;
  const t = ticksRemaining / fadeWindowTicks;
  return EMBER_FADE_FLOOR + (1 - EMBER_FADE_FLOOR) * t;
}

/** Dims `base` toward black as `fade` drops from 1 (full brightness) to 0 — a guttering
 * ember reads darker as well as smaller, not just smaller. */
function emberColor(base: number, fade: number): number {
  if (fade >= 1) return base;
  const mix = (channel: number) => Math.round(channel * (0.4 + 0.6 * fade));
  const r = mix((base >> 16) & 0xff);
  const g = mix((base >> 8) & 0xff);
  const b = mix(base & 0xff);
  return (r << 16) | (g << 8) | b;
}

export interface FlyingTorch {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/** Halo + flame-particle light for every placed torch (kind "torch" — the same kind
 * LightingSystem.activeTorches() reads to spawn flame particles). */
export function placedTorchLights(torches: readonly PlacedTorch[]): LightSource[] {
  return appendPlacedTorchLights(torches, []);
}

export function appendPlacedTorchLights(
  torches: readonly PlacedTorch[],
  out: LightSource[],
): LightSource[] {
  for (const t of torches) {
    const fade = t.emberFade ?? 1;
    out.push({
      id: `torch-placed:${t.id}`,
      x: t.tileX + 0.5,
      y: t.tileY + 0.5,
      color: emberColor(TORCH_COLOR, fade),
      radiusTiles: TORCH_RADIUS_TILES * (0.55 + 0.45 * fade),
      kind: "torch" as const,
      seed: hashSeed(t.id),
    });
  }
  return out;
}

/** Plain travel glow for every flying torch — kind "fire" so it never spawns a
 * flame-particle emitter chasing the arc; the light rides the flight path only. */
export function flyingTorchLights(torches: readonly FlyingTorch[]): LightSource[] {
  return appendFlyingTorchLights(torches, []);
}

export function appendFlyingTorchLights(
  torches: readonly FlyingTorch[],
  out: LightSource[],
): LightSource[] {
  for (const t of torches) {
    out.push({
      id: `torch-flight:${t.id}`,
      x: t.x,
      y: t.y,
      color: TORCH_COLOR,
      radiusTiles: TORCH_FLIGHT_RADIUS_TILES,
      kind: "fire" as const,
      seed: hashSeed(t.id),
    });
  }
  return out;
}

/** BFS seeds for the baked chunk light — a placed torch shines exactly as bright as
 * an authored world torch. */
export function placedTorchSeeds(torches: readonly PlacedTorch[]): DynamicLightSeed[] {
  return torches.map((t) => ({ tileX: t.tileX, tileY: t.tileY, level: LIGHT_MAX }));
}

/**
 * Frame-to-frame diff of placed-torch tiles: every tile that just started or stopped
 * being a light source (a landing, an expiry, or a pickup). The caller owns `previous`
 * across frames and threads `next` back in — kept pure so it's trivially testable.
 */
export function diffPlacedTorches(
  previous: ReadonlyMap<string, TilePos>,
  current: readonly PlacedTorch[],
): { changedTiles: TilePos[]; next: Map<string, TilePos> } {
  const next = new Map<string, TilePos>();
  const changedTiles: TilePos[] = [];
  for (const torch of current) {
    appendChangedTorch({ previous, next, changedTiles, torch });
  }
  for (const [id, tile] of previous) {
    if (!next.has(id)) changedTiles.push(tile);
  }
  return { changedTiles, next };
}

function appendChangedTorch(input: ChangedTorchInput): void {
  const tile = { wx: input.torch.tileX, wy: input.torch.tileY };
  input.next.set(input.torch.id, tile);
  const prior = input.previous.get(input.torch.id);
  if (!prior || prior.wx !== tile.wx || prior.wy !== tile.wy) input.changedTiles.push(tile);
}

interface ChangedTorchInput {
  readonly previous: ReadonlyMap<string, TilePos>;
  readonly next: Map<string, TilePos>;
  readonly changedTiles: TilePos[];
  readonly torch: PlacedTorch;
}

/**
 * In-place variant for the frame loop. Existing tile records survive unchanged
 * frames; only land, move, and removal events allocate persistent tile values.
 */
export function updatePlacedTorchTiles(
  state: PlacedTorchTileState,
  current: readonly PlacedTorch[],
): TilePos[] {
  state.seenPlacedIds.clear();
  state.changedTiles.length = 0;
  updateCurrentPlacedTiles(state, current);
  removeMissingPlacedTiles(state);
  return state.changedTiles;
}

function updateCurrentPlacedTiles(state: PlacedTorchTileState, current: readonly PlacedTorch[]): void {
  for (const torch of current) updatePlacedTorchTile(state, torch);
}

function updatePlacedTorchTile(state: PlacedTorchTileState, torch: PlacedTorch): void {
  state.seenPlacedIds.add(torch.id);
  const prior = state.placedTiles.get(torch.id);
  if (prior && prior.wx === torch.tileX && prior.wy === torch.tileY) return;
  const tile = { wx: torch.tileX, wy: torch.tileY };
  state.placedTiles.set(torch.id, tile);
  state.changedTiles.push(tile);
}

function removeMissingPlacedTiles(state: PlacedTorchTileState): void {
  for (const [id, tile] of state.placedTiles) {
    if (state.seenPlacedIds.has(id)) continue;
    state.placedTiles.delete(id);
    state.changedTiles.push(tile);
  }
}

export interface PlacedTorchTileState {
  readonly placedTiles: Map<string, TilePos>;
  readonly seenPlacedIds: Set<string>;
  readonly changedTiles: TilePos[];
}
