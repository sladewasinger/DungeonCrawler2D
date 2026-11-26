/** WebSocket multiplayer server and health endpoint. */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  ClientMessageSchema, PROTOCOL_VERSION,
  type ChatEntry, type ClientMessage, type InventorySnapshot, type PlayerSnapshot,
  type ServerMessage, type WorldDeltaSnapshot, type WorldEvent,
} from "@dc2d/engine";
import { WebSocket, WebSocketServer } from "ws";
import { TICK_RATE, WorldSim } from "../sim/worldSim.js";
import { attemptAdminAuth, resolveAdminAuthConfig, type AdminAuthConfig } from "./adminAuth.js";
import { filterSnapshotForPlayer, inventorySignature } from "./snapshotFilter.js";

export interface RunningGameServer {
  readonly port: number;
  close(): Promise<void>;
}

const DUMMY_ENTITY_KINDS = new Set(["dummy", "slime-dummy", "spar-dummy"]);

const BROADCAST_ACTIONS = new Set<ClientMessage["t"]>([
  "hello", "setAppearance", "respawn", "setDayPhase", "equipArmor", "unequipArmor", "selectHotbar", "toggleTorch", "placeStructure", "setRespawnBed", "pickupLoot", "dropItem", "useItem", "chat", "admin",
]);

function handleHealthRequest(req: IncomingMessage, res: ServerResponse): void {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, protocol: PROTOCOL_VERSION }));
    return;
  }
  res.writeHead(404);
  res.end("Not found");
}

function sendJson(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

interface TickBroadcastData {
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
}

export interface ClientSession {
  readonly playerId: string;
  sentDeltaRev: number;
  lastInvSig: string;
  lastDiscSig?: string | undefined;
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

function buildClientSnapshot(input: {
  readonly sim: WorldSim; readonly session: ClientSession; readonly data: TickBroadcastData;
}): ServerMessage {
  const sendDeltas = input.session.sentDeltaRev !== input.data.deltaRev;
  if (sendDeltas) input.session.sentDeltaRev = input.data.deltaRev;
  const selfInventory = syncInventoryIfChanged(input.sim, input.session);
  const selfDiscovery = syncDiscoveryIfChanged(input.sim, input.session);
  const view = filterSnapshotForPlayer({ data: input.data, playerId: input.session.playerId });
  return {
    t: "snapshot", tick: input.sim.tick, dayPhase: input.sim.dayPhase, dayPaused: input.sim.dayPaused,
    actionAckSeq: input.sim.actionAckSeq(input.session.playerId), players: view.players,
    ...(selfInventory ? { selfInventory } : {}),
    ...(selfDiscovery ? { selfDiscovery } : {}),
    ...(input.session.isAdmin ? { selfAdmin: true } : {}),
    projectiles: view.projectiles, entities: view.entities,
    chests: view.chests, groundLoot: view.groundLoot, events: view.events,
    ...(view.chatMessages ? { chatMessages: view.chatMessages } : {}),
    ...(view.webs ? { webs: view.webs } : {}),
    ...(sendDeltas ? { worldDeltas: input.data.worldDeltas } : {}),
  };
}

function makeTickBroadcastData(sim: WorldSim, includeEvents: boolean): TickBroadcastData {
  const { projectiles, entities, chests, groundLoot, webs } = sim.combatSnapshots();
  const chatMessages = includeEvents ? sim.drainChatMessages() : [];
  return {
    players: sim.snapshots(), projectiles, entities, chests, groundLoot, ...(webs ? { webs } : {}),
    events: includeEvents ? sim.drainCombatEvents() : [],
    ...(chatMessages.length > 0 ? { chatMessages } : {}),
    worldDeltas: sim.worldDeltaSnapshot(), deltaRev: sim.cache.deltaRevision(),
  };
}

function broadcastTickSnapshots(ctx: { readonly clients: Map<WebSocket, ClientSession>; readonly sim: WorldSim; readonly includeEvents?: boolean }): void {
  const data = makeTickBroadcastData(ctx.sim, ctx.includeEvents !== false);
  for (const [ws, session] of ctx.clients) {
    if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) { session.cleanup(); continue; }
    sendJson(ws, buildClientSnapshot({ sim: ctx.sim, session, data }));
  }
}

function handleAdminPacket(opts: {
  readonly msg: Extract<ClientMessage, { t: "admin" }>;
  readonly session: ClientSession; readonly sim: WorldSim; readonly authConfig: AdminAuthConfig;
}): boolean {
  if (opts.msg.action === "auth") { attemptAdminAuth(opts.session, opts.msg.token, opts.authConfig); return false; }
  if (!opts.session.isAdmin) return false;
  opts.sim.handleAdminAction(opts.session.playerId, { ...opts.msg, action: opts.msg.action });
  return true;
}

function buildMessageHandlers(ctx: {
  readonly msg: ClientMessage; readonly session: ClientSession; readonly sim: WorldSim;
  readonly authConfig: AdminAuthConfig; readonly onSkipBroadcast: () => void;
}): Record<ClientMessage["t"], () => void> {
  const { msg, session, sim, authConfig, onSkipBroadcast } = ctx;
  const { playerId } = session;
  return {
    hello: () => msg.t === "hello" && (msg.appearance ? sim.setAppearance(playerId, { name: msg.name, appearance: msg.appearance }) : sim.setPlayerName(playerId, msg.name)),
    setAppearance: () => msg.t === "setAppearance" && sim.setAppearance(playerId, msg),
    input: () => msg.t === "input" && sim.queueInput(playerId, msg),
    respawn: () => sim.respawnPlayer(playerId),
    toggleTorch: () => sim.toggleTorch(playerId),
    setDayPhase: () => { if (msg.t === "setDayPhase" && session.isAdmin) sim.setDayPhase(msg.dayPhase, msg.paused); else onSkipBroadcast(); },
    selectHotbar: () => msg.t === "selectHotbar" && sim.selectHotbar(playerId, msg.slot),
    moveSlot: () => msg.t === "moveSlot" && sim.moveSlot(playerId, msg),
    equipArmor: () => msg.t === "equipArmor" && sim.equipArmor(playerId, msg),
    unequipArmor: () => msg.t === "unequipArmor" && sim.unequipArmor(playerId, msg),
    craft: () => msg.t === "craft" && sim.craftRecipe(playerId, msg.recipeId),
    openChest: () => msg.t === "openChest" && sim.handleChestAction(playerId, msg),
    chestTransfer: () => msg.t === "chestTransfer" && sim.handleChestAction(playerId, msg),
    chestTakeAll: () => msg.t === "chestTakeAll" && sim.handleChestAction(playerId, msg),
    placeStructure: () => msg.t === "placeStructure" && sim.placeStructure(playerId, msg),
    setRespawnBed: () => msg.t === "setRespawnBed" && sim.setRespawnBed(playerId, msg.structureId),
    pickupLoot: () => msg.t === "pickupLoot" && sim.pickupLoot(playerId, msg.lootId),
    dropItem: () => msg.t === "dropItem" && sim.dropItem(playerId, msg),
    useItem: () => msg.t === "useItem" && sim.useItem(playerId, msg.slotIndex),
    chat: () => msg.t === "chat" && sim.sendChat(playerId, msg.text, msg.shout),
    ping: () => {},
    debugSpawn: () => msg.t === "debugSpawn" && session.isAdmin && !DUMMY_ENTITY_KINDS.has(msg.kind) && sim.debugSpawnNearPlayer(playerId, msg.kind as Exclude<typeof msg.kind, "dummy" | "slime-dummy" | "spar-dummy">, msg.count),
    admin: () => { if (msg.t === "admin" && !handleAdminPacket({ msg, session, sim, authConfig })) onSkipBroadcast(); },
  };
}

function dispatchMessage(ctx: {
  readonly msg: ClientMessage; readonly session: ClientSession; readonly sim: WorldSim;
  readonly ws: WebSocket; readonly clients: Map<WebSocket, ClientSession>; readonly authConfig: AdminAuthConfig;
}): void {
  const { msg, session, sim, ws, clients, authConfig } = ctx;
  if (msg.t === "ping") { sendJson(ws, { t: "pong", t0: msg.t0 }); return; }
  if ("seq" in msg && msg.t !== "input") sim.ackActionSeq(session.playerId, msg.seq);
  let shouldBroadcast = BROADCAST_ACTIONS.has(msg.t);
  const handlers = buildMessageHandlers({ msg, session, sim, authConfig, onSkipBroadcast: () => { shouldBroadcast = false; } });
  handlers[msg.t]();
  if (shouldBroadcast) broadcastTickSnapshots({ clients, sim, includeEvents: false });
  else if (msg.t !== "input") sendJson(ws, buildClientSnapshot({ sim, session, data: makeTickBroadcastData(sim, false) }));
}

function handleSocketMessage(ctx: {
  readonly raw: string; readonly session: ClientSession; readonly sim: WorldSim;
  readonly ws: WebSocket; readonly clients: Map<WebSocket, ClientSession>; readonly authConfig: AdminAuthConfig;
}): void {
  let parsedJson: unknown;
  try { parsedJson = JSON.parse(ctx.raw); } catch { return; }
  const msg = ClientMessageSchema.safeParse(parsedJson);
  if (msg.success) dispatchMessage({ ...ctx, msg: msg.data });
}

function resolveSavePath(explicit?: string): string | undefined {
  if (explicit !== undefined) return explicit;
  return process.env.WORLD_SAVE_PATH === "none" ? undefined : process.env.WORLD_SAVE_PATH;
}

function resolveServerConfig(options: { readonly port?: number; readonly worldSeed?: number; readonly savePath?: string | undefined }) {
  const port = options.port ?? Number(process.env.GAME_PORT ?? process.env.PORT ?? 4000);
  const host = process.env.GAME_HOST ?? "0.0.0.0";
  const worldSeed = options.worldSeed ?? (Number(process.env.WORLD_SEED) || 1337);
  return { port, host, worldSeed, savePath: resolveSavePath(options.savePath) };
}

function sweepDeadClients(clients: Map<WebSocket, ClientSession>): void {
  for (const [ws, session] of clients) {
    if (!session.alive || ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
      session.cleanup();
      ws.terminate();
      continue;
    }
    session.alive = false;
    if (ws.readyState === WebSocket.OPEN) ws.ping();
  }
}

export async function startGameServer(
  options: { readonly port?: number; readonly worldSeed?: number; readonly savePath?: string | undefined; readonly adminAuth?: AdminAuthConfig | undefined } = {},
): Promise<RunningGameServer> {
  const { port, host, worldSeed, savePath } = resolveServerConfig(options);
  const authConfig = options.adminAuth ?? resolveAdminAuthConfig();
  const sim = new WorldSim(worldSeed, { persistencePath: savePath });
  const httpServer = createServer(handleHealthRequest);
  const wss = new WebSocketServer({ server: httpServer });
  const clients = new Map<WebSocket, ClientSession>();
  wss.on("connection", (ws, req) => {
    req.socket?.setNoDelay?.(true);
    attachClient({ ws, sim, clients, authConfig });
  });
  const timer = setInterval(() => { sim.step(1 / TICK_RATE); broadcastTickSnapshots({ clients, sim }); }, 1000 / TICK_RATE);
  const heartbeat = setInterval(() => sweepDeadClients(clients), 5000);
  await new Promise<void>((resolve) => httpServer.listen(port, host, resolve));
  const address = httpServer.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  console.log(`[game-server] listening on http://${host}:${actualPort}`);
  return {
    port: actualPort,
    close: () => new Promise((resolve) => {
      clearInterval(timer); clearInterval(heartbeat);
      sim.savePersistenceNow(); wss.close(() => httpServer.close(() => resolve()));
    }),
  };
}

export function attachClient(ctx: { readonly ws: WebSocket; readonly sim: WorldSim; readonly clients: Map<WebSocket, ClientSession>; readonly authConfig: AdminAuthConfig }): void {
  const playerId = ctx.sim.addPlayer("Traveler");
  let cleaned = false;
  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    ctx.clients.delete(ctx.ws);
    ctx.sim.removePlayer(playerId);
  };
  const session: ClientSession = { playerId, sentDeltaRev: -1, lastInvSig: "", alive: true, isAdmin: ctx.authConfig.allowOpenDevAdmin, failedAuthAttempts: 0, cleanup };
  ctx.clients.set(ctx.ws, session);
  sendJson(ctx.ws, { t: "welcome", playerId, worldSeed: ctx.sim.worldSeed, dayPhase: ctx.sim.dayPhase, dayPaused: ctx.sim.dayPaused, tickRate: TICK_RATE });
  ctx.ws.on("pong", () => { session.alive = true; });
  ctx.ws.on("message", (buf) => {
    session.alive = true;
    handleSocketMessage({ raw: buf.toString(), session, sim: ctx.sim, ws: ctx.ws, clients: ctx.clients, authConfig: ctx.authConfig });
  });
  ctx.ws.on("close", cleanup);
  ctx.ws.on("error", cleanup);
}
