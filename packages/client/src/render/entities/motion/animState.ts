// Maps the server's enemy/player animation state to a baked Phaser animation key plus a
// telegraph treatment. The pack only ships idle/run(+hit for heroes) — there are no
// dedicated windup/attack/recover frames — so those states render as an idle or run loop
// with a code-driven scale pulse / tint, keeping the "windup must telegraph readably"
// requirement satisfied without inventing sprite art that doesn't exist.
import type { EnemyAnimationState } from "@dc2d/engine";

export type Telegraph = "none" | "windup" | "strike";

export interface AnimResolution {
  readonly animKey: string;
  readonly telegraph: Telegraph;
}

/** Resolves one entity's baked animation + telegraph cue for its current server anim state. */
export function resolveAnimState(spritePrefix: string, state: EnemyAnimationState): AnimResolution {
  switch (state) {
    case "idle":
    case "recover":
      return { animKey: `${spritePrefix}_idle`, telegraph: "none" };
    case "walk":
      return { animKey: `${spritePrefix}_run`, telegraph: "none" };
    case "windup":
    case "spit":
      return { animKey: `${spritePrefix}_idle`, telegraph: "windup" };
    case "attack":
      return { animKey: `${spritePrefix}_run`, telegraph: "strike" };
  }
}

const WINDUP_PULSE_PERIOD_MS = 220;
const WINDUP_PULSE_AMPLITUDE = 0.12;
const STRIKE_PUNCH_DURATION_MS = 160;
const STRIKE_PUNCH_AMPLITUDE = 0.22;

/** Scale multiplier for the telegraph cue: windup pulses continuously, strike punches once and decays, none stays put. */
export function telegraphScale(telegraph: Telegraph, elapsedMs: number): number {
  if (telegraph === "windup") {
    const phase = (elapsedMs % WINDUP_PULSE_PERIOD_MS) / WINDUP_PULSE_PERIOD_MS;
    return 1 + Math.sin(phase * Math.PI * 2) * WINDUP_PULSE_AMPLITUDE;
  }
  if (telegraph === "strike") {
    const progress = Math.max(0, Math.min(1, elapsedMs / STRIKE_PUNCH_DURATION_MS));
    return 1 + (1 - progress) * STRIKE_PUNCH_AMPLITUDE;
  }
  return 1;
}

/** Warm telegraph glow tint while winding up or striking; null otherwise (caller keeps its base tint). */
export function telegraphTint(telegraph: Telegraph): number | null {
  return telegraph === "none" ? null : 0xffb37a;
}
