import {
  ARENA_HALF,
  bossArenaGatePosition,
  bossArenaSpawnAnchor,
} from "@dc2d/engine";
import { announceBossIntro, announceBossKill, broadcastAnnouncement } from "../announcer/index.js";
import { spawnEnemy } from "../helpers.js";
import { levelForXp } from "../xp.js";
import type { EnemySlot, SimState } from "../state.js";
import { BOSS_RESPAWN_TICKS, BOSS_XP_BURST, FLOOR_CAP, WARDEN_DEF_ID } from "./constants.js";

/**
 * The Warden of Five (Epic 7.14): spawn-on-floor-creation, and the
 * death -> XP burst -> respawn cycle. The arena's WALLS are real,
 * generator-placed TILE.Wall geometry (world/features/bossArena.ts,
 * the worldgen lane) — already solid via the engine's own "walls are
 * solid, period" collision, so this module only has to guard the ONE
 * open gate cell, not a whole boundary. That guard is a server-side
 * positional clamp at the gate (ASSUMPTION #128, docs/ASSUMPTIONS.md)
 * rather than a real tile swap — flipping a generated tile at runtime
 * is out of this lane's owned files.
 *
 * Gate semantics (ASSUMPTION #126): the arena starts OPEN so players can
 * walk in through the gate; it SEALS the instant someone is inside while
 * the Warden lives (ROADMAP.md's "door seals during the fight," which
 * resolves the SHARED CONTRACT's terser "solid while boss alive" — read
 * literally that phrase would seal the arena from floor-5 creation,
 * before anyone could ever get in to fight it). It unseals on death and
 * re-arms once the Warden respawns and someone re-enters. It also
 * unseals if every tracked occupant leaves the sim entirely (disconnect
 * reap, or the death -> floor-1 transfer) while the Warden still lives —
 * otherwise a solo wipe permanently bricks the boss for everyone else.
 */

const GATE_CAPTURE_RADIUS = 1.2; // wider than one tick's max movement, so no one slips through unclamped

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isWarden(enemy: EnemySlot): boolean {
  return enemy.def.id === WARDEN_DEF_ID;
}

function hasLivingBoss(sim: SimState): boolean {
  for (const enemy of sim.enemies.values()) if (isWarden(enemy)) return true;
  return false;
}

function isInsideArena(sim: SimState, body: { x: number; y: number }): boolean {
  const anchor = bossArenaSpawnAnchor(sim.world);
  if (!anchor) return false;
  return Math.max(Math.abs(body.x - anchor.x), Math.abs(body.y - anchor.y)) < ARENA_HALF;
}

function spawnBoss(sim: SimState): void {
  const anchor = bossArenaSpawnAnchor(sim.world);
  // No arena landmark on this seed/floor (shouldn't happen at FLOOR_CAP,
  // but the generator's ring search has a documented last-resort
  // fallback) — the boss is simply absent rather than crashing floor-5
  // creation.
  if (!anchor) return;
  spawnEnemy(sim, WARDEN_DEF_ID, anchor.x, anchor.y);
}

/** Called once from GameSim's constructor when it creates a floor-5 sim. */
export function initBossFloor(sim: SimState): void {
  if (sim.world.floor === FLOOR_CAP) spawnBoss(sim);
}

/** Respawn timer + arena gate. Call once per tick; no-ops off floor 5. */
export function stepBoss(sim: SimState): void {
  if (sim.world.floor !== FLOOR_CAP) return;
  if (sim.bossRespawnAtTick !== null && sim.tickCount >= sim.bossRespawnAtTick) {
    sim.bossRespawnAtTick = null;
    spawnBoss(sim);
  }
  enforceBossGate(sim);
}

function enforceBossGate(sim: SimState): void {
  const gate = bossArenaGatePosition(sim.world);
  if (!gate || !hasLivingBoss(sim)) {
    sim.bossGateSealed = false;
    sim.bossArenaOccupants.clear();
    return;
  }
  if (!sim.bossGateSealed) {
    armGateIfEngaged(sim);
    return;
  }
  if (releaseIfArenaEmptied(sim)) return;
  for (const [id, slot] of sim.players) {
    const body = slot.entity.body;
    if (distance(body, gate) > GATE_CAPTURE_RADIUS) continue;
    const wasInside = sim.bossArenaOccupants.has(id);
    body.y = wasInside ? gate.y - GATE_CAPTURE_RADIUS : gate.y + GATE_CAPTURE_RADIUS;
  }
}

/**
 * Drop tracked occupants who are no longer in this sim at all — reaped
 * after a disconnect, or transferred out by the death -> floor-1 return
 * (both delete the slot from sim.players outright, unlike a merely
 * downed/dead-but-still-present player). If that empties the occupant
 * set while the Warden lives, unseal: a solo wipe or a walk-in-then-quit
 * must not brick the arena for everyone else until server restart.
 * Returns whether it released the seal, so the caller can skip the
 * now-stale clamp pass for this tick.
 */
function releaseIfArenaEmptied(sim: SimState): boolean {
  for (const id of sim.bossArenaOccupants) {
    if (!sim.players.has(id)) sim.bossArenaOccupants.delete(id);
  }
  if (sim.bossArenaOccupants.size > 0) return false;
  sim.bossGateSealed = false;
  return true;
}

/** Seal the instant anyone is inside the arena, snapshotting who's in. */
function armGateIfEngaged(sim: SimState): void {
  const insiders = [...sim.players.entries()].filter(([, slot]) => isInsideArena(sim, slot.entity.body));
  if (insiders.length === 0) return;
  sim.bossGateSealed = true;
  for (const [id] of insiders) sim.bossArenaOccupants.add(id);
  broadcastAnnouncement(sim, announceBossIntro(sim.tickCount));
}

/** Called from deaths.ts's enemy-death loop for the Warden specifically. */
export function handleBossDeath(sim: SimState): void {
  sim.bossGateSealed = false;
  sim.bossArenaOccupants.clear();
  sim.bossRespawnAtTick = sim.tickCount + BOSS_RESPAWN_TICKS;
  broadcastAnnouncement(sim, announceBossKill(sim.tickCount));
  for (const slot of sim.players.values()) {
    if (!isInsideArena(sim, slot.entity.body)) continue;
    const { level } = sim.store.addXp(slot.stored, BOSS_XP_BURST, levelForXp);
    slot.outbox.push({ t: "toast", msg: `The Warden falls! +${BOSS_XP_BURST} XP (Level ${level})` });
  }
}
