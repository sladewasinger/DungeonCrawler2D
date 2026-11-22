/** WebSocket multiplayer server and health endpoint. */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  ClientMessageSchema, PROTOCOL_VERSION,
  type ClientMessage, type PlayerSnapshot, type ServerMessage, type WorldEvent,
} from "@dc2d/engine";
import { WebSocket, WebSocketServer } from "ws";
import { TICK_RATE, WorldSim } from "../sim/worldSim.js";

export interface RunningGameServer {
  readonly port: number;
  close(): Promise<void>;
}

const BROADCAST_ACTIONS = new Set<ClientMessage["t"]>([
  "hello", "setAppearance", "setDayPhase", "equipArmor", "unequipArmor", "selectHotbar", "toggleTorch",
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
  readonly events: WorldEvent[];
}

function buildClientSnapshot(input: {
  readonly sim: WorldSim; readonly playerId: string; readonly data: TickBroadcastData;
}): ServerMessage {
  return {
    t: "snapshot", tick: input.sim.tick, dayPhase: input.sim.dayPhase, dayPaused: input.sim.dayPaused,
    actionAckSeq: input.sim.actionAckSeq(input.playerId), players: input.data.players,
    selfInventory: input.sim.inventorySnapshot(input.playerId),
    projectiles: input.data.projectiles, entities: input.data.entities,
    chests: input.data.chests, groundLoot: input.data.groundLoot, events: input.data.events,
  };
}

function broadcastTickSnapshots(ctx: { readonly clients: Map<WebSocket, string>; readonly sim: WorldSim; readonly includeEvents?: boolean }): void {
  const { projectiles, entities, chests, groundLoot } = ctx.sim.combatSnapshots();
  const data: TickBroadcastData = {
    players: ctx.sim.snapshots(), projectiles, entities, chests, groundLoot,
    events: ctx.includeEvents === false ? [] : ctx.sim.drainCombatEvents(),
  };
  for (const [ws, playerId] of ctx.clients) sendJson(ws, buildClientSnapshot({ sim: ctx.sim, playerId, data }));
}

function dispatchMessage(ctx: {
  readonly msg: ClientMessage; readonly playerId: string; readonly sim: WorldSim; readonly ws: WebSocket; readonly clients: Map<WebSocket, string>;
}): void {
  const { msg, playerId, sim, ws, clients } = ctx;
  if ("seq" in msg && msg.t !== "input") sim.ackActionSeq(playerId, msg.seq);
  const handlers: Record<ClientMessage["t"], () => void> = {
    hello: () => msg.t === "hello" && (msg.appearance ? sim.setAppearance(playerId, { name: msg.name, appearance: msg.appearance }) : sim.setPlayerName(playerId, msg.name)),
    setAppearance: () => msg.t === "setAppearance" && sim.setAppearance(playerId, msg),
    input: () => msg.t === "input" && sim.queueInput(playerId, msg),
    toggleTorch: () => sim.toggleTorch(playerId),
    setDayPhase: () => msg.t === "setDayPhase" && sim.setDayPhase(msg.dayPhase, msg.paused),
    selectHotbar: () => msg.t === "selectHotbar" && sim.selectHotbar(playerId, msg.slot),
    moveSlot: () => msg.t === "moveSlot" && sim.moveSlot(playerId, msg),
    equipArmor: () => msg.t === "equipArmor" && sim.equipArmor(playerId, msg),
    unequipArmor: () => msg.t === "unequipArmor" && sim.unequipArmor(playerId, msg),
    craft: () => msg.t === "craft" && sim.craftRecipe(playerId, msg.recipeId),
  };
  handlers[msg.t]();
  if (BROADCAST_ACTIONS.has(msg.t)) broadcastTickSnapshots({ clients, sim, includeEvents: false });
  else if (msg.t !== "input") {
    const { projectiles, entities, chests, groundLoot } = sim.combatSnapshots();
    sendJson(ws, buildClientSnapshot({ sim, playerId, data: { players: sim.snapshots(), projectiles, entities, chests, groundLoot, events: [] } }));
  }
}

function handleSocketMessage(ctx: {
  readonly raw: string; readonly playerId: string; readonly sim: WorldSim; readonly ws: WebSocket; readonly clients: Map<WebSocket, string>;
}): void {
  let parsedJson: unknown;
  try { parsedJson = JSON.parse(ctx.raw); } catch { return; }
  const msg = ClientMessageSchema.safeParse(parsedJson);
  if (msg.success) dispatchMessage({ ...ctx, msg: msg.data });
}

function resolveServerConfig(options: { readonly port?: number; readonly worldSeed?: number }) {
  const port = options.port ?? Number(process.env.GAME_PORT ?? process.env.PORT ?? 4000);
  const host = process.env.GAME_HOST ?? "0.0.0.0";
  const worldSeed = options.worldSeed ?? (Number(process.env.WORLD_SEED) || 1337);
  return { port, host, worldSeed };
}

export async function startGameServer(options: { readonly port?: number; readonly worldSeed?: number } = {}): Promise<RunningGameServer> {
  const { port, host, worldSeed } = resolveServerConfig(options);
  const sim = new WorldSim(worldSeed);
  const httpServer = createServer(handleHealthRequest);
  const wss = new WebSocketServer({ server: httpServer });
  const clients = new Map<WebSocket, string>();
  wss.on("connection", (ws) => attachClient({ ws, sim, clients }));
  const timer = setInterval(() => { sim.step(1 / TICK_RATE); broadcastTickSnapshots({ clients, sim }); }, 1000 / TICK_RATE);
  await new Promise<void>((resolve) => httpServer.listen(port, host, resolve));
  const address = httpServer.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  console.log(`[game-server] listening on http://${host}:${actualPort}`);
  return { port: actualPort, close: () => new Promise((resolve) => { clearInterval(timer); wss.close(() => httpServer.close(() => resolve())); }) };
}

function attachClient(ctx: { readonly ws: WebSocket; readonly sim: WorldSim; readonly clients: Map<WebSocket, string> }): void {
  const playerId = ctx.sim.addPlayer("Traveler");
  ctx.clients.set(ctx.ws, playerId);
  sendJson(ctx.ws, { t: "welcome", playerId, worldSeed: ctx.sim.worldSeed, dayPhase: ctx.sim.dayPhase, dayPaused: ctx.sim.dayPaused, tickRate: TICK_RATE });
  ctx.ws.on("message", (buf) => handleSocketMessage({ raw: buf.toString(), playerId, sim: ctx.sim, ws: ctx.ws, clients: ctx.clients }));
  ctx.ws.on("close", () => { ctx.clients.delete(ctx.ws); ctx.sim.removePlayer(playerId); });
}
