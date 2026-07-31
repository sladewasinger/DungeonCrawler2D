import type { AdminAuditRecord, AdminAuditSink } from "../audit.js";
import type { OperationalEventSink } from "../../operations/operationalEvent.js";
import {
  anonymizedAdminSessionId,
  operationalActorId,
} from "../../operations/operationalEventIdentity.js";

/** Mirrors admin audit events into the durable sink without session secrets. */
export class OperationalAdminAuditSink implements AdminAuditSink {
  constructor(private readonly events: OperationalEventSink) {}

  record(event: AdminAuditRecord): void {
    this.events.record({
      at: event.at,
      category: "admin",
      action: event.command,
      actorId: event.operatorPlayerId ?? anonymizedAdminSessionId(event.sessionId),
      attributes: adminAuditAttributes(event),
    });
  }
}

function adminAuditAttributes(event: AdminAuditRecord): Record<string, string | number | boolean> {
  return {
    ok: event.ok,
    targetCount: event.targetIds.length,
    ...(event.targetIds.length > 0 ? { targets: boundedAuditTargets(event.targetIds) } : {}),
    ...(event.code ? { code: event.code } : {}),
  };
}

function boundedAuditTargets(targetIds: readonly string[]): string {
  return targetIds
    .slice(0, 6)
    .map((targetId) => operationalActorId(targetId).slice(0, 32))
    .join(",");
}
