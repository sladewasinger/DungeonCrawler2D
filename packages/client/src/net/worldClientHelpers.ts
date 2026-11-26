/** Shared network input builders, snapshots types, and local stealth flash helpers for WorldClient. */
import {
  sampleStealthExposure, isInSanctuary, type CharacterAppearance, type ChatEntry, type ClientMessage, type DiscoveryStateSnapshot,
  type GroundLootSnapshot, type InventorySnapshot, type PlayerSnapshot, type ProjectileSnapshot, type WorldChestSnapshot,
  type WorldChunkCache, type WorldEntitySnapshot, type WorldEvent, type WorldWebSnapshot,
} from "@dc2d/engine";
import { normalizeDirection } from "./worldPrediction.js";

const ACTION_FLAG_KEYS = [
  "jump", "attack", "attackHold", "bowDraw", "bowRelease", "block", "dodge", "crouch", "throwPebble", "interact",
] as const;

export type ConnectionMode = "idle" | "connecting" | "server" | "reconnecting";

const RECONNECT_BACKOFF_MS = [1000, 1500, 2500, 4000, 5000] as const;

export function nextReconnectDelayMs(attempt: number): number {
  const idx = Math.min(Math.max(0, Math.floor(attempt)), RECONNECT_BACKOFF_MS.length - 1);
  return RECONNECT_BACKOFF_MS[idx] ?? 5000;
}

export interface StepInputFrame {
  readonly move: { readonly x: number; readonly y: number }; readonly dt: number; readonly aim?: { readonly x: number; readonly y: number } | undefined;
  readonly jump?: boolean | undefined; readonly attack?: boolean | undefined; readonly attackHold?: boolean | undefined;
  readonly bowDraw?: boolean | undefined; readonly bowRelease?: boolean | undefined; readonly block?: boolean | undefined;
  readonly dodge?: boolean | undefined; readonly dodgeDir?: { readonly x: number; readonly y: number } | undefined;
  readonly crouch?: boolean | undefined; readonly throwPebble?: boolean | undefined; readonly interact?: boolean | undefined;
}

export interface WorldViewState {
  readonly mode: ConnectionMode; readonly reconnectAttempt?: number | undefined;
  readonly dayPhase: number; readonly dayPaused: boolean; readonly cache: WorldChunkCache;
  readonly players: readonly PlayerSnapshot[]; readonly localPlayerId: string; readonly inventory: InventorySnapshot;
  readonly localName: string; readonly localAppearance: CharacterAppearance; readonly projectiles: readonly ProjectileSnapshot[];
  readonly entities: readonly WorldEntitySnapshot[]; readonly chests: readonly WorldChestSnapshot[];
  readonly groundLoot: readonly GroundLootSnapshot[]; readonly webs?: WorldWebSnapshot | undefined;
  readonly events: readonly WorldEvent[]; readonly chatMessages?: readonly ChatEntry[] | undefined;
  readonly discovery?: DiscoveryStateSnapshot | undefined;
  readonly selfAdmin?: boolean | undefined; readonly pingMs?: number | null | undefined;
}

export interface InputSendState {
  readonly sentAtMs: number;
  readonly mx: number;
  readonly my: number;
  readonly ax: number;
  readonly ay: number;
  readonly heldMask: number;
}

export const INITIAL_INPUT_SEND_STATE: InputSendState = { sentAtMs: -1000, mx: 0, my: 0, ax: 0, ay: 0, heldMask: 0 };

const round3 = (n: number): number => Math.round(n * 1000) / 1000;
const quant2 = (n: number): number => Math.round(n * 100);

function heldMaskForInput(input: StepInputFrame): number {
  const b1 = input.attackHold ? 1 : 0;
  const b2 = input.bowDraw ? 2 : 0;
  const b3 = input.block ? 4 : 0;
  return b1 | b2 | b3 | (input.crouch ? 8 : 0);
}

function hasDiscreteAction(input: StepInputFrame): boolean {
  return Boolean(input.jump || input.attack || input.bowRelease || input.dodge || input.throwPebble || input.interact);
}

function computeNextSendState(opts: {
  readonly nowMs: number;
  readonly moveDir: { readonly x: number; readonly y: number };
  readonly normAim: { readonly x: number; readonly y: number } | undefined;
  readonly input: StepInputFrame;
}): InputSendState {
  return {
    sentAtMs: opts.nowMs,
    mx: quant2(opts.moveDir.x),
    my: quant2(opts.moveDir.y),
    ax: opts.normAim ? quant2(opts.normAim.x) : 0,
    ay: opts.normAim ? quant2(opts.normAim.y) : 0,
    heldMask: heldMaskForInput(opts.input),
  };
}

const isActiveInput = (s: InputSendState): boolean => s.mx !== 0 || s.my !== 0 || s.heldMask !== 0;

function moveToggled(prev: InputSendState, cand: InputSendState): boolean {
  return (cand.mx === 0 && cand.my === 0) !== (prev.mx === 0 && prev.my === 0);
}

function aimOrMoveChanged(prev: InputSendState, cand: InputSendState): boolean {
  return cand.mx !== prev.mx || cand.my !== prev.my || cand.ax !== prev.ax || cand.ay !== prev.ay;
}

function inputNeedsFlush(prev: InputSendState, cand: InputSendState, input: StepInputFrame): boolean {
  if (hasDiscreteAction(input) || cand.heldMask !== prev.heldMask || moveToggled(prev, cand)) return true;
  const elapsed = cand.sentAtMs - prev.sentAtMs;
  if (aimOrMoveChanged(prev, cand) && elapsed >= 33) return true;
  return elapsed >= (isActiveInput(cand) ? 45 : 200);
}

export function closeSocketSafely(ws: WebSocket | null, reason?: string): void {
  if (!ws) return;
  try { ws.close(reason ? 1000 : undefined, reason); } catch { /* closing */ }
}

export function shouldSendInputFrame(opts: {
  readonly prev: InputSendState;
  readonly nowMs: number;
  readonly moveDir: { readonly x: number; readonly y: number };
  readonly normAim: { readonly x: number; readonly y: number } | undefined;
  readonly input: StepInputFrame;
}): { readonly send: boolean; readonly next: InputSendState } {
  const cand = computeNextSendState(opts);
  const send = inputNeedsFlush(opts.prev, cand, opts.input);
  return { send, next: send ? cand : opts.prev };
}

export function smoothPingRtt(prevMs: number | null, sampleMs: number): number {
  const clamped = Math.max(0, Math.round(sampleMs));
  return prevMs === null ? clamped : Math.round(prevMs * 0.7 + clamped * 0.3);
}

export function buildInputMessage(opts: {
  readonly seq: number; readonly moveDir: { readonly x: number; readonly y: number };
  readonly normAim: { readonly x: number; readonly y: number } | undefined; readonly input: StepInputFrame;
}): ClientMessage {
  const extras: Record<string, boolean> = {};
  for (const key of ACTION_FLAG_KEYS) if (opts.input[key]) extras[key] = true;
  const dodgeDir = normalizeDirection(opts.input.dodgeDir, false);
  return {
    t: "input", seq: opts.seq, moveX: round3(opts.moveDir.x), moveY: round3(opts.moveDir.y),
    ...(opts.normAim ? { aimX: round3(opts.normAim.x), aimY: round3(opts.normAim.y) } : {}),
    ...(dodgeDir ? { dodgeDirX: round3(dodgeDir.x), dodgeDirY: round3(dodgeDir.y) } : {}), ...extras,
  } as ClientMessage;
}

export function resetDisconnectedPlayer(p: PlayerSnapshot, resetId = false): PlayerSnapshot {
  return {
    ...p, ...(resetId ? { id: "local" } : {}),
    dodging: false, blocking: false, staggerTimer: 0, hitTimer: 0, respawnTimer: 0, bowCharge: 0, swingProgress: 0,
  };
}

export function bindPageLifecycle(hooks: {
  readonly onUnload: () => void;
  readonly onResume: () => void;
}): () => void {
  if (typeof window === "undefined") return () => {};
  const handleVis = (): void => {
    if (typeof document === "undefined" || document.visibilityState === "visible") hooks.onResume();
  };
  window.addEventListener("beforeunload", hooks.onUnload);
  window.addEventListener("pageshow", hooks.onResume);
  window.addEventListener("focus", hooks.onResume);
  window.addEventListener("online", hooks.onResume);
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", handleVis);
  return () => {
    window.removeEventListener("beforeunload", hooks.onUnload);
    window.removeEventListener("pageshow", hooks.onResume);
    window.removeEventListener("focus", hooks.onResume);
    window.removeEventListener("online", hooks.onResume);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", handleVis);
  };
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
