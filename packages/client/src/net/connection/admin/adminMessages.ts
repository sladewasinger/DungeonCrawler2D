import type { ServerMessage } from "@dc2d/engine";
import type { Connection } from "../connection.js";

export interface AdminCommandResult {
  readonly ok: boolean;
  readonly code?: string;
  readonly message?: string;
}

export function handleAdminMessage(
  conn: Connection,
  message: ServerMessage,
): boolean {
  if (message.type === "adminAuthResult") return handleAuth(conn, message);
  if (message.type === "adminState") return handleState(conn, message);
  if (message.type === "adminObserverState") return handleObserverState(conn, message);
  if (message.type === "adminCommandResult") return handleCommandResult(conn, message);
  return false;
}

function handleAuth(
  conn: Connection,
  message: Extract<ServerMessage, { type: "adminAuthResult" }>,
): true {
  conn.adminAuthenticated = message.ok;
  conn.adminSessionKey = message.ok ? message.sessionKey ?? null : null;
  conn.adminCapabilities = message.capabilities ?? [];
  conn.onAdminAuth?.(message.ok);
  if (!message.ok) conn.pushToast(`Admin authentication ${message.reason ?? "failed"}`);
  return true;
}

function handleState(
  conn: Connection,
  message: Extract<ServerMessage, { type: "adminState" }>,
): true {
  applyObserverState(conn, message);
  conn.adminMap = message.map;
  conn.adminPalette = message.palette;
  conn.adminDebugFlags = message.debug;
  conn.onAdminState?.();
  return true;
}

function handleObserverState(
  conn: Connection,
  message: Extract<ServerMessage, { type: "adminObserverState" }>,
): true {
  applyObserverState(conn, message);
  conn.onAdminObserverState?.();
  return true;
}

function applyObserverState(
  conn: Connection,
  message: Pick<Extract<ServerMessage, { type: "adminState" | "adminObserverState" }>, "players" | "spectator" | "spectatorMap">,
): void {
  conn.adminPlayers = message.players;
  conn.adminSpectatorMap = message.spectatorMap;
  conn.spectatorMode = message.spectator.mode;
  conn.spectatorTargetId = message.spectator.playerId;
}

function handleCommandResult(
  conn: Connection,
  message: Extract<ServerMessage, { type: "adminCommandResult" }>,
): true {
  if (!message.ok) conn.pushToast(`Admin command failed: ${message.code ?? "unknown"}`);
  conn.onAdminCommandResult?.({
    ok: message.ok,
    ...(message.code ? { code: message.code } : {}),
    ...(message.message ? { message: message.message } : {}),
  });
  return true;
}
