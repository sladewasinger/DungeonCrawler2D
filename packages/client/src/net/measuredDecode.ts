/** Decodes one server payload while recording payload cost and socket queue pressure. */
import {
  decodeServerMessage,
  type ServerMessage,
  type WireMetrics,
} from "@dc2d/engine";
import { wireByteLength } from "./wireSize.js";

export function decodeMeasuredServerMessage(
  payload: string,
  queueBytes: number,
  metrics: WireMetrics,
): ServerMessage | null {
  const startedAt = performance.now();
  const message = decodeServerMessage(payload);
  const decodedAt = performance.now();
  metrics.record(
    "inbound",
    wireByteLength(payload),
    decodedAt - startedAt,
    queueBytes,
    decodedAt,
  );
  return message;
}
