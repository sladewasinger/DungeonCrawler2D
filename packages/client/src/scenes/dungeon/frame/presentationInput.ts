import type { InputController } from "../../../input/index.js";

export interface DungeonPresentationInput {
  usesAssistedAim(): boolean;
  selectedHotbarSlot(): number | null;
  bowDrawRatio(nowMs?: number): number | null;
  reviveHoldView(): ReturnType<InputController["reviveHoldView"]>;
  fistbumpHoldView(): ReturnType<InputController["fistbumpHoldView"]>;
}

export const READ_ONLY_PRESENTATION_INPUT: DungeonPresentationInput = {
  usesAssistedAim: () => true,
  selectedHotbarSlot: () => null,
  bowDrawRatio: () => null,
  reviveHoldView: () => null,
  fistbumpHoldView: () => null,
};
