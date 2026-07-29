import type {
  StatusCombatantVisual,
  StatusVisualFrame,
} from "./statusVisualFrame.js";

/** Renderer-independent lifecycle consumed by the status visual pool. */
export interface StatusVisualRig {
  activate(seed: number): void;
  sync(
    body: StatusCombatantVisual["body"],
    frame: StatusVisualFrame,
  ): void;
  reset(): void;
  destroy(): void;
}

export function statusVisualSeed(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index++) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 0x45d9f3b);
  }
  return hash >>> 0;
}
