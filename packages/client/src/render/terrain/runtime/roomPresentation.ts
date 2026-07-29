import {
  CHUNK_SIZE,
  isRoomChunk,
  ROOM_WALL_RISE,
} from "@dc2d/engine";
import {
  OUTSIDE_TERRAIN_PRESENTATION,
  TERRAIN_PRESENTATION_MODES,
  type TerrainPresentation,
} from "../geometry/terrainPlannerModel.js";

const INSIDE_ROOM_PRESENTATION: TerrainPresentation = {
  mode: TERRAIN_PRESENTATION_MODES.Inside,
  wallRise: ROOM_WALL_RISE,
};

/** Reserved room space is rendered as an interior; dungeon chunks stay outside. */
export function roomTerrainPresentation(worldY: number): TerrainPresentation {
  const chunkY = Math.floor(worldY / CHUNK_SIZE);
  return isRoomChunk(chunkY)
    ? INSIDE_ROOM_PRESENTATION
    : OUTSIDE_TERRAIN_PRESENTATION;
}
