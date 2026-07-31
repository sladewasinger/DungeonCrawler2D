import type { AdminCommand } from "@dc2d/engine";
import type { AdminSession } from "../access/authorization.js";
import type { AdminAuditSink } from "../audit.js";
import { commandTargetIds } from "../commands/commandTargets.js";

export interface AdminCommandAuditInput {
  readonly session: AdminSession | null;
  readonly command: AdminCommand;
  readonly outcome: { readonly ok: boolean; readonly code?: string };
  readonly operatorPlayerId: string | null | undefined;
}

export function recordAdminCommand(
  audit: AdminAuditSink,
  input: AdminCommandAuditInput,
): void {
  if (!isAuditableAdminCommand(input)) return;
  audit.record({
    at: Date.now(),
    sessionId: input.session?.sessionId ?? "unauthenticated",
    ...(input.operatorPlayerId ? { operatorPlayerId: input.operatorPlayerId } : {}),
    command: input.command.op,
    targetIds: commandTargetIds(input.command),
    ok: input.outcome.ok,
    ...(input.outcome.code ? { code: input.outcome.code } : {}),
  });
}

/** Successful observation commands are high-frequency portal navigation, not operator changes. */
function isAuditableAdminCommand(input: AdminCommandAuditInput): boolean {
  return !input.outcome.ok || !OBSERVATION_COMMANDS.has(input.command.op);
}

const OBSERVATION_COMMANDS: ReadonlySet<AdminCommand["op"]> = new Set([
  "list",
  "map",
  "spectate",
  "spectator",
]);

export function recordAdminLogout(audit: AdminAuditSink, session: AdminSession): void {
  audit.record({
    at: Date.now(),
    sessionId: session.sessionId,
    command: "logout",
    targetIds: [],
    ok: true,
  });
}
