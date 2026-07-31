import type { ConnState } from "../../types.js";
import type { OperationalEventSink } from "../../operations/operationalEvent.js";

export type AdminSecurityOutcome =
  | "accepted"
  | "disabled"
  | "invalid"
  | "rate_limited"
  | "unauthorized";

export function recordAdminSecurityEvent(input: {
  readonly events: OperationalEventSink | undefined;
  readonly conn: ConnState;
  readonly action: string;
  readonly outcome: AdminSecurityOutcome;
}): void {
  const { events, conn, action, outcome } = input;
  const actorId = adminSecurityActor(conn);
  events?.record({
    at: Date.now(),
    category: "security",
    action,
    ...(actorId ? { actorId } : {}),
    attributes: { outcome },
  });
}

function adminSecurityActor(conn: ConnState): string | null {
  return conn.playerId ?? conn.peerFingerprint;
}
