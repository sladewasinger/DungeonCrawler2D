import {
  type ClientInput,
  type ClientMessage,
} from "@dc2d/engine";
import { WebSocket } from "ws";
import { sendServerMessage } from "../../telemetry/measuredSend.js";
import type { ServerNetworkDiagnostics } from "../../telemetry/networkDiagnostics.js";
import type { ConnState, SocketMap } from "../../types.js";

export const GAMEPLAY_IDLE_TIMEOUT_MS = 3 * 60 * 1000;
export const GAMEPLAY_IDLE_TIMEOUT_CODE = "idle_timeout";
export const GAMEPLAY_IDLE_TIMEOUT_MESSAGE =
  "Disconnected after 3 minutes of inactivity. Rejoin when you are ready.";

export function startGameplayActivity(conn: ConnState, now = Date.now()): void {
  conn.lastMeaningfulActivityAt = now;
  conn.idleTimedOut = false;
}

export function recordMeaningfulGameplayActivity(
  conn: ConnState,
  message: ClientMessage,
  now = Date.now(),
): void {
  if (!isMeaningfulGameplayMessage(conn, message)) return;
  conn.lastMeaningfulActivityAt = now;
}

export function expireInactiveGameplayConnections(input: GameplayInactivityCheck): void {
  const timeoutMs = input.timeoutMs ?? GAMEPLAY_IDLE_TIMEOUT_MS;
  for (const entry of input.sockets.values()) {
    const { conn } = entry;
    if (!conn || !shouldExpireConnection(conn, input.now, timeoutMs)) continue;
    conn.idleTimedOut = true;
    conn.terminationReason = "idle_timeout";
    sendIdleTimeout(entry.ws, conn, input.diagnostics);
    entry.ws.close(4000, GAMEPLAY_IDLE_TIMEOUT_CODE);
  }
}

export interface GameplayInactivityCheck {
  readonly sockets: SocketMap;
  readonly diagnostics: ServerNetworkDiagnostics | undefined;
  readonly now: number;
  readonly timeoutMs?: number;
}

function isMeaningfulGameplayMessage(conn: ConnState, message: ClientMessage): boolean {
  if (message.type === "input") return inputIsMeaningful(conn, message);
  if (message.type === "chat") return true;
  return isGameplayAction(message);
}

function inputIsMeaningful(conn: ConnState, input: ClientInput): boolean {
  const aimChanged = updateAimAndCheckChange(conn, input);
  return input.moveX !== 0 || input.moveY !== 0 || input.run || input.jump ||
    input.block === true || aimChanged;
}

function updateAimAndCheckChange(conn: ConnState, input: ClientInput): boolean {
  const next = inputAim(input, conn.lastAim);
  if (!next) return false;
  const priorAim = conn.lastAim;
  conn.lastAim = next;
  return priorAim !== null &&
    (next.x !== priorAim.x || next.y !== priorAim.y);
}

function inputAim(
  input: ClientInput,
  previous: ConnState["lastAim"],
): { x: number; y: number } | null {
  if (input.faceX === undefined && input.faceY === undefined) return null;
  return {
    x: aimAxis(input.faceX, previous?.x),
    y: aimAxis(input.faceY, previous?.y),
  };
}

function aimAxis(inputAxis: number | undefined, priorAxis: number | undefined): number {
  if (inputAxis !== undefined) return inputAxis;
  return priorAxis ?? 0;
}

function isGameplayAction(message: ClientMessage): boolean {
  return message.type !== "hello" && message.type !== "ping" &&
    message.type !== "input" && message.type !== "snapshotResync" &&
    message.type !== "networkProfile" && message.type !== "adminAuth" &&
    message.type !== "adminResume" && message.type !== "adminCommand";
}

function shouldExpireConnection(
  conn: ConnState,
  now: number,
  timeoutMs: number,
): boolean {
  return conn.playerId !== null && !conn.idleTimedOut &&
    conn.lastMeaningfulActivityAt !== null &&
    now - conn.lastMeaningfulActivityAt >= timeoutMs;
}

function sendIdleTimeout(
  ws: WebSocket,
  conn: ConnState,
  diagnostics: ServerNetworkDiagnostics | undefined,
): void {
  sendServerMessage({
    socket: ws,
    playerId: conn.playerId,
    message: {
      type: "error",
      code: GAMEPLAY_IDLE_TIMEOUT_CODE,
      message: GAMEPLAY_IDLE_TIMEOUT_MESSAGE,
    },
    diagnostics,
  });
}
