/** Timed spatial scent crumbs emitted by moving or bleeding players outside Sanctuary. */
import { AI_TUNING, isInSanctuary } from "@dc2d/engine";

export interface ScentCrumb {
  readonly x: number;
  readonly y: number;
  readonly actorId: string;
  readonly strength: number;
  ageSec: number;
}

const MAX_CRUMBS = 64;

export class ScentTrail {
  private readonly crumbs: ScentCrumb[] = [];
  private emitTimer = 0;

  step(dt: number): void {
    this.emitTimer += dt;
    for (let i = this.crumbs.length - 1; i >= 0; i--) {
      const c = this.crumbs[i]!;
      c.ageSec += dt;
      if (c.ageSec >= AI_TUNING.scentMaxAgeSec) this.crumbs.splice(i, 1);
    }
  }

  samplePlayers(players: readonly { readonly id: string; readonly x: number; readonly y: number; readonly moving: boolean; readonly bleedTimer: number }[]): void {
    if (this.emitTimer < 0.45) return;
    this.emitTimer = 0;
    const active = players.filter((p) => !isInSanctuary(p.x, p.y) && (p.moving || p.bleedTimer > 0));
    for (const p of active) {
      this.addCrumb({ x: p.x, y: p.y, actorId: p.id, strength: p.bleedTimer > 0 ? 1.8 : 1.0 });
    }
  }

  addCrumb(opts: { readonly x: number; readonly y: number; readonly actorId: string; readonly strength: number }): void {
    if (this.crumbs.length >= MAX_CRUMBS) this.crumbs.shift();
    this.crumbs.push({ x: opts.x, y: opts.y, actorId: opts.actorId, strength: opts.strength, ageSec: 0 });
  }

  findStrongestNear(x: number, y: number, maxDist: number): ScentCrumb | null {
    let best: ScentCrumb | null = null;
    let bestScore = -1;
    for (const c of this.crumbs) {
      const dist = Math.hypot(c.x - x, c.y - y);
      if (dist > maxDist || dist < 0.45) continue;
      const freshness = Math.max(0, 1 - c.ageSec / AI_TUNING.scentMaxAgeSec);
      const score = c.strength * freshness - dist * 0.06;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }
}
