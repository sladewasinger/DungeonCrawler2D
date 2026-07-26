import type { GameEvent } from "@dc2d/engine";
import type { Connection } from "./connection.js";

export function applyNpcSpeech(
  conn: Connection,
  event: Extract<GameEvent, { t: "npcSpeech" }>,
): void {
  conn.npcSpeech = {
    npcId: event.npcId,
    name: event.name,
    x: event.x,
    y: event.y,
    text: event.text,
    untilMs: performance.now() + event.durationMs,
  };
}
