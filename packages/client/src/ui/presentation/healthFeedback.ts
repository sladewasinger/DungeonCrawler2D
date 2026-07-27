/** Converts an authoritative signed health change into shared 2D/Three presentation semantics. */

export const HEAL_FEEDBACK_COLOR = "#58d68d";
export const DAMAGE_FEEDBACK_COLOR = "#e04a4a";

export interface HealthFeedback {
  readonly kind: "heal" | "damage";
  readonly delta: number;
  readonly label: string;
  readonly color: string;
}

export function healthFeedback(
  delta: number,
  kind: "heal" | "damage" = delta > 0 ? "heal" : "damage",
): HealthFeedback {
  return {
    kind,
    delta,
    label: `${kind === "heal" ? "+" : "-"}${Math.abs(Math.round(delta))}`,
    color: kind === "heal" ? HEAL_FEEDBACK_COLOR : DAMAGE_FEEDBACK_COLOR,
  };
}
