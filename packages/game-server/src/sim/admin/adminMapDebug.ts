import type { AdminMapEntity } from "@dc2d/engine";
import { adminCombatDebug } from "./debug/combatDiagnostics.js";
import { adminEnemyDebug } from "./debug/enemyDiagnostics.js";
import type { AdminEntityDebug, AdminMapDebugInput } from "./adminMapDebugTypes.js";

export type { AdminMapDebugInput } from "./adminMapDebugTypes.js";

/** Projects private, simulation-owned diagnostics; no client computes these fields. */
export function adminMapDebugFields(
  input: AdminMapDebugInput,
): Pick<AdminMapEntity, "facing" | "blocking" | "debug"> {
  const debug = debugForEntity(input);
  return {
    ...facingFields(input),
    ...(input.flags?.guards === false ? {} : playerBlocking(input)),
    ...(debug ? { debug } : {}),
  };
}

function facingFields(input: AdminMapDebugInput): Pick<AdminMapEntity, "facing"> {
  const relevant = !input.flags || input.flags.attacks ||
    input.flags.hitboxPreview || input.flags.guards;
  return relevant && input.entity.facing
    ? { facing: { ...input.entity.facing } }
    : {};
}

function debugForEntity(input: AdminMapDebugInput): AdminEntityDebug | undefined {
  const debug = {
    ...adminCombatDebug(input),
    ...adminEnemyDebug(input),
  };
  return Object.keys(debug).length > 0 ? debug : undefined;
}

function playerBlocking(input: AdminMapDebugInput): Pick<AdminMapEntity, "blocking"> {
  return input.sim.players.get(input.entity.id)?.blocking ? { blocking: true } : {};
}
