/** Sequence-acknowledged prediction gate preventing in-flight snapshot rollbacks. */

export interface PendingGate {
  readonly pendingSeq: number;
  readonly atMs: number;
}

export const IDLE_GATE: PendingGate = { pendingSeq: 0, atMs: 0 };

function shouldAcceptServerState(
  gate: PendingGate,
  input: { readonly serverAck: number; readonly nowMs: number; readonly timeoutMs?: number },
): { readonly accept: boolean; readonly cleared: boolean } {
  if (gate.pendingSeq <= 0) return { accept: true, cleared: false };
  const timeoutMs = input.timeoutMs ?? 1500;
  if (input.serverAck >= gate.pendingSeq || input.nowMs - gate.atMs >= timeoutMs) {
    return { accept: true, cleared: true };
  }
  return { accept: false, cleared: false };
}

export function resolvePendingGate(
  gate: PendingGate,
  input: { readonly serverAck: number; readonly nowMs: number; readonly timeoutMs?: number },
): { readonly nextGate: PendingGate; readonly accept: boolean } {
  const check = shouldAcceptServerState(gate, input);
  return {
    nextGate: check.cleared ? IDLE_GATE : gate,
    accept: check.accept,
  };
}
