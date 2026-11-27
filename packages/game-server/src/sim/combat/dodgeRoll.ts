/** Server-side player dodge roll initiation and stamina/i-frame state transitions. */
import type { WorldEvent } from "@dc2d/engine";
import type { CombatPlayerRef } from "../combatActions.js";

/** Initiates a player dodge roll if stamina and cooldown allow, emitting a dodge event. */
export function tryExecutePlayerDodge(opts: {
  readonly p: CombatPlayerRef;
  readonly moveX: number;
  readonly moveY: number;
  readonly cost: number;
  readonly durSec: number;
  readonly iframeSec: number;
  readonly cdSec: number;
  readonly events: WorldEvent[];
}): void {
  const c = opts.p.combat;
  if (c.dodgeCooldown > 0 || c.dodgeTimer > 0 || (!c.godMode && c.stamina < opts.cost)) return;
  if (!c.godMode) c.stamina -= opts.cost;
  c.dodgeTimer = opts.durSec;
  c.invulnTimer = opts.iframeSec;
  c.dodgeCooldown = opts.cdSec;
  c.bowCharge = 0;
  c.blocking = false;
  const mag = Math.hypot(opts.moveX, opts.moveY);
  c.dodgeDirX = mag > 0.05 ? opts.moveX / mag : opts.p.facingX;
  c.dodgeDirY = mag > 0.05 ? opts.moveY / mag : opts.p.facingY;
  opts.events.push({ kind: "dodge", x: opts.p.x, y: opts.p.y, dirX: c.dodgeDirX, dirY: c.dodgeDirY, actorId: opts.p.id });
}
