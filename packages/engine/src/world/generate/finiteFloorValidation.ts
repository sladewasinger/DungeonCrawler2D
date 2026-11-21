import { TILE } from "../core/types.js";
import { analyzeFloorMovement } from "./finiteFloorMovement.js";
import { validateTopologyInvariants } from "./finiteFloorTopologyValidation.js";
import type { FloorAttempt, FloorBounds, FloorBuffers, GeneratedFloor, NormalizedFloorGenerationConfig } from "./finiteFloorTypes.js";
import { auditProtectedRouteSurfaces } from "./connections/validation/protectedRouteSurfaceAudit.js";

export function validateFloorAttempt(input: {
  readonly attempt: FloorAttempt;
  readonly bounds: FloorBounds;
  readonly config: NormalizedFloorGenerationConfig;
  readonly allowOptionalLoopShortfall?: boolean;
}): readonly string[] {
  const movement = analyzeFloorMovement(input.attempt, input.bounds);
  const routeAudit = auditProtectedRouteSurfaces({ attempt: input.attempt, bounds: input.bounds, movement });
  return [
    ...validatePlanes(input.attempt.buffers, input.bounds),
    ...movement.failures,
    ...validateTopologyInvariants({ ...input, movement }),
    ...routeAudit.failures,
  ];
}

function validatePlanes(buffers: FloorBuffers, bounds: FloorBounds): string[] {
  const failures: string[] = [];
  if (buffers.tiles.length !== bounds.width * bounds.height) failures.push("floor plane dimensions disagree with bounds");
  for (let index = 0; index < buffers.tiles.length; index++) {
    if (!validTile(buffers.tiles[index])) failures.push(`invalid tile plane value ${buffers.tiles[index]}`);
    if (!validTerrain(buffers.terrain[index])) failures.push(`invalid terrain plane value ${buffers.terrain[index]}`);
  }
  return failures.slice(0, 8);
}
function validTile(tile: number | undefined): boolean { return tile === TILE.Floor || tile === TILE.Void || tile === TILE.Bedrock || tile === undefined; }
function validTerrain(terrain: number | undefined): boolean { return terrain === undefined || terrain <= 1; }

export function floorHasValidIdentity(floor: GeneratedFloor): boolean {
  return floor.identity.fingerprint.length > 0 && floor.identity.configurationFingerprint.length > 0;
}
