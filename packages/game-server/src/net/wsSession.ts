/** Per-session snapshot filtering, admin/chat command dispatch, and hello handshake helpers. */
import {
  DEFAULT_APPEARANCE, type ChatEntry, type ClientMessage, type InventorySnapshot,
  type PlayerSnapshot, type ServerMessage, type WorldDeltaSnapshot, type WorldEvent,
} from "@dc2d/engine";
import { WebSocket } from "ws";
import { TICK_RATE, type WorldSim } from "../sim/worldSim.js";
import { executeAdminSlashCommand } from "../sim/admin/adminSlashCommands.js";
import { attemptAdminAuth, type AdminAuthConfig } from "./adminAuth.js";
import { buildHubMessageHandlers, buildHubSnapshotExtras } from "./hubSessionSync.js";
import {
  createSpatialBroadcastIndex, filterSnapshotForPlayer, inventorySignature,
  populateSpatialBroadcastIndex, type SpatialBroadcastIndex,
} from "./snapshotFilter.js";
import { MAX_WS_BUFFERED_BYTES } from "./wsSecurity.js";

const sharedSpatialIndex = createSpatialBroadcastIndex();

const DUMMY_ENTITY_KINDS = new Set(["dummy", "slime-dummy", "spar-dummy"]);

export function sendJson(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  if ((ws.bufferedAmount ?? 0) > MAX_WS_BUFFERED_BYTES) {
    ws.close?.(1008, "Slow consumer");
    return;
  }
  ws.send(JSON.stringify(message));
}

export interface TickBroadcastData {
  readonly players: PlayerSnapshot[];
  readonly projectiles: ReturnType<WorldSim["combatSnapshots"]>["projectiles"];
  readonly entities: ReturnType<WorldSim["combatSnapshots"]>["entities"];
  readonly chests: ReturnType<WorldSim["combatSnapshots"]>["chests"];
  readonly groundLoot: ReturnType<WorldSim["combatSnapshots"]>["groundLoot"];
  readonly webs?: ReturnType<WorldSim["combatSnapshots"]>["webs"] | undefined;
  readonly events: WorldEvent[];
  readonly chatMessages?: ChatEntry[] | undefined;
  readonly worldDeltas: WorldDeltaSnapshot;
  readonly deltaRev: number;
  readonly spatialIndex?: SpatialBroadcastIndex | undefined;
}

export interface ClientSession {
  readonly playerId: string;
  readonly accountId: string;
  readonly clientIp?: string | undefined;
  readonly pendingAdminChat: ChatEntry[];
  sentDeltaRev: number;
  lastInvSig: string;
  lastDiscSig?: string | undefined;
  lastHubRev: number;
  hasInitialFogSent?: boolean | undefined;
  alive: boolean;
  isAdmin: boolean;
  failedAuthAttempts: number;
  readonly cleanup: () => void;
}

function syncDiscoveryIfChanged(sim: WorldSim, session: ClientSession) {
  const d = sim.discoverySnapshot(session.playerId);
  const sig = `${d.discoveredPoiIds.length}:${d.discoveredPoiKinds.length}:${d.revealedBeacons.length}`;
  if (sig === session.lastDiscSig) return undefined;
  session.lastDiscSig = sig;
  return d;
}

function syncInventoryIfChanged(sim: WorldSim, session: ClientSession): InventorySnapshot | undefined {
  const inv = sim.inventorySnapshot(session.playerId);
  const sig = inventorySignature(inv);
  if (inv === undefined || sig === session.lastInvSig) return undefined;
  session.lastInvSig = sig;
  return inv;
}

function drainSessionChat(viewChat: readonly ChatEntry[] | undefined, pending: ChatEntry[]): readonly ChatEntry[] | undefined {
  if (pending.length === 0) return viewChat;
  const adminChat = pending.splice(0);
  return [...(viewChat ?? []), ...adminChat];
}

function buildOptionalSnapshotFields(opts: {
  readonly sim: WorldSim; readonly session: ClientSession; readonly data: TickBroadcastData;
  readonly view: ReturnType<typeof filterSnapshotForPlayer>; readonly sendDeltas: boolean;
}) {
  const selfInventory = syncInventoryIfChanged(opts.sim, opts.session);
  const selfDiscovery = syncDiscoveryIfChanged(opts.sim, opts.session);
  const chatMessages = drainSessionChat(opts.view.chatMessages, opts.session.pendingAdminChat);
  return {
    ...(selfInventory ? { selfInventory } : {}),
    ...(selfDiscovery ? { selfDiscovery } : {}),
    ...buildHubSnapshotExtras(opts.sim, opts.session),
    ...(opts.session.isAdmin ? { selfAdmin: true } : {}),
    ...(chatMessages?.length ? { chatMessages: [...chatMessages] } : {}),
    ...(opts.view.webs ? { webs: opts.view.webs } : {}),
    ...(opts.sendDeltas ? { worldDeltas: opts.data.worldDeltas } : {}),
  };
}

function buildClientSnapshot(input: {
  readonly sim: WorldSim; readonly session: ClientSession; readonly data: TickBroadcastData;
}): ServerMessage {
  const sendDeltas = input.session.sentDeltaRev !== input.data.deltaRev;
  if (sendDeltas) input.session.sentDeltaRev = input.data.deltaRev;
  const view = filterSnapshotForPlayer({ data: input.data, playerId: input.session.playerId });
  return {
    t: "snapshot", tick: input.sim.tick, dayPhase: input.sim.dayPhase, dayPaused: input.sim.dayPaused,
    actionAckSeq: input.sim.actionAckSeq(input.session.playerId), players: view.players,
    projectiles: view.projectiles, entities: view.entities, chests: view.chests, groundLoot: view.groundLoot, events: view.events,
    ...buildOptionalSnapshotFields({ ...input, view, sendDeltas }),
  };
}

function makeTickBroadcastData(sim: WorldSim, includeEvents: boolean): TickBroadcastData {
  const { projectiles, entities, chests, groundLoot, webs } = sim.combatSnapshots(true);
  const chatMessages = includeEvents ? sim.drainChatMessages() : [];
  const base: TickBroadcastData = {
    players: sim.snapshots(), projectiles, entities, chests, groundLoot, ...(webs ? { webs } : {}),
    events: includeEvents ? sim.drainCombatEvents() : [],
    ...(chatMessages.length > 0 ? { chatMessages } : {}),
    worldDeltas: sim.worldDeltaSnapshot(), deltaRev: sim.cache.deltaRevision(),
  };
  return { ...base, spatialIndex: populateSpatialBroadcastIndex(sharedSpatialIndex, base) };
}

export function broadcastTickSnapshots(ctx: { readonly clients: Map<WebSocket, ClientSession>; readonly sim: WorldSim; readonly includeEvents?: boolean }): void {
  ctx.sim.drainCommands();
  const withEvents = ctx.includeEvents !== false;
  if (ctx.clients.size === 0) {
    if (withEvents) { ctx.sim.drainCombatEvents(); ctx.sim.drainChatMessages(); }
    return;
  }
  const data = makeTickBroadcastData(ctx.sim, withEvents);
  for (const [ws, session] of ctx.clients) {
    if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) { session.cleanup(); continue; }
    sendJson(ws, buildClientSnapshot({ sim: ctx.sim, session, data }));
  }
}

function handleAdminPacket(opts: {
  readonly msg: Extract<ClientMessage, { t: "admin" }>;
  readonly session: ClientSession; readonly sim: WorldSim; readonly authConfig: AdminAuthConfig;
}): void {
  if (opts.msg.action === "auth") { attemptAdminAuth(opts.session, opts.msg.token, opts.authConfig); return; }
  if (!opts.session.isAdmin) return;
  opts.sim.handleAdminAction(opts.session.playerId, { ...opts.msg, action: opts.msg.action });
}

function handleChatPacket(ctx: { readonly msg: Extract<ClientMessage, { t: "chat" }>; readonly session: ClientSession; readonly sim: WorldSim }): void {
  const { msg, session, sim } = ctx;
  const reply = session.isAdmin ? executeAdminSlashCommand(sim, session.playerId, msg.text) : null;
  if (!reply) { sim.sendChat(session.playerId, msg.text, msg.shout); return; }
  const p = sim.getPlayer(session.playerId);
  session.pendingAdminChat.push({
    id: `adm-${Date.now()}`, senderId: session.playerId, senderName: "Admin", text: reply,
    shout: true, x: p?.x ?? 0, y: p?.y ?? 0, sentAtTick: sim.tick,
  });
}

export function buildMessageHandlers(ctx: {
  readonly msg: ClientMessage; readonly session: ClientSession; readonly sim: WorldSim; readonly authConfig: AdminAuthConfig;
}): Record<ClientMessage["t"], () => void> {
  const { msg, session, sim, authConfig } = ctx;
  const { playerId } = session;
  return {
    hello: () => {},
    setAppearance: () => msg.t === "setAppearance" && sim.setAppearance(playerId, msg),
    input: () => msg.t === "input" && sim.queueInput(playerId, msg),
    respawn: () => sim.respawnPlayer(playerId),
    toggleTorch: () => sim.toggleTorch(playerId),
    setDayPhase: () => msg.t === "setDayPhase" && session.isAdmin && sim.setDayPhase(msg.dayPhase, msg.paused),
    selectHotbar: () => msg.t === "selectHotbar" && sim.selectHotbar(playerId, msg.slot),
    moveSlot: () => msg.t === "moveSlot" && sim.moveSlot(playerId, msg),
    equipArmor: () => msg.t === "equipArmor" && sim.equipArmor(playerId, msg),
    unequipArmor: () => msg.t === "unequipArmor" && sim.unequipArmor(playerId, msg),
    craft: () => msg.t === "craft" && sim.craftRecipe(playerId, msg.recipeId),
    openChest: () => msg.t === "openChest" && sim.handleChestAction(playerId, msg),
    chestTransfer: () => msg.t === "chestTransfer" && sim.handleChestAction(playerId, msg),
    chestTakeAll: () => msg.t === "chestTakeAll" && sim.handleChestAction(playerId, msg),
    placeStructure: () => msg.t === "placeStructure" && sim.placeStructure(playerId, msg),
    dismantleStructure: () => msg.t === "dismantleStructure" && sim.dismantleStructure(playerId, msg.structureId),
    setRespawnBed: () => msg.t === "setRespawnBed" && sim.setRespawnBed(playerId, msg.structureId),
    pickupLoot: () => msg.t === "pickupLoot" && sim.pickupLoot(playerId, msg.lootId),
    dropItem: () => msg.t === "dropItem" && sim.dropItem(playerId, msg),
    useItem: () => msg.t === "useItem" && sim.useItem(playerId, msg.slotIndex),
    chat: () => msg.t === "chat" && handleChatPacket({ msg, session, sim }),
    ping: () => {},
    debugSpawn: () => msg.t === "debugSpawn" && session.isAdmin && !DUMMY_ENTITY_KINDS.has(msg.kind) && sim.debugSpawnNearPlayer(playerId, msg.kind as Exclude<typeof msg.kind, "dummy" | "slime-dummy" | "spar-dummy">, msg.count),
    admin: () => msg.t === "admin" && handleAdminPacket({ msg, session, sim, authConfig }),
    ...buildHubMessageHandlers({ msg, session, sim }),
  };
}

function evictExistingSocket(clients: Map<WebSocket, ClientSession>, playerId: string): void {
  for (const [sock, sess] of clients) {
    if (sess.playerId !== playerId) continue;
    sess.cleanup();
    if (sock.readyState === WebSocket.OPEN || sock.readyState === WebSocket.CONNECTING) sock.close?.(4001, "Signed in elsewhere");
    break;
  }
}

export function completeHelloHandshake(opts: {
  readonly msg: Extract<ClientMessage, { t: "hello" }>;
  readonly ws: WebSocket; readonly sim: WorldSim; readonly clients: Map<WebSocket, ClientSession>;
  readonly authConfig: AdminAuthConfig; readonly clientIp: string | undefined; readonly cleanup: () => void;
}): ClientSession {
  const auth = opts.sim.authenticateSession({ accountId: opts.msg.accountId, resumeToken: opts.msg.resumeToken });
  const playerId = opts.sim.addPlayer(opts.msg.name, opts.msg.appearance ?? DEFAULT_APPEARANCE, {
    accountId: auth.accountId, tokenHash: auth.tokenHash, onEvict: (oldPid) => evictExistingSocket(opts.clients, oldPid),
  });
  const session: ClientSession = {
    playerId, accountId: auth.accountId, clientIp: opts.clientIp, pendingAdminChat: [],
    sentDeltaRev: -1, lastInvSig: "", lastHubRev: -1, alive: true, isAdmin: opts.authConfig.allowOpenDevAdmin, failedAuthAttempts: 0, cleanup: opts.cleanup,
  };
  opts.clients.set(opts.ws, session);
  sendJson(opts.ws, {
    t: "welcome", playerId, worldSeed: opts.sim.worldSeed, dayPhase: opts.sim.dayPhase, dayPaused: opts.sim.dayPaused, tickRate: TICK_RATE,
    ...(auth.issuedCredentials ? { accountId: auth.issuedCredentials.accountId, resumeToken: auth.issuedCredentials.resumeToken } : {}),
  });
  sendJson(opts.ws, buildClientSnapshot({ sim: opts.sim, session, data: makeTickBroadcastData(opts.sim, false) }));
  return session;
}
