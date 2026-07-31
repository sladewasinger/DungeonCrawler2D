export type BlockFeedbackKind = "melee" | "projectile";

export interface BlockFeedbackState {
  readonly kind: BlockFeedbackKind;
  readonly startedAtMs: number;
}

export const BLOCK_FEEDBACK_DURATION_MS = 180;

export function blockFeedbackAlpha(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= BLOCK_FEEDBACK_DURATION_MS) return 0;
  return 1 - elapsedMs / BLOCK_FEEDBACK_DURATION_MS;
}
