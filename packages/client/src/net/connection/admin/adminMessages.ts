import type { ServerMessage } from "@dc2d/engine";
import { createDebugFlags } from "@dc2d/engine";
import type { Connection } from "../connection.js";

type AdminAuthMessage = Extract<ServerMessage, { type: "adminAuthResult" }>;
export type AdminAuthFailureReason = NonNullable<AdminAuthMessage["reason"]>;

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
  message: AdminAuthMessage,
): true {
  applyAdminAuthentication(conn, message);
  conn.onAdminAuth?.(message.ok, message.reason);
  notifyAuthenticationFailure(conn, message);
  return true;
}

function applyAdminAuthentication(conn: Connection, message: AdminAuthMessage): void {
  conn.adminAuthenticated = message.ok;
  conn.adminSessionKey = message.ok ? message.sessionKey ?? null : null;
  conn.adminCapabilities = message.capabilities ?? [];
  if (!message.ok) clearAdminPortalState(conn);
}

function notifyAuthenticationFailure(conn: Connection, message: AdminAuthMessage): void {
  if (!message.ok && message.reason !== "logged_out") {
    conn.pushToast(`Admin authentication ${message.reason ?? "failed"}`);
  }
}

function clearAdminPortalState(conn: Connection): void {
  conn.adminPlayers = [];
  conn.adminMap = null;
  conn.adminSpectatorMap = null;
  conn.adminPalette = { enemies: [], items: [], weapons: [], pets: [] };
  conn.adminDebugFlags = createDebugFlags();
  conn.adminHistory = [];
  conn.spectatorMode = "off";
  conn.spectatorTargetId = null;
}

function handleState(
  conn: Connection,
  message: Extract<ServerMessage, { type: "adminState" }>,
): true {
  applyObserverState(conn, message);
  conn.adminMap = message.map;
  conn.adminPalette = message.palette;
  conn.adminDebugFlags = message.debug;
  conn.adminHistory = message.history;
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
