/** WebSocket multiplayer server and health endpoint. */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ClientMessageSchema, PROTOCOL_VERSION, type ClientMessage, type PlayerSnapshot, type ServerMessage } from "@dc2d/engine";
import { WebSocket, WebSocketServer } from "ws";
import { TICK_RATE, WorldSim } from "../sim/worldSim.js";

export interface RunningGameServer {
  readonly port: number;
  close(): Promise<void>;
}

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

function dispatchMessage(ctx: { readonly msg: ClientMessage; readonly playerId: string; readonly sim: WorldSim }): void {
  const { msg, playerId, sim } = ctx;
  const handlers: Record<ClientMessage["t"], () => void> = {
    hello: () => msg.t === "hello" && sim.setPlayerName(playerId, msg.name),
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
}

function handleSocketMessage(input: { readonly raw: string; readonly playerId: string; readonly sim: WorldSim }): void {
  const parsedJson = safeParseJson(input.raw);
  if (!parsedJson) return;
  const msg = ClientMessageSchema.safeParse(parsedJson);
  if (!msg.success) return;
  dispatchMessage({ msg: msg.data, playerId: input.playerId, sim: input.sim });
}

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function resolveServerConfig(options: { readonly port?: number; readonly worldSeed?: number }) {
  const port = options.port ?? Number(process.env.GAME_PORT ?? process.env.PORT ?? 4000);
  const host = process.env.GAME_HOST ?? "0.0.0.0";
  const worldSeed = options.worldSeed ?? (Number(process.env.WORLD_SEED) || 1337);
  return { port, host, worldSeed };
}

function broadcastTickSnapshots(ctx: { readonly clients: Map<WebSocket, string>; readonly sim: WorldSim }): void {
  const players: PlayerSnapshot[] = ctx.sim.snapshots();
  for (const [ws, playerId] of ctx.clients) {
    sendJson(ws, {
      t: "snapshot",
      tick: ctx.sim.tick,
      dayPhase: ctx.sim.dayPhase,
      dayPaused: ctx.sim.dayPaused,
      players,
      selfInventory: ctx.sim.inventorySnapshot(playerId),
    });
  }
}

export async function startGameServer(options: { readonly port?: number; readonly worldSeed?: number } = {}): Promise<RunningGameServer> {
  const { port, host, worldSeed } = resolveServerConfig(options);
  const sim = new WorldSim(worldSeed);
  const httpServer = createServer(handleHealthRequest);
  const wss = new WebSocketServer({ server: httpServer });
  const clients = new Map<WebSocket, string>();

  wss.on("connection", (ws) => attachClient({ ws, sim, clients }));

  const timer = setInterval(() => {
    sim.step(1 / TICK_RATE);
    broadcastTickSnapshots({ clients, sim });
  }, 1000 / TICK_RATE);

  await new Promise<void>((resolve) => httpServer.listen(port, host, resolve));
  const address = httpServer.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  console.log(`[game-server] listening on http://${host}:${actualPort}`);

  return {
    port: actualPort,
    close: () =>
      new Promise((resolve) => {
        clearInterval(timer);
        wss.close(() => httpServer.close(() => resolve()));
      }),
  };
}

function attachClient(ctx: { readonly ws: WebSocket; readonly sim: WorldSim; readonly clients: Map<WebSocket, string> }): void {
  const playerId = ctx.sim.addPlayer("Traveler");
  ctx.clients.set(ctx.ws, playerId);
  sendJson(ctx.ws, {
    t: "welcome",
    playerId,
    worldSeed: ctx.sim.worldSeed,
    dayPhase: ctx.sim.dayPhase,
    dayPaused: ctx.sim.dayPaused,
    tickRate: TICK_RATE,
  });
  ctx.ws.on("message", (buf) => handleSocketMessage({ raw: buf.toString(), playerId, sim: ctx.sim }));
  ctx.ws.on("close", () => {
    ctx.clients.delete(ctx.ws);
    ctx.sim.removePlayer(playerId);
  });
}
