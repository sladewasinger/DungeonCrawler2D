// Public facade: rotating, deterministic system-voice flavor lines for
// join/death/level/kill/fistbump/torch moments — the DCC book-fan lane
// (Epic 7.13). Every line rides the existing "system" chat channel, so
// no client changes are required to see them.
import { stairwayDownChunk, type EnemyDef, type GameEvent } from "@dc2d/engine";
import type { PlayerSlot, SimState } from "../state.js";
import { killVerbPhrase } from "./killLine.js";
import {
  BOSS_INTRO_LINES,
  BOSS_KILL_LINES,
  CHASM_DEATH_LINES,
  DEATH_LINES,
  FIRST_TORCH_LINES,
  FISTBUMP_LINES,
  FLOOR_ENTRY_LINES,
  JOIN_LINES,
  KILL_MILESTONE_LINES,
  LEVEL_UP_LINES,
  PERSONAL_KILL_LINES,
  STAIRWAY_HINT_LINES,
} from "./lines.js";
import { pickLineIndex } from "./pick.js";
import { recordKill } from "./killCounts.js";

/** Kill counts that earn a callout; anything else is silent (no spam). */
const KILL_MILESTONES: readonly number[] = [5, 10, 25, 50, 100, 250, 500];

function systemLine(text: string): GameEvent {
  return { t: "chat", channel: "system", from: "server", name: "system", text };
}

function pick<T>(pool: readonly T[], tick: number, salt: string): T {
  // pool is always non-empty (module-level constants above) so this cast is safe.
  return pool[pickLineIndex(tick, salt, pool.length)] as T;
}

/** Broadcasts an announcer line to every connected player — the "audience" hears it. */
export function broadcastAnnouncement(sim: SimState, event: GameEvent): void {
  for (const slot of sim.players.values()) if (slot.connected) slot.outbox.push(event);
}

export function announceJoin(tick: number, playerId: string, name: string, ordinal: number): GameEvent {
  const line = pick(JOIN_LINES, tick, `join:${playerId}`);
  return systemLine(line(name, ordinal));
}

/**
 * `rating` (panel round 3b, "Small" item) is the 2-9 audience score derived from this
 * life's run stats — see sim/announcer/rating.ts and deaths.ts's call site, which reads
 * lifeStats.ts's per-life kill/duration snapshot right before calling this.
 */
export function announceDeath(
  tick: number,
  playerId: string,
  name: string,
  chasm: boolean,
  rating: number,
): GameEvent {
  const pool = chasm ? CHASM_DEATH_LINES : DEATH_LINES;
  const line = pick(pool, tick, `death:${playerId}`);
  return systemLine(line(name, rating));
}

export function announceLevelUp(
  tick: number,
  playerId: string,
  name: string,
  level: number,
): GameEvent {
  const line = pick(LEVEL_UP_LINES, tick, `level:${playerId}:${level}`);
  return systemLine(line(name, level));
}

/** Null unless this kill just crossed a milestone threshold. */
export function announceKillMilestone(tick: number, killer: PlayerSlot): GameEvent | null {
  const count = recordKill(killer);
  if (!KILL_MILESTONES.includes(count)) return null;
  const line = pick(KILL_MILESTONE_LINES, tick, `kills:${killer.entity.id}:${count}`);
  return systemLine(line(killer.entity.name ?? "?", count));
}

/**
 * Killer-addressed personal kill line (panel round 2 BOOKFAN): fires on
 * every attributed kill, not just milestones — the caller pushes the
 * result straight onto the killer's outbox, never broadcastAnnouncement,
 * so only the killer hears it.
 */
export function announceKill(tick: number, killerId: string, def: EnemyDef): GameEvent {
  const verbPhrase = killVerbPhrase(def);
  const line = pick(PERSONAL_KILL_LINES, tick, `kill:${killerId}:${def.id}`);
  return systemLine(line(verbPhrase));
}

export function announceFistbump(tick: number, aId: string, aName: string, bName: string): GameEvent {
  const line = pick(FISTBUMP_LINES, tick, `fistbump:${aId}`);
  return systemLine(line(aName, bName));
}

export function announceFirstTorchThrow(tick: number, playerId: string, name: string): GameEvent {
  const line = pick(FIRST_TORCH_LINES, tick, `torch:${playerId}`);
  return systemLine(line(name));
}

/**
 * Epic 7.14 (The Descent) — private (not broadcast) floor-identity line
 * for whoever just arrived at `floor`. Indexed, not pooled: see
 * lines.ts's FLOOR_ENTRY_LINES doc comment. `floor` is always in
 * [1, FLOOR_ENTRY_LINES.length] by construction (FLOOR_CAP matches).
 */
export function announceFloorEntry(floor: number): GameEvent {
  return systemLine(FLOOR_ENTRY_LINES[floor - 1] ?? `Floor ${floor}.`);
}

/**
 * LANE W / panel R3 blocker #2 (stairs wayfinding) — private stairway-exists
 * hint pushed right after announceFloorEntry on every floor arrival (fresh
 * join and stair transfer both; same cadence as the identity line it rides
 * behind). Null on floors with no StairwayDown (FLOOR_CAP's boss arena), so
 * the caller pushes only when non-null. Salted per (player, floor) so two
 * players arriving the same tick still diverge — the usual tick+salt rotation
 * (pick.ts) varies the line across separate arrivals.
 */
export function announceStairwayHint(
  tick: number,
  playerId: string,
  world: { worldSeed: number; floor: number },
): GameEvent | null {
  if (!stairwayDownChunk(world.worldSeed, world.floor)) return null;
  return systemLine(pick(STAIRWAY_HINT_LINES, tick, `stairs:${playerId}:${world.floor}`)());
}

export function announceBossIntro(tick: number): GameEvent {
  return systemLine(pick(BOSS_INTRO_LINES, tick, "boss:intro")());
}

export function announceBossKill(tick: number): GameEvent {
  return systemLine(pick(BOSS_KILL_LINES, tick, "boss:kill")());
}
