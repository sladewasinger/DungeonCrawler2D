import type { FloorRegistry } from "../../floors/floorRegistry.js";
import type { GameSim } from "../../sim/core/index.js";
import { MemoryAdminAuditSink } from "./audit.js";
import { AdminAccessLimiter } from "./access/rateLimit.js";
import { AdminSessionRegistry } from "./access/sessionRegistry.js";
import { AdminStateSubscriptions } from "./observer/adminStateSubscriptions.js";
import { AdminController } from "./controller.js";
import { CompositeAdminAuditSink } from "./audit/compositeAdminAuditSink.js";
import { OperationalAdminAuditSink } from "./audit/operationalAdminAuditSink.js";
import type { OperationalEventSink } from "../operations/operationalEvent.js";

export interface AdminRuntime {
  readonly controller: AdminController;
  readonly audit: MemoryAdminAuditSink;
  readonly access: AdminAccessLimiter;
  readonly sessions: AdminSessionRegistry;
  readonly subscriptions: AdminStateSubscriptions;
}

export interface AdminRuntimeInput {
  readonly floors: FloorRegistry;
  readonly sandbox: GameSim;
  readonly combatSandbox?: GameSim;
  readonly operationalEvents?: OperationalEventSink;
}

export function createAdminRuntime(input: AdminRuntimeInput): AdminRuntime {
  const audit = new MemoryAdminAuditSink();
  const auditSink = input.operationalEvents
    ? new CompositeAdminAuditSink([audit, new OperationalAdminAuditSink(input.operationalEvents)])
    : audit;
  const sessions = new AdminSessionRegistry();
  return {
    controller: new AdminController({
      floors: input.floors,
      sandbox: input.sandbox,
      ...(input.combatSandbox ? { combatSandbox: input.combatSandbox } : {}),
      audit: auditSink,
      history: audit,
    }),
    audit,
    access: new AdminAccessLimiter(),
    sessions,
    subscriptions: new AdminStateSubscriptions(sessions),
  };
}
