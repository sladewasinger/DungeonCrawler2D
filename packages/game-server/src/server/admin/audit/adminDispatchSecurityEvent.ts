import type { AdminDispatchContext } from "../dispatch.js";
import {
  recordAdminSecurityEvent,
  type AdminSecurityOutcome,
} from "./adminSecurityEvent.js";

export function recordAdminDispatchSecurityEvent(
  context: AdminDispatchContext,
  action: string,
  outcome: AdminSecurityOutcome,
): void {
  recordAdminSecurityEvent({
    events: context.operationalEvents,
    conn: context.conn,
    action,
    outcome,
  });
}
