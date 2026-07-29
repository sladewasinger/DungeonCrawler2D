import { carveCorridors } from "../connections/corridors.js";
import { partitionRegion } from "../layout/bsp.js";
import { districtEdgeAnchors } from "../layout/districtEdges.js";
import { DISTRICT_TILE_SPAN } from "../layout/district.js";
import { stampRoom } from "../layout/rooms.js";
import type { DistrictGenerationState } from "./districtState.js";

export function stampDistrictTopology(state: DistrictGenerationState): void {
  const layout = partitionRegion(
    state.districtLayoutSeed,
    DISTRICT_TILE_SPAN,
    state.district,
  );
  state.rooms = layout.rooms;
  for (const room of state.rooms) {
    stampRoom({
      tiles: state.tiles,
      chunkSize: DISTRICT_TILE_SPAN,
      room,
      seed: state.districtLayoutSeed,
    });
  }
  state.doorways = carveCorridors({
    seed: state.districtLayoutSeed,
    tiles: state.tiles,
    corridorCarved: state.corridorCarved,
    chunkSize: DISTRICT_TILE_SPAN,
    rooms: state.rooms,
    links: layout.links,
    anchors: districtEdgeAnchors({
      seed: state.floorLayoutSeed,
      ...state.coordinate,
      districtSize: DISTRICT_TILE_SPAN,
    }),
  });
}
