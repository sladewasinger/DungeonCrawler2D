import type Phaser from "phaser";
import type { InputController } from "../../../input/index.js";
import type { InterpolationEntityFilter } from "../../../net/interpolation/interpolate.js";
import { ENTITY_PRESENTATION_TUNING } from "../../../render/entities/presentation/visibility/entityPresentationTuning.js";
import { shouldPresentEntity } from "../../../render/entities/presentation/visibility/entityPresentationVisibility.js";
import { getViewOrientation } from "../../../render/view/index.js";
import { isReservedRoomPosition } from "./roomEntityVisibility.js";
import type {
  TerrainPresentationVisibility,
} from "../../../render/entities/presentation/visibility/entityPresentationVisibility.js";

interface PresentationEntityFilterInput {
  readonly inputController: InputController;
  readonly localPlayerId: string;
  readonly viewerX: number;
  readonly viewerY: number;
  readonly viewport: Phaser.Geom.Rectangle;
  readonly constrainedPresentation?: boolean;
  readonly terrainVisibility?: TerrainPresentationVisibility | undefined;
}

export function presentationEntityFilter(
  input: PresentationEntityFilterInput,
): InterpolationEntityFilter {
  const retainedIds = activeInteractionEntityIds(input.inputController);
  retainedIds.add(input.localPlayerId);
  const orientation = getViewOrientation();
  const enabled = input.constrainedPresentation === true &&
    !isReservedRoomPosition(input.viewerX, input.viewerY);
  return (remote) => shouldPresentEntity({
    entity: remote.snap,
    viewport: input.viewport,
    orientation,
    marginTiles: ENTITY_PRESENTATION_TUNING.cullMarginTiles,
    retainedIds,
    enabled,
    terrainVisibility: input.terrainVisibility,
  });
}

function activeInteractionEntityIds(inputController: InputController): Set<string> {
  const retainedIds = new Set<string>();
  const revive = inputController.reviveHoldView();
  if (revive) retainedIds.add(revive.targetId);
  const fistbump = inputController.fistbumpHoldView();
  if (fistbump) retainedIds.add(fistbump.targetId);
  return retainedIds;
}
