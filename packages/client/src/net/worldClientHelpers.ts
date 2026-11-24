/** Shared network input builders, snapshots types, and local stealth flash helpers for WorldClient. */
import {
  sampleStealthExposure, isInSanctuary, type CharacterAppearance, type ClientMessage, type GroundLootSnapshot, type InventorySnapshot,
  type PlayerSnapshot, type ProjectileSnapshot, type WorldChestSnapshot, type WorldChunkCache, type WorldEntitySnapshot, type WorldEvent, type WorldWebSnapshot,
} from "@dc2d/engine";
import { normalizeDirection } from "./worldPrediction.js";

const ACTION_FLAG_KEYS = [
  "jump", "attack", "attackHold", "bowDraw", "bowRelease", "block", "dodge", "crouch", "throwPebble", "interact",
] as const;

export type ConnectionMode = "connecting" | "server" | "local";

export interface StepInputFrame {
  readonly move: { readonly x: number; readonly y: number }; readonly dt: number; readonly aim?: { readonly x: number; readonly y: number } | undefined;
  readonly jump?: boolean | undefined; readonly attack?: boolean | undefined; readonly attackHold?: boolean | undefined;
  readonly bowDraw?: boolean | undefined; readonly bowRelease?: boolean | undefined; readonly block?: boolean | undefined;
  readonly dodge?: boolean | undefined; readonly dodgeDir?: { readonly x: number; readonly y: number } | undefined;
  readonly crouch?: boolean | undefined; readonly throwPebble?: boolean | undefined; readonly interact?: boolean | undefined;
}

export interface WorldViewState {
  readonly mode: ConnectionMode; readonly dayPhase: number; readonly dayPaused: boolean; readonly cache: WorldChunkCache;
  readonly players: readonly PlayerSnapshot[]; readonly localPlayerId: string; readonly inventory: InventorySnapshot;
  readonly localName: string; readonly localAppearance: CharacterAppearance; readonly projectiles: readonly ProjectileSnapshot[];
  readonly entities: readonly WorldEntitySnapshot[]; readonly chests: readonly WorldChestSnapshot[];
  readonly groundLoot: readonly GroundLootSnapshot[]; readonly webs?: WorldWebSnapshot | undefined;
  readonly events: readonly WorldEvent[]; readonly selfAdmin?: boolean | undefined;
}

export function buildInputMessage(opts: {
  readonly seq: number; readonly moveDir: { readonly x: number; readonly y: number };
  readonly normAim: { readonly x: number; readonly y: number } | undefined; readonly input: StepInputFrame;
}): ClientMessage {
  const extras: Record<string, boolean> = {};
  for (const key of ACTION_FLAG_KEYS) if (opts.input[key]) extras[key] = true;
  const dodgeDir = normalizeDirection(opts.input.dodgeDir, false);
  return {
    t: "input", seq: opts.seq, moveX: opts.moveDir.x, moveY: opts.moveDir.y,
    ...(opts.normAim ? { aimX: opts.normAim.x, aimY: opts.normAim.y } : {}),
    ...(dodgeDir ? { dodgeDirX: dodgeDir.x, dodgeDirY: dodgeDir.y } : {}), ...extras,
  } as ClientMessage;
}

export function resetDisconnectedPlayer(p: PlayerSnapshot, resetId = false): PlayerSnapshot {
  return {
    ...p, ...(resetId ? { id: "local" } : {}),
    dodging: false, blocking: false, staggerTimer: 0, hitTimer: 0, respawnTimer: 0, bowCharge: 0, swingProgress: 0,
  };
}

export function bindPageDisconnect(onDisconnect: () => void): void {
  if (typeof window === "undefined") return;
  window.addEventListener("pagehide", onDisconnect);
  window.addEventListener("beforeunload", onDisconnect);
  window.addEventListener("pageshow", (ev) => { if (ev.persisted) onDisconnect(); });
}

export function applyLocalAtmosphere(opts: {
  readonly cache: WorldChunkCache; readonly player: PlayerSnapshot;
  readonly dayPhase: number; readonly attackFlash: boolean; readonly isServer: boolean;
}): PlayerSnapshot {
  const { cache, player, dayPhase, attackFlash, isServer } = opts;
  const exp = sampleStealthExposure({
    cache, x: player.x, y: player.y, dayPhase, torchLit: player.torchLit,
    crouching: Boolean(player.crouching), moving: player.moving, sprinting: Boolean(player.sprinting),
    inWater: player.inWater, attackFlash,
  });
  return {
    ...player, stealthVis: exp.visibility, inCover: exp.inCover, attackFlash,
    ...(isServer ? {} : { inSanctuary: isInSanctuary(player.x, player.y) }),
  };
}

function toggleOfflineGod(player: PlayerSnapshot, enabled?: boolean): PlayerSnapshot {
  const on = enabled ?? !player.godMode;
  return on ? { ...player, godMode: true, hp: player.maxHp ?? 100, stamina: player.maxStamina ?? 100, respawnTimer: 0 } : { ...player, godMode: false };
}

function applyOfflineHeal(player: PlayerSnapshot): PlayerSnapshot {
  return {
    ...player, hp: player.maxHp ?? 100, stamina: player.maxStamina ?? 100, respawnTimer: 0,
    bleedTimer: 0, burnTimer: 0, poisonTimer: 0, poisonLocked: false, webSlowTimer: 0, webStick: 0, cocoonProgress: 0,
  };
}

export function applyOfflineAdminPreview(player: PlayerSnapshot, req: { readonly action: string; readonly enabled?: boolean }): PlayerSnapshot {
  if (req.action === "godMode") return toggleOfflineGod(player, req.enabled);
  if (req.action === "heal") return applyOfflineHeal(player);
  if (req.action === "clearWebs") return { ...player, webStick: 0, cocoonProgress: 0, poisonLocked: false };
  return player;
}

export interface AdminSendRequest {
  readonly action: "auth" | "godMode" | "heal" | "give" | "clearWebs";
  readonly enabled?: boolean | undefined;
  readonly itemId?: string | undefined;
  readonly count?: number | undefined;
  readonly token?: string | undefined;
}

function shouldPreviewAdminAction(opts: { readonly action: AdminSendRequest["action"]; readonly isServer: boolean; readonly isAdmin: boolean }): boolean {
  return !opts.isServer || (opts.action === "godMode" && opts.isAdmin);
}

export function prepareAdminDispatch(opts: {
  readonly req: AdminSendRequest; readonly localPlayer: PlayerSnapshot;
  readonly isServer: boolean; readonly isAdmin: boolean; readonly seq: number;
}): { readonly nextPlayer: PlayerSnapshot; readonly message: ClientMessage } {
  const { req, localPlayer, isServer, isAdmin, seq } = opts;
  if (req.action === "auth") return { nextPlayer: localPlayer, message: { t: "admin", ...req, seq } };
  const enabled = req.action === "godMode" ? (req.enabled ?? !localPlayer.godMode) : req.enabled;
  const flag = enabled !== undefined ? { enabled } : {};
  const nextPlayer = shouldPreviewAdminAction({ action: req.action, isServer, isAdmin }) ? applyOfflineAdminPreview(localPlayer, { action: req.action, ...flag }) : localPlayer;
  return { nextPlayer, message: { t: "admin", ...req, ...flag, seq } };
}

export function mergeStreamEvents(opts: {
  readonly current: WorldEvent[]; readonly incoming?: readonly WorldEvent[] | undefined;
  readonly stripLocalSwing: boolean; readonly localId: string; readonly clearPending: () => void;
}): WorldEvent[] {
  const { current, incoming, stripLocalSwing, localId, clearPending } = opts;
  if (!incoming?.length) return current;
  let filtered = incoming;
  if (stripLocalSwing) {
    if (incoming.some((e) => e.kind === "swing" && e.actorId === localId)) clearPending();
    filtered = incoming.filter((e) => !(e.kind === "swing" && e.actorId === localId));
  }
  return filtered.length > 0 ? [...current.slice(-48), ...filtered] : current;
}
