/** Measures UTF-8 WebSocket payload bytes consistently in browsers and headless tests. */
const encoder = new TextEncoder();

export function wireByteLength(payload: string): number {
  return encoder.encode(payload).byteLength;
}
