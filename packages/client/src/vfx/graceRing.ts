// Spawn-grace shield ring (panel round 4, LANE B): a thin gold circle outline around
// the self player while spawn/respawn invulnerability is active, fading out over the
// grace window. Replaces the earlier teal-tinted overlay that read as "a passive slime
// standing on top of you" (BookFan wasted attack beats on it, docs/ROADMAP.md panel
// round 3b) — an UNMISTAKABLE-SHAPE fix, not a recolor: a ring can't be mistaken for a
// creature the way a filled blob could. See scenes/dungeon/selfCosmetics.ts for where
// the countdown itself starts (startSelfGrace) and forfeits early (endSelfGrace).
import type Phaser from "phaser";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import { SELECTION_ACCENT } from "../ui/panel.js";

/** Mirrors game-server/sim/spawnSafety.ts's SPAWN_GRACE_SECONDS (2s) — the wire
 * protocol carries no grace flag (adding one is the sibling engine/game-server lane's
 * call, not this client-only wave's), so the ring's timing is a client-side
 * approximation of the real window, not server truth. See docs/ASSUMPTIONS.md row 380. */
export const SELF_GRACE_DURATION_MS = 2000;

/** 0..1 ring opacity: 0 once expired/inactive, easing toward 0 across the countdown's
 * final window (pure — unit-tested apart from the Graphics object below). Quadratic
 * ease-out reads as a deliberate dissolve, not a linear cooldown-bar drain. */
export function graceRingAlpha(untilMs: number, nowMs: number, durationMs = SELF_GRACE_DURATION_MS): number {
  if (durationMs <= 0) return 0;
  const remaining = untilMs - nowMs;
  if (remaining <= 0) return 0;
  const fraction = Math.min(1, remaining / durationMs);
  return fraction * fraction;
}

const RADIUS_PX = 26;
const THICKNESS_PX = 2;
/** Above every entity sprite, same convention as fistbumpRing.ts/reviveRingSync.ts. */
const RING_DEPTH = 100000;
/** Roughly chest-height on the feet-anchored sprite, so the ring encircles the body
 * instead of sitting flat at the ground contact point. */
const VERTICAL_OFFSET_PX = 30;

export class GraceRing {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(RING_DEPTH).setVisible(false);
  }

  /** One call per frame with the self player's own world pose + grace countdown. */
  sync(worldX: number, worldY: number, graceUntilMs: number, nowMs: number): void {
    const alpha = graceRingAlpha(graceUntilMs, nowMs);
    if (alpha <= 0) {
      this.graphics.setVisible(false);
      return;
    }
    const screen = worldToScreen(worldX, worldY);
    this.graphics.setVisible(true);
    this.graphics.clear();
    this.graphics.lineStyle(THICKNESS_PX, SELECTION_ACCENT, alpha);
    this.graphics.strokeCircle(screen.x, screen.y - VERTICAL_OFFSET_PX, RADIUS_PX);
  }

  dispose(): void {
    this.graphics.destroy();
  }
}
