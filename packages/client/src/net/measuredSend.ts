/** Encodes and sends one client message while recording transport cost and queue pressure. */
import { encodeMessage, type ClientMessage, type WireMetrics } from "@dc2d/engine";
import { wireByteLength } from "./wireSize.js";

export function sendMeasured(
  ws: WebSocket | null,
  message: ClientMessage,
  metrics: WireMetrics,
): boolean {
  if (ws?.readyState !== 1) return false;
  const startedAt = performance.now();
  const payload = encodeMessage(message);
  const encodedAt = performance.now();
  try {
    ws.send(payload);
  } catch {
    return false;
  }
  metrics.record({ direction: "outbound", bytes: wireByteLength(payload), codecMilliseconds: encodedAt - startedAt, queueBytes: ws.bufferedAmount, nowMs: encodedAt });
  return true;
}
