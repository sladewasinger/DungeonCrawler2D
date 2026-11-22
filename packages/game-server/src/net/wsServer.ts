/** WebSocket multiplayer server and health endpoint. */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ClientMessageSchema, PROTOCOL_VERSION, type ServerMessage } from "@dc2d/engine";
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

function handleSocketMessage(input: {
  readonly raw: string;
  readonly playerId: string;
  readonly sim: WorldSim;
}): void {
  const parsedJson = safeParseJson(input.raw);
  if (!parsedJson) return;
  const msg = ClientMessageSchema.safeParse(parsedJson);
  if (!msg.success) return;
  const data = msg.data;
  if (data.t === "input") input.sim.queueInput(input.playerId, data);
  else if (data.t === "toggleTorch") input.sim.toggleTorch(input.playerId);
  else if (data.t === "setDayPhase") input.sim.setDayPhase(data.dayPhase, data.paused);
}

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function startGameServer(options: { readonly port?: number; readonly worldSeed?: number } = {}): Promise<RunningGameServer> {
  const port = options.port ?? Number(process.env.GAME_PORT ?? 4000);
  const sim = new WorldSim(options.worldSeed ?? 1337);
  const httpServer = createServer(handleHealthRequest);
  const wss = new WebSocketServer({ server: httpServer });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => attachClient({ ws, sim, clients }));

  const timer = setInterval(() => {
    sim.step(1 / TICK_RATE);
    const snapshot: ServerMessage = {
      t: "snapshot",
      tick: sim.tick,
      dayPhase: sim.dayPhase,
      dayPaused: sim.dayPaused,
      players: sim.snapshots(),
    };
    for (const client of clients) sendJson(client, snapshot);
  }, 1000 / TICK_RATE);

  await new Promise<void>((resolve) => httpServer.listen(port, resolve));
  const address = httpServer.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  console.log(`[game-server] listening on http://localhost:${actualPort}`);

  return {
    port: actualPort,
    close: () =>
      new Promise((resolve) => {
        clearInterval(timer);
        wss.close(() => httpServer.close(() => resolve()));
      }),
  };
}

function attachClient(ctx: { readonly ws: WebSocket; readonly sim: WorldSim; readonly clients: Set<WebSocket> }): void {
  const playerId = ctx.sim.addPlayer("Traveler");
  ctx.clients.add(ctx.ws);
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
