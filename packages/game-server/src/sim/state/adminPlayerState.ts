import type { DebugFlags } from "@dc2d/engine";

/** Runtime-only authority and diagnostics attached to one live player slot. */
export interface AdminPlayerState {
  /** Active only for this live slot or a validated resume of it. */
  admin: boolean;
  /** Never sent to a non-admin gameplay connection. */
  debugFlags: DebugFlags;
}
