/** Per-client AOI snapshot culling, float rounding, and inventory dirty-check helpers. */
import type {
  GroundLootSnapshot, InventorySnapshot, PlayerSnapshot, ProjectileSnapshot,
  WorldChestSnapshot, WorldEntitySnapshot, WorldEvent, WorldWebSnapshot,
} from "@dc2d/engine";

export interface BroadcastPayload {
  readonly players: PlayerSnapshot[];
  readonly projectiles: ProjectileSnapshot[];
  readonly entities: WorldEntitySnapshot[];
  readonly chests: WorldChestSnapshot[];
  readonly groundLoot: GroundLootSnapshot[];
  readonly webs?: WorldWebSnapshot | undefined;
  readonly events: WorldEvent[];
}

export const DEFAULT_AOI_RADIUS_TILES = 42;

const round2 = (v: number): number => Math.round(v * 100) / 100;
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

function withinRadius(q: { readonly ax: number; readonly ay: number; readonly px: number; readonly py: number; readonly rSq: number }): boolean {
  const dx = q.ax - q.px;
  const dy = q.ay - q.py;
  return dx * dx + dy * dy <= q.rSq;
}

function roundPlayer(p: PlayerSnapshot): PlayerSnapshot {
  return {
    ...p,
    x: round3(p.x),
    y: round3(p.y),
    facingX: round3(p.facingX),
    facingY: round3(p.facingY),
    ...(p.aimX !== undefined ? { aimX: round3(p.aimX) } : {}),
    ...(p.aimY !== undefined ? { aimY: round3(p.aimY) } : {}),
    ...(p.jumpZ !== undefined ? { jumpZ: round3(p.jumpZ) } : {}),
    ...(p.hp !== undefined ? { hp: round2(p.hp) } : {}),
    ...(p.stamina !== undefined ? { stamina: round2(p.stamina) } : {}),
  };
}

function roundEntity(e: WorldEntitySnapshot): WorldEntitySnapshot {
  return {
    ...e,
    x: round3(e.x),
    y: round3(e.y),
    facingX: round2(e.facingX),
    facingY: round2(e.facingY),
    hp: round2(e.hp),
  };
}

function roundProjectile(p: ProjectileSnapshot): ProjectileSnapshot {
  return { ...p, x: round3(p.x), y: round3(p.y), vx: round2(p.vx), vy: round2(p.vy) };
}

function filterWebs(q: { readonly webs: WorldWebSnapshot | undefined; readonly px: number; readonly py: number; readonly rSq: number }): WorldWebSnapshot | undefined {
  if (!q.webs) return undefined;
  const nodes = q.webs.nodes.filter((n) => withinRadius({ ax: n.x, ay: n.y, px: q.px, py: q.py, rSq: q.rSq }));
  const keepIds = new Set(nodes.map((n) => n.id));
  return {
    nodes,
    strands: q.webs.strands.filter((s) => keepIds.has(s.a) && keepIds.has(s.b)),
  };
}

export function inventorySignature(inv: InventorySnapshot | undefined): string {
  if (!inv) return "";
  return JSON.stringify(inv);
}

export function filterSnapshotForPlayer(opts: {
  readonly data: BroadcastPayload;
  readonly playerId: string;
  readonly aoiRadiusTiles?: number | undefined;
}): BroadcastPayload {
  const { data, playerId } = opts;
  const r = opts.aoiRadiusTiles ?? DEFAULT_AOI_RADIUS_TILES;
  const rSq = r * r;
  const players = data.players.map(roundPlayer);
  const me = players.find((p) => p.id === playerId) ?? players[0];
  if (!me) return { ...data, players };
  const { x: px, y: py } = me;
  const webs = filterWebs({ webs: data.webs, px, py, rSq });
  return {
    players,
    projectiles: data.projectiles.filter((p) => withinRadius({ ax: p.x, ay: p.y, px, py, rSq })).map(roundProjectile),
    entities: data.entities.filter((e) => withinRadius({ ax: e.x, ay: e.y, px, py, rSq })).map(roundEntity),
    chests: data.chests.filter((c) => withinRadius({ ax: c.x, ay: c.y, px, py, rSq })),
    groundLoot: data.groundLoot.filter((g) => withinRadius({ ax: g.x, ay: g.y, px, py, rSq })),
    events: data.events.filter((ev) => withinRadius({ ax: ev.x, ay: ev.y, px, py, rSq })),
    ...(webs ? { webs } : {}),
  };
}
