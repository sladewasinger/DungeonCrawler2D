/** Sequential per-player scent crumbs with water dilution, campfire masking, and body odor. */
import { AI_TUNING, GroundKind, PropKind, WorldChunkCache, isInSanctuary } from "@dc2d/engine";

export interface ScentCrumb {
  readonly seq: number;
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly actorId: string;
  readonly strength: number;
  readonly ambient: boolean;
  readonly decayRate: number;
  ageSec: number;
}

export interface ScentPlayerSample {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly elevation?: number | undefined;
  readonly moving: boolean;
  readonly crouching?: boolean | undefined;
  readonly sprinting?: boolean | undefined;
  readonly inWater?: boolean | undefined;
  readonly inDeepWater?: boolean | undefined;
  readonly bleedTimer: number;
}

export interface ScentTrailQuery {
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly maxDist: number;
  readonly maxAgeSec: number;
  readonly actorId: string | null;
  readonly minSeq: number;
}

export interface PassiveWhiffQuery {
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly maxDist: number;
  readonly maxAgeSec: number;
}

interface PlayerScentState {
  readonly crumbs: ScentCrumb[];
  lastX: number;
  lastY: number;
  moveTimer: number;
  stillTimer: number;
  wetWashTimer: number;
}

const MAX_CRUMBS_PER_PLAYER = 48;
const MAX_CRUMB_RETENTION_SEC = 26.0;

function resolvePlayerWater(p: ScentPlayerSample, cache?: WorldChunkCache): { readonly shallow: boolean; readonly deep: boolean } {
  if (p.inDeepWater) return { shallow: false, deep: true };
  if (p.inWater) return { shallow: true, deep: false };
  if (!cache) return { shallow: false, deep: false };
  const ground = cache.tileAt(Math.floor(p.x), Math.floor(p.y)).ground;
  return { shallow: ground === GroundKind.ShallowWater, deep: ground === GroundKind.DeepWater };
}

function hasNearbyCampfire(cache: WorldChunkCache | undefined, x: number, y: number): boolean {
  if (!cache) return false;
  return cache.propsNear(x, y).some(
    (pr) => pr.kind === PropKind.Campfire && Math.hypot(pr.x - x, pr.y - y) <= AI_TUNING.campfireMaskRadiusTiles,
  );
}

function applyMasking(opts: {
  readonly strength: number;
  readonly baseDecay: number;
  readonly shallow: boolean;
  readonly nearFire: boolean;
  readonly wetWashTimer: number;
}): { readonly strength: number; readonly decayRate: number } {
  let strength = opts.strength;
  let decayRate = opts.baseDecay;
  if (opts.shallow) {
    strength *= 0.25;
    decayRate = 3.0;
  } else if (opts.wetWashTimer > 0) {
    strength *= 0.5;
  }
  if (opts.nearFire) strength *= 0.35;
  return { strength, decayRate };
}

function movingBaseStrength(p: ScentPlayerSample): number {
  if (p.bleedTimer > 0) return 1.85;
  if (p.sprinting) return 1.25;
  return p.crouching ? 0.72 : 1.0;
}

function computeCrumbProfile(opts: {
  readonly p: ScentPlayerSample; readonly state: PlayerScentState; readonly shallow: boolean; readonly nearFire: boolean;
}): { readonly strength: number; readonly ambient: boolean; readonly decayRate: number } | null {
  const { p, state, shallow, nearFire } = opts;
  if (p.moving || p.bleedTimer > 0) {
    const ready = Math.hypot(p.x - state.lastX, p.y - state.lastY) >= 0.9 || state.moveTimer >= 0.45;
    if (!ready) return null;
    const baseDecay = p.bleedTimer > 0 ? 0.8 : 1.0;
    return { ...applyMasking({ strength: movingBaseStrength(p), baseDecay, shallow, nearFire, wetWashTimer: state.wetWashTimer }), ambient: false };
  }
  if (state.stillTimer < 1.2) return null;
  return { ...applyMasking({ strength: 0.55, baseDecay: 1.0, shallow, nearFire, wetWashTimer: state.wetWashTimer }), ambient: true };
}

function effectiveCrumbRadius(c: ScentCrumb, maxDist: number): number {
  if (c.ambient) return Math.min(maxDist, AI_TUNING.bodyScentRadiusTiles) * Math.min(1.2, c.strength / 0.55);
  if (c.strength >= 1.5) return maxDist * 1.3;
  return maxDist * Math.min(1.15, Math.max(0.3, c.strength));
}

function isBetterTrailCrumb(cand: ScentCrumb, best: ScentCrumb | null): boolean {
  if (!best) return true;
  if (cand.seq !== best.seq) return cand.seq > best.seq;
  return cand.strength > best.strength;
}

export class ScentTrail {
  private readonly byPlayer = new Map<string, PlayerScentState>();
  private nextSeq = 1;

  private ensureState(actorId: string, x: number, y: number): PlayerScentState {
    const existing = this.byPlayer.get(actorId);
    if (existing) return existing;
    const created: PlayerScentState = { crumbs: [], lastX: x, lastY: y, moveTimer: 0.45, stillTimer: 0, wetWashTimer: 0 };
    this.byPlayer.set(actorId, created);
    return created;
  }

  removePlayer(actorId: string): void {
    this.byPlayer.delete(actorId);
  }

  private decayPlayerState(state: PlayerScentState, dt: number): boolean {
    state.moveTimer += dt;
    state.stillTimer += dt;
    state.wetWashTimer = Math.max(0, state.wetWashTimer - dt);
    for (let i = state.crumbs.length - 1; i >= 0; i--) {
      const c = state.crumbs[i]!;
      c.ageSec += dt * c.decayRate;
      if (c.ageSec >= MAX_CRUMB_RETENTION_SEC) state.crumbs.splice(i, 1);
    }
    return state.crumbs.length === 0 && state.stillTimer > 30;
  }

  step(dt: number): void {
    for (const [actorId, state] of this.byPlayer) {
      if (this.decayPlayerState(state, dt)) this.byPlayer.delete(actorId);
    }
  }

  private sampleSinglePlayer(p: ScentPlayerSample, cache?: WorldChunkCache): void {
    const state = this.ensureState(p.id, p.x, p.y);
    const water = resolvePlayerWater(p, cache);
    if (water.deep) {
      state.wetWashTimer = AI_TUNING.waterScentWashSec;
      state.moveTimer = 0; state.stillTimer = 0; state.lastX = p.x; state.lastY = p.y;
      return;
    }
    if (water.shallow) state.wetWashTimer = Math.max(state.wetWashTimer, 1.5);
    const profile = computeCrumbProfile({ p, state, shallow: water.shallow, nearFire: hasNearbyCampfire(cache, p.x, p.y) });
    if (!profile) return;
    state.lastX = p.x; state.lastY = p.y; state.moveTimer = 0; state.stillTimer = 0;
    this.addCrumb({ x: p.x, y: p.y, elevation: p.elevation ?? 0, actorId: p.id, ...profile });
  }

  samplePlayers(players: readonly ScentPlayerSample[], cache?: WorldChunkCache): void {
    for (const p of players) {
      if (!isInSanctuary(p.x, p.y)) this.sampleSinglePlayer(p, cache);
    }
  }

  addCrumb(opts: {
    readonly x: number; readonly y: number; readonly actorId: string; readonly strength: number;
    readonly elevation?: number | undefined; readonly ambient?: boolean | undefined; readonly decayRate?: number | undefined;
  }): ScentCrumb {
    const state = this.ensureState(opts.actorId, opts.x, opts.y);
    if (state.crumbs.length >= MAX_CRUMBS_PER_PLAYER) state.crumbs.shift();
    const crumb: ScentCrumb = {
      seq: this.nextSeq++, x: opts.x, y: opts.y, elevation: opts.elevation ?? 0, actorId: opts.actorId,
      strength: opts.strength, ambient: opts.ambient ?? false, decayRate: opts.decayRate ?? 1.0, ageSec: 0,
    };
    state.crumbs.push(crumb);
    return crumb;
  }

  private collectLists(actorId: string | null): readonly (readonly ScentCrumb[])[] {
    if (actorId !== null) {
      const state = this.byPlayer.get(actorId);
      return state ? [state.crumbs] : [];
    }
    return Array.from(this.byPlayer.values(), (s) => s.crumbs);
  }

  private pickBestInList(list: readonly ScentCrumb[], opts: ScentTrailQuery, current: ScentCrumb | null): ScentCrumb | null {
    let best = current;
    for (const c of list) {
      if (this.matchesTrailCrumb(c, opts) && isBetterTrailCrumb(c, best)) best = c;
    }
    return best;
  }

  findNextTrailCrumb(opts: ScentTrailQuery): ScentCrumb | null {
    let best: ScentCrumb | null = null;
    for (const list of this.collectLists(opts.actorId)) {
      best = this.pickBestInList(list, opts, best);
    }
    return best;
  }

  private matchesTrailCrumb(c: ScentCrumb, opts: ScentTrailQuery): boolean {
    if (c.seq <= opts.minSeq || c.ageSec > opts.maxAgeSec || Math.abs(c.elevation - opts.elevation) > 1) return false;
    const dist = Math.hypot(c.x - opts.x, c.y - opts.y);
    if (!c.ambient && dist < 0.25) return false;
    return dist <= effectiveCrumbRadius(c, opts.maxDist);
  }

  private matchesPassiveWhiff(c: ScentCrumb, opts: PassiveWhiffQuery): boolean {
    if (c.ambient || c.ageSec > opts.maxAgeSec || c.strength < 0.95) return false;
    return Math.abs(c.elevation - opts.elevation) <= 1 && Math.hypot(c.x - opts.x, c.y - opts.y) <= opts.maxDist;
  }

  findFreshPassiveWhiff(opts: PassiveWhiffQuery): ScentCrumb | null {
    let best: ScentCrumb | null = null;
    for (const state of this.byPlayer.values()) {
      for (const c of state.crumbs) {
        if (this.matchesPassiveWhiff(c, opts) && (!best || c.seq > best.seq)) best = c;
      }
    }
    return best;
  }
}
