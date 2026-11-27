/** WebSocket Origin allowlist, Fly proxy IP extraction, connection caps, and packet rate limiter. */
import type { IncomingMessage } from "node:http";

export const MAX_WS_PAYLOAD_BYTES = 16 * 1024;
export const MAX_WS_BUFFERED_BYTES = 512 * 1024;
const MAX_CLIENTS = 64;
const MAX_CONNS_PER_IP = 4;
export const HANDSHAKE_TIMEOUT_MS = 5_000;
const MAX_PACKETS_PER_SEC = 90;
const PACKET_BURST = 120;

const DEFAULT_PROD_ORIGINS = ["https://dungeoncrawl2d.austinwasinger.com"];
const DEFAULT_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function isPrivateDevLanOrigin(origin: string): boolean {
  return /^http:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(?::\d+)?$/.test(origin);
}

function isDevAllowedOrigin(origin: string): boolean {
  return DEFAULT_PROD_ORIGINS.includes(origin) || DEFAULT_DEV_ORIGINS.includes(origin) || isPrivateDevLanOrigin(origin);
}

export function isAllowedWsOrigin(origin: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!origin) return env.ALLOW_EMPTY_WS_ORIGIN === "1" || env.NODE_ENV !== "production";
  const configured = (env.ALLOWED_WS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (configured.length > 0) return configured.includes(origin);
  return env.NODE_ENV === "production" ? DEFAULT_PROD_ORIGINS.includes(origin) : isDevAllowedOrigin(origin);
}

export function extractClientIp(req: Pick<IncomingMessage, "headers" | "socket">, env: NodeJS.ProcessEnv = process.env): string {
  if (env.TRUST_FLY_PROXY === "1") {
    const flyIp = req.headers["fly-client-ip"];
    if (typeof flyIp === "string" && flyIp.trim()) return flyIp.trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}

export class IpConnectionLimiter {
  private readonly perIp = new Map<string, number>();
  private total = 0;

  canAccept(ip: string): boolean {
    return this.total < MAX_CLIENTS && (this.perIp.get(ip) ?? 0) < MAX_CONNS_PER_IP;
  }

  tryAcquire(ip: string): boolean {
    if (!this.canAccept(ip)) return false;
    this.perIp.set(ip, (this.perIp.get(ip) ?? 0) + 1);
    this.total += 1;
    return true;
  }

  release(ip: string): void {
    const cur = this.perIp.get(ip) ?? 0;
    if (cur <= 1) this.perIp.delete(ip);
    else this.perIp.set(ip, cur - 1);
    this.total = Math.max(0, this.total - 1);
  }
}

export class PacketRateLimiter {
  private tokens = PACKET_BURST;
  private lastMs = Date.now();

  allow(nowMs = Date.now()): boolean {
    const elapsedSec = Math.max(0, (nowMs - this.lastMs) / 1000);
    this.lastMs = nowMs;
    this.tokens = Math.min(PACKET_BURST, this.tokens + elapsedSec * MAX_PACKETS_PER_SEC);
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
