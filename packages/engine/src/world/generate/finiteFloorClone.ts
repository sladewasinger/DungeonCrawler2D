import type { GeneratedFloor } from "./finiteFloorTypes.js";

type FloorMetadata = Pick<GeneratedFloor,
  "rooms" | "connectors" | "routes" | "featureStamps" | "downStairways" | "upStairway" |
  "safeRooms" | "miniBossArenas" | "bossArena" | "spawn" | "spawnExterior" | "topology" |
  "territories" | "territoryLayouts">;

/** Returns an isolated public snapshot so callers cannot mutate the cached canonical floor. */
export function cloneGeneratedFloor(floor: GeneratedFloor): GeneratedFloor {
  return {
    ...floor,
    configuration: { ...floor.configuration },
    bounds: { ...floor.bounds },
    identity: { ...floor.identity, bounds: { ...floor.identity.bounds } },
    tiles: floor.tiles.slice(), terrain: floor.terrain.slice(), features: floor.features.slice(),
    featureFaces: floor.featureFaces.slice(), featureHeight: floor.featureHeight.slice(),
    height: floor.height.slice(), zones: floor.zones.slice(), semantic: floor.semantic.slice(),
    biome: floor.biome.slice(), territory: floor.territory.slice(), region: floor.region.slice(), protectedCells: floor.protectedCells.slice(),
    roomIds: floor.roomIds.slice(), roomWallIds: floor.roomWallIds.slice(), featureIds: floor.featureIds.slice(),
    ...cloneFloorMetadata(floor),
  };
}

function cloneFloorMetadata(floor: GeneratedFloor): FloorMetadata {
  return JSON.parse(JSON.stringify({
    rooms: floor.rooms, connectors: floor.connectors, routes: floor.routes,
    featureStamps: floor.featureStamps, downStairways: floor.downStairways,
    upStairway: floor.upStairway, safeRooms: floor.safeRooms,
    miniBossArenas: floor.miniBossArenas, bossArena: floor.bossArena,
    spawn: floor.spawn, spawnExterior: floor.spawnExterior, topology: floor.topology,
    territories: floor.territories,
    territoryLayouts: floor.territoryLayouts,
  })) as FloorMetadata;
}
