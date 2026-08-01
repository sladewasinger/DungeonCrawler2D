import type { DeathVisualEvent } from "../../../../net/connection/connectionTypes.js";
import type { VfxSystem } from "../../../../vfx/system/index.js";

export interface RetainedDeathPresentationInput {
  readonly death: DeathVisualEvent;
  readonly vfx: VfxSystem;
  readonly nowMs: number;
  readonly x: number;
  readonly y: number;
  readonly groundHeight: number;
  readonly impactAngle: number | undefined;
  readonly targetKind: "player" | "enemy" | undefined;
  readonly spritePrefix: string | undefined;
}

export function restoreRetainedDeathPresentation(
  input: RetainedDeathPresentationInput,
): void {
  const { death, vfx, x, y, groundHeight, impactAngle, targetKind, spritePrefix } = input;
  vfx.restoreDeathPresentation({
    x,
    y,
    groundHeight,
    defId: death.defId,
    nowMs: input.nowMs - (death.ageMs ?? 0),
    appearance: targetKind === undefined ? {} : { targetKind },
    spritePrefix,
    impactAngle,
  });
}
