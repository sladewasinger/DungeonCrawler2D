/** Per-client AOI snapshot culling, float rounding, proximity chat filtering, and inventory dirty-check helpers. */
import {
  SpatialHashGrid,
  type ChatEntry, type GroundLootSnapshot, type InventorySnapshot, type PlayerSnapshot, type ProjectileSnapshot,
  type WorldChestSnapshot, type WorldEntitySnapshot, type WorldEvent, type WorldWebSnapshot,
} from "@dc2d/engine";
import { isWithinChatRadius } from "../sim/chat/proximityChat.js";

export interface SpatialBroadcastIndex {
  readonly players: SpatialHashGrid<PlayerSnapshot>;
  readonly projectiles: SpatialHashGrid<ProjectileSnapshot>;
  readonly entities: SpatialHashGrid<WorldEntitySnapshot>;
  readonly chests: SpatialHashGrid<WorldChestSnapshot>;
  readonly groundLoot: SpatialHashGrid<GroundLootSnapshot>;
  readonly events: SpatialHashGrid<WorldEvent>;
}

export interface BroadcastPayload {
  readonly players: PlayerSnapshot[];
  readonly projectiles: ProjectileSnapshot[];
  readonly entities: WorldEntitySnapshot[];
  readonly chests: WorldChestSnapshot[];
  readonly groundLoot: GroundLootSnapshot[];
  readonly webs?: WorldWebSnapshot | undefined;
  readonly events: WorldEvent[];
  readonly chatMessages?: ChatEntry[] | undefined;
  readonly spatialIndex?: SpatialBroadcastIndex | undefined;
}

export function createSpatialBroadcastIndex(): SpatialBroadcastIndex {
  return {
    players: new SpatialHashGrid(32),
    projectiles: new SpatialHashGrid(32),
    entities: new SpatialHashGrid(32),
    chests: new SpatialHashGrid(32),
    groundLoot: new SpatialHashGrid(32),
    events: new SpatialHashGrid(32),
  };
}

export function populateSpatialBroadcastIndex(idx: SpatialBroadcastIndex, data: BroadcastPayload): SpatialBroadcastIndex {
  idx.players.clear(); idx.players.insertAll(data.players);
  idx.projectiles.clear(); idx.projectiles.insertAll(data.projectiles);
  idx.entities.clear(); idx.entities.insertAll(data.entities);
  idx.chests.clear(); idx.chests.insertAll(data.chests);
  idx.groundLoot.clear(); idx.groundLoot.insertAll(data.groundLoot);
  idx.events.clear(); idx.events.insertAll(data.events);
  return idx;
}

const DEFAULT_AOI_RADIUS_TILES = 42;
const MIN_STEALTH_PLAYER_AOI = 12;
const REDACTED_CHEST_SLOTS = Array.from({ length: 27 }, () => null);

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const round2 = (v: number): number => Math.round(v * 100) / 100;
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

function withinRadius(q: { readonly ax: number; readonly ay: number; readonly px: number; readonly py: number; readonly rSq: number }): boolean {
  const dx = q.ax - q.px;
  const dy = q.ay - q.py;
  return dx * dx + dy * dy <= q.rSq;
}

function playerVisibleInAoi(opts: {
  readonly p: PlayerSnapshot; readonly selfId: string; readonly px: number; readonly py: number; readonly r: number;
}): boolean {
  if (opts.p.id === opts.selfId) return true;
  const effR = opts.p.crouching && !opts.p.attackFlash
    ? Math.max(MIN_STEALTH_PLAYER_AOI, opts.r * clamp01(opts.p.stealthVis ?? 1))
    : opts.r;
  return withinRadius({ ax: opts.p.x, ay: opts.p.y, px: opts.px, py: opts.py, rSq: effR * effR });
}

function redactChest(c: WorldChestSnapshot): WorldChestSnapshot {
  return c.opened && !c.sealed ? c : { ...c, slots: REDACTED_CHEST_SLOTS };
}

function shouldShowBubble(p: PlayerSnapshot, recipient?: { readonly x: number; readonly y: number }): boolean {
  if (!p.activeBubble) return false;
  if (!recipient) return true;
  return isWithinChatRadius({ ax: p.x, ay: p.y, bx: recipient.x, by: recipient.y, shout: p.activeBubble.shout });
}

function stripRemotePrivateFields(out: { -readonly [K in keyof PlayerSnapshot]: PlayerSnapshot[K] }): void {
  delete out.stamina;
  delete out.maxStamina;
  delete out.hasBedRespawn;
  delete out.wellFedTimer;
  delete out.restedTimer;
  delete out.godMode;
}

type MutablePlayer = { -readonly [K in keyof PlayerSnapshot]: PlayerSnapshot[K] };

function applyRoundedOptionalFields(out: MutablePlayer, p: PlayerSnapshot, isSelf: boolean): void {
  if (p.aimX !== undefined) out.aimX = round3(p.aimX);
  if (p.aimY !== undefined) out.aimY = round3(p.aimY);
  if (p.jumpZ !== undefined) out.jumpZ = round3(p.jumpZ);
  if (p.hp !== undefined) out.hp = round2(p.hp);
  if (isSelf && p.stamina !== undefined) out.stamina = round2(p.stamina);
}

function roundPlayer(p: PlayerSnapshot, selfId?: string, recipient?: { readonly x: number; readonly y: number }): PlayerSnapshot {
  const isSelf = !selfId || p.id === selfId;
  const out: MutablePlayer = { ...p, x: round3(p.x), y: round3(p.y), facingX: round3(p.facingX), facingY: round3(p.facingY) };
  applyRoundedOptionalFields(out, p, isSelf);
  if (!isSelf) stripRemotePrivateFields(out);
  if (!shouldShowBubble(p, recipient)) delete out.activeBubble;
  return out;
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

const ARMOR_SIG_KEYS = ["head", "chest", "legs", "feet", "offhand"] as const;

function slotsSig(slots: InventorySnapshot["slots"]): string {
  let out = "";
  for (const s of slots) out += s ? `${s.itemId}:${s.count}:${s.prefixId ?? ""};` : ";";
  return out;
}

export function inventorySignature(inv: InventorySnapshot | undefined): string {
  if (!inv) return "";
  const armor = ARMOR_SIG_KEYS.map((k) => inv.armor[k] ?? "").join(",");
  return `${inv.selectedHotbar}|${inv.nearCampfire ? 1 : 0}|${inv.nearWorkbench ? 1 : 0}|${inv.ackSeq ?? 0}|${slotsSig(inv.slots)}|${armor}`;
}

function queryAoiPlayers(opts: {
  readonly data: BroadcastPayload; readonly me: PlayerSnapshot; readonly r: number;
}): PlayerSnapshot[] {
  const { data, me, r } = opts;
  const pool = data.spatialIndex ? data.spatialIndex.players.queryRadius({ x: me.x, y: me.y, radius: r }) : data.players;
  const out = pool
    .filter((p) => playerVisibleInAoi({ p, selfId: me.id, px: me.x, py: me.y, r }))
    .map((p) => roundPlayer(p, me.id, { x: me.x, y: me.y }));
  if (!out.some((p) => p.id === me.id)) out.unshift(roundPlayer(me, me.id, { x: me.x, y: me.y }));
  return out;
}

function queryBucket<T extends { readonly x: number; readonly y: number }>(
  grid: SpatialHashGrid<T> | undefined,
  fallback: readonly T[],
  q: { readonly px: number; readonly py: number; readonly r: number; readonly rSq: number },
): readonly T[] {
  if (grid) return grid.queryRadius({ x: q.px, y: q.py, radius: q.r });
  return fallback.filter((item) => withinRadius({ ax: item.x, ay: item.y, px: q.px, py: q.py, rSq: q.rSq }));
}

function buildOptionalViewFields(opts: {
  readonly data: BroadcastPayload; readonly me: PlayerSnapshot; readonly rSq: number;
}): Pick<BroadcastPayload, "webs" | "chatMessages"> {
  const webs = filterWebs({ webs: opts.data.webs, px: opts.me.x, py: opts.me.y, rSq: opts.rSq });
  const chat = opts.data.chatMessages?.filter((m) => isWithinChatRadius({ ax: m.x, ay: m.y, bx: opts.me.x, by: opts.me.y, shout: m.shout }));
  return {
    ...(chat && chat.length > 0 ? { chatMessages: chat } : {}),
    ...(webs ? { webs } : {}),
  };
}

function buildCoreSnapshotEntities(opts: {
  readonly data: BroadcastPayload; readonly me: PlayerSnapshot; readonly r: number; readonly rSq: number;
}): BroadcastPayload {
  const { data, me, r, rSq } = opts;
  const idx = data.spatialIndex;
  const q = { px: me.x, py: me.y, r, rSq };
  return {
    players: queryAoiPlayers({ data, me, r }),
    projectiles: queryBucket(idx?.projectiles, data.projectiles, q).map(roundProjectile),
    entities: queryBucket(idx?.entities, data.entities, q).map(roundEntity),
    chests: queryBucket(idx?.chests, data.chests, q).map(redactChest),
    groundLoot: [...queryBucket(idx?.groundLoot, data.groundLoot, q)],
    events: [...queryBucket(idx?.events, data.events, q)],
  };
}

export function filterSnapshotForPlayer(opts: {
  readonly data: BroadcastPayload;
  readonly playerId: string;
  readonly aoiRadiusTiles?: number | undefined;
}): BroadcastPayload {
  const { data, playerId } = opts;
  const r = opts.aoiRadiusTiles ?? DEFAULT_AOI_RADIUS_TILES;
  const me = data.players.find((p) => p.id === playerId) ?? data.players[0];
  if (!me) return { ...data, players: data.players.map((p) => roundPlayer(p, playerId)) };
  const rSq = r * r;
  return { ...buildCoreSnapshotEntities({ data, me, r, rSq }), ...buildOptionalViewFields({ data, me, rSq }) };
}
