import type { ClientInput, ClientMessage } from "@dc2d/engine";

/** Player-controlled intents that can enter the authoritative action queue. */
export type PlayerAction = Exclude<
  ClientMessage,
  ClientInput | { type: "hello" } | { type: "ping" } |
  { type: "snapshotResync" } | { type: "networkProfile" } |
  { type: "spectatorHello" } | { type: "spectatorCommand" } |
  { type: "adminAuth" } | { type: "adminResume" } |
  { type: "adminLogout" } | { type: "adminCommand" }
>;
