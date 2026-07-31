import type { InputController } from "../../../input/index.js";

export interface DungeonPresentationInput {
  usesAssistedAim(): boolean;
  reviveHoldView(): ReturnType<InputController["reviveHoldView"]>;
  fistbumpHoldView(): ReturnType<InputController["fistbumpHoldView"]>;
}

export const READ_ONLY_PRESENTATION_INPUT: DungeonPresentationInput = {
  usesAssistedAim: () => true,
  reviveHoldView: () => null,
  fistbumpHoldView: () => null,
};
