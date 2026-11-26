/** Per-client AOI snapshot culling, float rounding, proximity chat filtering, and inventory dirty-check helpers. */
import type {
  ChatEntry, GroundLootSnapshot, InventorySnapshot, PlayerSnapshot, ProjectileSnapshot,
  WorldChestSnapshot, WorldEntitySnapshot, WorldEvent, WorldWebSnapshot,
} from "@dc2d/engine";
import { isWithinChatRadius } from "../sim/chat/proximityChat.js";

export interface BroadcastPayload {
  readonly players: PlayerSnapshot[];
  readonly projectiles: ProjectileSnapshot[];
  readonly entities: WorldEntitySnapshot[];
  readonly chests: WorldChestSnapshot[];
  readonly groundLoot: GroundLootSnapshot[];
  readonly webs?: WorldWebSnapshot | undefined;
  readonly events: WorldEvent[];
  readonly chatMessages?: ChatEntry[] | undefined;
}

export const DEFAULT_AOI_RADIUS_TILES = 42;
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
  const me = data.players.find((p) => p.id === playerId) ?? data.players[0];
  if (!me) return { ...data, players: data.players.map((p) => roundPlayer(p, playerId)) };
  const { x: px, y: py } = me;
  const players = data.players
    .filter((p) => playerVisibleInAoi({ p, selfId: me.id, px, py, r }))
    .map((p) => roundPlayer(p, me.id, { x: px, y: py }));
  const webs = filterWebs({ webs: data.webs, px, py, rSq });
  const chatMessages = data.chatMessages?.filter((m) => isWithinChatRadius({ ax: m.x, ay: m.y, bx: px, by: py, shout: m.shout }));
  return {
    players,
    projectiles: data.projectiles.filter((p) => withinRadius({ ax: p.x, ay: p.y, px, py, rSq })).map(roundProjectile),
    entities: data.entities.filter((e) => withinRadius({ ax: e.x, ay: e.y, px, py, rSq })).map(roundEntity),
    chests: data.chests.filter((c) => withinRadius({ ax: c.x, ay: c.y, px, py, rSq })).map(redactChest),
    groundLoot: data.groundLoot.filter((g) => withinRadius({ ax: g.x, ay: g.y, px, py, rSq })),
    events: data.events.filter((ev) => withinRadius({ ax: ev.x, ay: ev.y, px, py, rSq })),
    ...(chatMessages && chatMessages.length > 0 ? { chatMessages } : {}),
    ...(webs ? { webs } : {}),
  };
}
