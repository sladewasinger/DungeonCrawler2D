/** WebSocket multiplayer server and health endpoint. */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ClientMessageSchema, PROTOCOL_VERSION, type ClientMessage } from "@dc2d/engine";
import { WebSocket, WebSocketServer } from "ws";
import { TICK_RATE, WorldSim } from "../sim/worldSim.js";
import { resolveAdminAuthConfig, type AdminAuthConfig } from "./adminAuth.js";
import {
  HANDSHAKE_TIMEOUT_MS, IpConnectionLimiter, MAX_WS_PAYLOAD_BYTES,
  PacketRateLimiter, extractClientIp, isAllowedWsOrigin,
} from "./wsSecurity.js";
import {
  broadcastTickSnapshots, buildMessageHandlers, completeHelloHandshake, sendJson,
  type ClientSession,
} from "./wsSession.js";

export { broadcastTickSnapshots, type ClientSession } from "./wsSession.js";

export interface RunningGameServer {
  readonly port: number;
  close(): Promise<void>;
}

function handleHealthRequest(req: IncomingMessage, res: ServerResponse): void {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ ok: true, protocol: PROTOCOL_VERSION }));
    return;
  }
  res.writeHead(404);
  res.end("Not found");
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
      session.cleanup(); ws.terminate(); continue;
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
  const limiter = new IpConnectionLimiter();
  const wss = new WebSocketServer({
    server: httpServer, maxPayload: MAX_WS_PAYLOAD_BYTES, perMessageDeflate: false,
    verifyClient: (info, cb) => {
      const ip = extractClientIp(info.req);
      if (!isAllowedWsOrigin(info.origin)) { cb(false, 403, "Forbidden origin"); return; }
      cb(limiter.canAccept(ip), 429, "Too many connections");
    },
  });
  const clients = new Map<WebSocket, ClientSession>();
  wss.on("connection", (ws, req) => {
    const ip = extractClientIp(req);
    if (!limiter.tryAcquire(ip)) { ws.close(1013, "Server busy"); return; }
    req.socket?.setNoDelay?.(true);
    attachClient({ ws, sim, clients, authConfig, clientIp: ip, onRelease: () => limiter.release(ip) });
  });
  const timer = setInterval(() => { sim.step(1 / TICK_RATE); broadcastTickSnapshots({ clients, sim }); }, 1000 / TICK_RATE);
  const heartbeat = setInterval(() => sweepDeadClients(clients), 5000);
  await new Promise<void>((resolve) => httpServer.listen(port, host, resolve));
  const addr = httpServer.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;
  console.log(`[game-server] listening on http://${host}:${actualPort}`);
  return {
    port: actualPort,
    close: () => new Promise((resolve) => { clearInterval(timer); clearInterval(heartbeat); sim.savePersistenceNow(); wss.close(() => httpServer.close(() => resolve())); }),
  };
}

function parseClientMessage(raw: Buffer | string): ClientMessage | null {
  try {
    const parsed = ClientMessageSchema.safeParse(JSON.parse(raw.toString()));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

function dispatchSessionMessage(opts: {
  readonly msg: ClientMessage; readonly session: ClientSession; readonly sim: WorldSim; readonly authConfig: AdminAuthConfig;
}): void {
  opts.session.alive = true;
  if ("seq" in opts.msg && opts.msg.t !== "input") opts.sim.ackActionSeq(opts.session.playerId, opts.msg.seq);
  buildMessageHandlers(opts)[opts.msg.t]();
}

export function attachClient(ctx: {
  readonly ws: WebSocket; readonly sim: WorldSim; readonly clients: Map<WebSocket, ClientSession>;
  readonly authConfig: AdminAuthConfig; readonly clientIp?: string | undefined; readonly onRelease?: () => void;
}): void {
  const rateLimiter = new PacketRateLimiter();
  let session: ClientSession | null = null;
  let cleaned = false;
  let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => { cleanup(); ctx.ws.close?.(4000, "Handshake timeout"); }, HANDSHAKE_TIMEOUT_MS);
  timer.unref?.();
  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    if (timer) { clearTimeout(timer); timer = null; }
    ctx.clients.delete(ctx.ws);
    if (session) ctx.sim.removePlayer(session.playerId);
    ctx.onRelease?.();
  };
  ctx.ws.on("pong", () => { if (session) session.alive = true; });
  ctx.ws.on("close", cleanup);
  ctx.ws.on("error", cleanup);
  const routeMessage = (msg: ClientMessage): void => {
    if (msg.t === "ping") { sendJson(ctx.ws, { t: "pong", t0: msg.t0 }); return; }
    if (session) { dispatchSessionMessage({ msg, session, sim: ctx.sim, authConfig: ctx.authConfig }); return; }
    if (msg.t !== "hello") { cleanup(); ctx.ws.close?.(4002, "Expected hello"); return; }
    if (timer) { clearTimeout(timer); timer = null; }
    session = completeHelloHandshake({ msg, ws: ctx.ws, sim: ctx.sim, clients: ctx.clients, authConfig: ctx.authConfig, clientIp: ctx.clientIp, cleanup });
  };
  ctx.ws.on("message", (buf) => {
    if (!rateLimiter.allow()) { cleanup(); ctx.ws.close?.(1008, "Rate limit exceeded"); return; }
    const msg = parseClientMessage(buf as Buffer | string);
    if (msg) routeMessage(msg);
  });
}
