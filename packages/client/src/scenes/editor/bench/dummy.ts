// The training dummy (Epic 7.11 assumption #27): a client-only regenerating target so
// SIMULATE's enemy AI has something to wander toward and strike, without a new engine
// entity kind or any server plumbing. It is a real engine Entity (so the unmodified
// enemyThink/effects systems treat it exactly like a player target) — only its regen is
// bench-specific code, since a real player's hp never self-heals like this.
import { createBody, makeEntity, type Entity } from "@dc2d/engine";

export const DUMMY_ID = "training-dummy";
export const DUMMY_NAME = "Training Dummy";
/** Assumption #59: 40 hp (mid-pack among the 4 starter enemies' attack damage) and a
 * 1 hp/s regen so a single enemy can visibly dent it, but a fight doesn't stalemate forever. */
export const DUMMY_MAX_HP = 40;
const REGEN_PER_SECOND = 1;

export function createDummy(x: number, y: number): Entity {
  return makeEntity("player", createBody(x + 0.5, y + 0.5, 0), {
    id: DUMMY_ID,
    name: DUMMY_NAME,
    hp: DUMMY_MAX_HP,
    maxHp: DUMMY_MAX_HP,
    baseSpeed: 0,
    tags: new Set(["dummy"]),
  });
}

/** Regenerates every tick, even from 0 — a training dummy dips, it never actually dies
 * (deliberately bypasses modifyHealth's "corpses don't heal" rule, which is correct for
 * real entities but wrong for this one). */
export function tickDummyRegen(dummy: Entity, dt: number): void {
  dummy.hp = Math.min(dummy.maxHp, dummy.hp + REGEN_PER_SECOND * dt);
}
