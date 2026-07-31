import { createDebugFlags } from "@dc2d/engine";
import type { PlayerSlot } from "../state/state.js";

/** Shared runtime-admin defaults for hand-built simulation test slots. */
export function adminTestPlayerState(): Pick<PlayerSlot, "admin" | "debugFlags"> {
  return { admin: false, debugFlags: createDebugFlags() };
}
