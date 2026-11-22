/** Entry point for the authoritative multiplayer overworld server. */
import { OVERWORLD_ENGINE_READY } from "@dc2d/engine";
import { OVERWORLD_CONTENT_READY } from "@dc2d/content";

export function bootServerSummary(): boolean {
  return OVERWORLD_ENGINE_READY && OVERWORLD_CONTENT_READY;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("[game-server] bootstrap ready:", bootServerSummary());
}
