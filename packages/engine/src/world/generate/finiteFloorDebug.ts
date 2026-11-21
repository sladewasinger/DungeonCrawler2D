import type { GeneratedFloor } from "./finiteFloorTypes.js";

export function floorDebugExport(floor: GeneratedFloor) {
  return {
    identity: floor.identity,
    bounds: floor.bounds,
    runtimeChunkBoundaries: {
      minChunkX: floor.bounds.minChunkX,
      minChunkY: floor.bounds.minChunkY,
      maxChunkX: floor.bounds.maxChunkX,
      maxChunkY: floor.bounds.maxChunkY,
    },
    planes: {
      semantic: Array.from(floor.semantic),
      biome: Array.from(floor.biome),
      territory: Array.from(floor.territory),
      region: Array.from(floor.region),
      height: Array.from(floor.height),
      protectedCells: Array.from(floor.protectedCells),
      roomWallIds: Array.from(floor.roomWallIds),
    },
    rooms: floor.rooms,
    territories: floor.territories,
    territoryLayouts: floor.territoryLayouts,
    connectors: floor.connectors,
    routes: floor.routes,
    features: floor.featureStamps,
    spawn: floor.spawn,
    downStairways: floor.downStairways,
    upStairway: floor.upStairway,
    safeRooms: floor.safeRooms,
    miniBossArenas: floor.miniBossArenas,
    bossArena: floor.bossArena,
  };
}
