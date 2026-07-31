import type { AdminAuthFailureReason } from "../../net/connection/admin/adminMessages.js";

export interface AdminAuthenticationStatusInput {
  readonly ok: boolean;
  readonly reason?: AdminAuthFailureReason;
  readonly capabilities: readonly string[];
}

export function adminAuthenticationStatus(input: AdminAuthenticationStatusInput): string {
  if (input.ok) return `Authenticated · ${input.capabilities.join(", ") || "no capabilities"}`;
  if (input.reason === "expired") {
    return "Admin session expired after the game server restarted. Enter ADMIN_TOKEN to authenticate again.";
  }
  if (input.reason === "rate_limited") return "Too many authentication attempts. Wait a moment and try again.";
  if (input.reason === "disabled") return "Admin access is not enabled on this game server.";
  if (input.reason === "logged_out") return "Signed out.";
  return "Authentication failed. Check ADMIN_TOKEN and try again.";
}
