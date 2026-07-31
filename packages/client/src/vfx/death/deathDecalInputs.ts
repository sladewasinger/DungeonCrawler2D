import type { CarnageAppearance, DeathCarnageInput } from "./deathCarnagePool.js";
import type { CorpseDecalInput } from "./corpseDecalPool.js";
import type { DeathGoreInput } from "../combat/effects/combatEffects.js";

export interface DeathDecalInputs {
  readonly carnage: DeathCarnageInput;
  readonly corpse: CorpseDecalInput;
}

export function deathDecalInputs({ input, tint, bloodEnabled }: {
  readonly input: DeathGoreInput;
  readonly tint: number;
  readonly bloodEnabled: boolean;
}): DeathDecalInputs {
  const appearance: CarnageAppearance = {
    ...input.appearance,
    ...(input.defId === undefined ? {} : { defId: input.defId }),
  };
  const base = { x: input.x, y: input.y, groundHeight: input.groundHeight, tint, nowMs: input.nowMs };
  return {
    carnage: { ...base, appearance, impactAngle: input.impactAngle, spritePrefix: input.spritePrefix },
    corpse: { ...base, defId: input.defId, spritePrefix: input.spritePrefix, bloodEnabled },
  };
}
