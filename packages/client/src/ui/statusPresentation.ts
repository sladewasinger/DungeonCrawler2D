/** Maps authoritative status timing into one renderer-neutral HUD presentation model. */
import { statusesData } from "@dc2d/content";
import type { ActiveStatusSnapshot } from "@dc2d/engine";

interface StatusDefinition {
  readonly id: string;
  readonly kind: "buff" | "debuff";
  readonly duration: number | null;
}

export interface StatusPresentation {
  readonly id: string;
  readonly kind: "buff" | "debuff";
  readonly remainingSeconds: number;
  readonly durationSeconds: number;
}

function isStatusDefinition(value: unknown): value is StatusDefinition {
  const status = value as Partial<StatusDefinition>;
  return typeof status.id === "string" &&
    (status.kind === "buff" || status.kind === "debuff") &&
    (typeof status.duration === "number" || status.duration === null);
}

const definitions = new Map<string, StatusDefinition>(
  (statusesData as readonly unknown[])
    .filter(isStatusDefinition)
    .map((status) => [status.id, status]),
);

function fallbackStatus(id: string): ActiveStatusSnapshot {
  const duration = definitions.get(id)?.duration ?? null;
  return { id, remainingSeconds: duration, durationSeconds: duration };
}

export function statusPresentations(
  statusEffects: readonly ActiveStatusSnapshot[],
  fallbackIds: readonly string[],
): StatusPresentation[] {
  const authoritative = statusEffects.length > 0
    ? statusEffects
    : fallbackIds.map(fallbackStatus);
  return authoritative.map((status) => {
    const definition = definitions.get(status.id);
    const duration = status.durationSeconds ?? definition?.duration ?? 1;
    return {
      id: status.id,
      kind: definition?.kind ?? "debuff",
      remainingSeconds: status.remainingSeconds ?? duration,
      durationSeconds: duration,
    };
  });
}
