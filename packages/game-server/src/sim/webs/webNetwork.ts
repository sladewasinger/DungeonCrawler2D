/** Dynamic spring-cloth cobweb network: auto-stitching hubs, fire propagation, stretching & sharp cutting. */
import { MELEE_FEEL_TUNING, WorldChunkCache, type WorldEvent, type WorldWebSnapshot } from "@dc2d/engine";
import type { CombatPlayerRef } from "../combatActions.js";
import { isHeatPropNear, pickWebAnchor, pointToSegDistSq, segHitsSector, type WebNode, type WebStrand } from "./webGeometry.js";

const MAX_WEB_NODES = 96;
const SPOKE_COUNT = 6;
const round2 = (v: number): number => Math.round(v * 100) / 100;

export class WorldWebNetwork {
  readonly nodes: WebNode[] = [];
  readonly strands: WebStrand[] = [];
  private nextNodeId = 1;
  private readonly prevPos = new Map<string, { x: number; y: number }>();

  spawnWebCluster(opts: { readonly cache: WorldChunkCache; readonly x: number; readonly y: number }): void {
    const { cache, x, y } = opts;
    const prevCount = this.nodes.length;
    const hub = this.addNode(x, y, false);
    const inner = this.buildRing({ cache, x, y, radius: 0.56, anchorToProps: false, pinned: false });
    const outer = this.buildRing({ cache, x, y, radius: 1.25, anchorToProps: true, pinned: true });
    this.linkRings(hub, inner, outer);
    this.stitchNearbyNodes(hub, prevCount);
    this.trimOldNodes();
  }

  private addNode(x: number, y: number, pinned: boolean): WebNode {
    const node: WebNode = { id: this.nextNodeId++, x, y, restX: x, restY: y, vx: 0, vy: 0, pinned, fire: 0, ageSec: 0 };
    this.nodes.push(node);
    return node;
  }

  private linkPair(a: WebNode, b: WebNode): void {
    const restLen = Math.max(0.18, Math.hypot(b.x - a.x, b.y - a.y));
    this.strands.push({ a, b, restLen, fire: 0 });
  }

  private buildRing(opts: {
    readonly cache: WorldChunkCache; readonly x: number; readonly y: number;
    readonly radius: number; readonly anchorToProps: boolean; readonly pinned: boolean;
  }): WebNode[] {
    const ring: WebNode[] = [];
    for (let i = 0; i < SPOKE_COUNT; i++) {
      const ang = (i / SPOKE_COUNT) * Math.PI * 2 + ((this.nextNodeId % 5) * 0.14);
      const rawX = opts.x + Math.cos(ang) * opts.radius;
      const rawY = opts.y + Math.sin(ang) * opts.radius;
      const pos = opts.anchorToProps ? pickWebAnchor(opts.cache, rawX, rawY) : { x: rawX, y: rawY };
      ring.push(this.addNode(pos.x, pos.y, opts.pinned));
    }
    return ring;
  }

  private linkRings(hub: WebNode, inner: readonly WebNode[], outer: readonly WebNode[]): void {
    for (let i = 0; i < SPOKE_COUNT; i++) {
      const next = (i + 1) % SPOKE_COUNT;
      this.linkPair(hub, inner[i]!);
      this.linkPair(inner[i]!, outer[i]!);
      this.linkPair(inner[i]!, inner[next]!);
      this.linkPair(outer[i]!, outer[next]!);
    }
  }

  private stitchNearbyNodes(hub: WebNode, prevCount: number): void {
    if (prevCount <= 0) return;
    const candidates = this.nodes.slice(0, prevCount)
      .map((n) => ({ n, d: Math.hypot(n.x - hub.x, n.y - hub.y) }))
      .filter((c) => c.d <= 2.75)
      .sort((a, b) => a.d - b.d);
    for (const c of candidates.slice(0, 4)) this.linkPair(hub, c.n);
  }

  private trimOldNodes(): void {
    if (this.nodes.length <= MAX_WEB_NODES) return;
    const dropIds = new Set(this.nodes.splice(0, this.nodes.length - MAX_WEB_NODES).map((n) => n.id));
    this.removeByNodeSet(dropIds);
  }

  private removeByNodeSet(ids: Set<number>): void {
    for (let i = this.strands.length - 1; i >= 0; i--) {
      const s = this.strands[i]!;
      if (ids.has(s.a.id) || ids.has(s.b.id)) this.strands.splice(i, 1);
    }
  }

  private pruneOrphanNodes(): void {
    const used = new Set<number>();
    for (const s of this.strands) { used.add(s.a.id); used.add(s.b.id); }
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      if (!used.has(this.nodes[i]!.id)) this.nodes.splice(i, 1);
    }
  }

  removePlayer(playerId: string): void { this.prevPos.delete(playerId); }

  step(opts: { readonly cache: WorldChunkCache; readonly players: Iterable<CombatPlayerRef>; readonly dt: number }): void {
    if (this.strands.length === 0 && this.nodes.length === 0) { this.decayClearPlayers(opts.players, opts.dt); return; }
    this.stepPlayerWebContact(opts.players, opts.dt); this.stepClothSprings(opts.dt); this.stepFirePropagation(opts.cache, opts.players, opts.dt);
  }

  private decayClearPlayers(players: Iterable<CombatPlayerRef>, dt: number): void {
    for (const p of players) if (p.combat.cocoonProgress <= 0) p.combat.webStick = Math.max(0, p.combat.webStick - 0.65 * dt);
  }

  private stepClothSprings(dt: number): void {
    for (const n of this.nodes) {
      n.ageSec += dt;
      if (n.pinned) continue;
      n.vx += (n.restX - n.x) * 6.0 * dt;
      n.vy += (n.restY - n.y) * 6.0 * dt;
    }
    this.applyStrandForces(dt);
    const damp = Math.exp(-9.0 * dt);
    for (const n of this.nodes) {
      if (n.pinned) continue;
      n.vx *= damp; n.vy *= damp;
      n.x += n.vx * dt; n.y += n.vy * dt;
    }
  }

  private applyStrandForces(dt: number): void {
    for (const s of this.strands) {
      const dx = s.b.x - s.a.x; const dy = s.b.y - s.a.y;
      const dist = Math.max(0.01, Math.hypot(dx, dy));
      const stretch = dist - s.restLen;
      const f = (stretch / dist) * 32.0 * dt;
      if (!s.a.pinned) { s.a.vx += dx * f; s.a.vy += dy * f; }
      if (!s.b.pinned) { s.b.vx -= dx * f; s.b.vy -= dy * f; }
    }
  }

  private hasStaticHeatNear(s: WebStrand, cache: WorldChunkCache): boolean {
    const rev = cache.deltaRevision();
    if (s.staticHeatRev === rev && s.nearStaticHeat !== undefined) return s.nearStaticHeat;
    const mx = (s.a.x + s.b.x) * 0.5;
    const my = (s.a.y + s.b.y) * 0.5;
    const near = cache.propsNear(mx, my).some((pr) => isHeatPropNear(pr, mx, my));
    s.nearStaticHeat = near;
    s.staticHeatRev = rev;
    return near;
  }

  private hasPlayerHeatNear(players: Iterable<CombatPlayerRef>, x: number, y: number): boolean {
    for (const p of players) if (p.combat.burnTimer > 0 && Math.hypot(p.x - x, p.y - y) <= 1.25) return true;
    return false;
  }

  private igniteStrandIfWarm(opts: { readonly s: WebStrand; readonly cache: WorldChunkCache; readonly players: Iterable<CombatPlayerRef> }): void {
    const { s, cache, players } = opts;
    if (s.fire > 0) return;
    if (s.a.fire > 0 || s.b.fire > 0 || this.hasStaticHeatNear(s, cache) || this.hasPlayerHeatNear(players, (s.a.x + s.b.x) * 0.5, (s.a.y + s.b.y) * 0.5)) {
      s.fire = 0.08;
    }
  }

  private stepFirePropagation(cache: WorldChunkCache, players: Iterable<CombatPlayerRef>, dt: number): void {
    const burningNodeIds = new Set<number>();
    for (const s of this.strands) {
      this.igniteStrandIfWarm({ s, cache, players });
      if (s.fire <= 0) continue;
      s.fire += dt * 1.15;
      s.a.fire = Math.max(s.a.fire, s.fire);
      s.b.fire = Math.max(s.b.fire, s.fire);
      burningNodeIds.add(s.a.id);
      burningNodeIds.add(s.b.id);
    }
    this.spreadHeatAndBurnOut(burningNodeIds, players);
  }

  private igniteOverlappingCocoons(players: Iterable<CombatPlayerRef>): void {
    for (const p of players) {
      if (p.combat.cocoonProgress <= 0 || p.combat.cocoonBurning) continue;
      if (this.strands.some((s) => s.fire > 0 && pointToSegDistSq(p, { ax: s.a.x, ay: s.a.y, bx: s.b.x, by: s.b.y }) <= 1.1)) {
        p.combat.cocoonBurning = true;
      }
    }
  }

  private spreadFireToNeighbors(burningNodeIds: Set<number>): void {
    for (const s of this.strands) {
      const touches = burningNodeIds.has(s.a.id) || burningNodeIds.has(s.b.id);
      if (s.fire <= 0 && touches) s.fire = 0.06;
    }
  }

  private pruneExpiredStrands(): void {
    const before = this.strands.length;
    for (let i = this.strands.length - 1; i >= 0; i--) {
      const s = this.strands[i]!;
      if (s.fire >= 1.0 || s.a.ageSec >= 45) this.strands.splice(i, 1);
    }
    if (this.strands.length !== before) this.pruneOrphanNodes();
  }

  private spreadHeatAndBurnOut(burningNodeIds: Set<number>, players: Iterable<CombatPlayerRef>): void {
    this.spreadFireToNeighbors(burningNodeIds);
    this.igniteOverlappingCocoons(players);
    this.pruneExpiredStrands();
  }

  private stepSinglePlayerContact(p: CombatPlayerRef, dt: number): void {
    if (p.combat.respawnTimer > 0) { this.prevPos.delete(p.id); return; }
    const prev = this.prevPos.get(p.id) ?? { x: p.x, y: p.y };
    const moveDx = p.x - prev.x;
    const moveDy = p.y - prev.y;
    this.prevPos.set(p.id, { x: p.x, y: p.y });
    if (this.pullTouchedNodes({ p, moveDx, moveDy, dt })) {
      const rate = Math.hypot(moveDx, moveDy) > 0.002 ? 0.58 : 0.20;
      p.combat.webStick = Math.min(1, p.combat.webStick + rate * dt);
      return;
    }
    if (p.combat.cocoonProgress <= 0) p.combat.webStick = Math.max(0, p.combat.webStick - 0.65 * dt);
  }

  private stepPlayerWebContact(players: Iterable<CombatPlayerRef>, dt: number): void {
    for (const p of players) this.stepSinglePlayerContact(p, dt);
  }

  private pullStrandNodes(s: WebStrand, impulse: { readonly vx: number; readonly vy: number }): void {
    for (const n of [s.a, s.b]) if (!n.pinned) { n.vx += impulse.vx; n.vy += impulse.vy; }
  }

  private pullTouchedNodes(opts: { readonly p: CombatPlayerRef; readonly moveDx: number; readonly moveDy: number; readonly dt: number }): boolean {
    const impulse = { vx: opts.moveDx * 26 * opts.dt * 20, vy: opts.moveDy * 26 * opts.dt * 20 };
    let touched = false;
    for (const s of this.strands) {
      if (pointToSegDistSq(opts.p, { ax: s.a.x, ay: s.a.y, bx: s.b.x, by: s.b.y }) > 0.24) continue;
      touched = true; this.pullStrandNodes(s, impulse);
    }
    return touched;
  }

  applyDirectWebHit(p: CombatPlayerRef): void {
    p.combat.webStick = Math.min(1, p.combat.webStick + Math.max(0.48, MELEE_FEEL_TUNING.webStuckThreshold * 0.58));
  }

  private applySectorToStrands(opts: {
    readonly origin: { readonly x: number; readonly y: number }; readonly dir: { readonly x: number; readonly y: number };
    readonly range: number; readonly halfArcRad: number; readonly sharp: boolean; readonly ignites: boolean;
  }): boolean {
    let changed = false;
    for (let i = this.strands.length - 1; i >= 0; i--) {
      const hit = segHitsSector({ strand: this.strands[i]!, origin: opts.origin, dir: opts.dir, range: opts.range, halfArcRad: opts.halfArcRad });
      if (hit && this.mutateHitStrand(i, opts.sharp, opts.ignites)) changed = true;
    }
    return changed;
  }

  slashOrBurnAt(opts: {
    readonly origin: { readonly x: number; readonly y: number }; readonly dir: { readonly x: number; readonly y: number };
    readonly range: number; readonly halfArcRad: number; readonly sharp: boolean; readonly ignites: boolean; readonly events: WorldEvent[];
  }): boolean {
    if ((!opts.sharp && !opts.ignites) || this.strands.length === 0) return false;
    const changed = this.applySectorToStrands(opts);
    if (changed && opts.sharp) {
      this.pruneOrphanNodes();
      opts.events.push({ kind: "webCut", x: opts.origin.x, y: opts.origin.y });
    }
    return changed;
  }

  private mutateHitStrand(idx: number, sharp: boolean, ignites: boolean): boolean {
    if (sharp) { this.strands.splice(idx, 1); return true; }
    if (ignites) { this.strands[idx]!.fire = Math.max(this.strands[idx]!.fire, 0.35); return true; }
    return false;
  }

  clearAround(x: number, y: number, radius: number): void {
    const rSq = radius * radius;
    for (let i = this.strands.length - 1; i >= 0; i--) {
      const s = this.strands[i]!;
      const dx = (s.a.x + s.b.x) * 0.5 - x; const dy = (s.a.y + s.b.y) * 0.5 - y;
      if (dx * dx + dy * dy <= rSq) this.strands.splice(i, 1);
    }
    this.pruneOrphanNodes();
  }

  snapshot(): WorldWebSnapshot | undefined {
    if (this.strands.length === 0) return undefined;
    return {
      nodes: this.nodes.map((n) => ({ id: n.id, x: round2(n.x), y: round2(n.y), pinned: n.pinned, ...(n.fire > 0 ? { fire: round2(n.fire) } : {}) })),
      strands: this.strands.map((s) => ({ a: s.a.id, b: s.b.id, ...(s.fire > 0 ? { fire: round2(s.fire) } : {}) })),
    };
  }
}
