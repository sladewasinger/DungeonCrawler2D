import type { FloorPoint, GeneratedBossArena, GeneratedConnector, GeneratedFeatureStamp, GeneratedMiniBossArena, GeneratedRoom, GeneratedSafeRoomEntrance, GeneratedStairway } from "./finiteFloorTypes.js";

export function mandatoryFeatures(input: {
  readonly floor: number;
  readonly spawnExterior: GeneratedFeatureStamp;
  readonly safeRooms: readonly GeneratedSafeRoomEntrance[];
  readonly downStairways: readonly GeneratedStairway[];
  readonly upStairway: GeneratedStairway | null;
  readonly miniBossArenas: readonly GeneratedMiniBossArena[];
  readonly bossArena: GeneratedBossArena | null;
}): GeneratedFeatureStamp[] {
  const features: GeneratedFeatureStamp[] = [];
  if (input.floor === 1) features.push(input.spawnExterior);
  features.push(...input.safeRooms, ...input.downStairways);
  if (input.upStairway) features.push(input.upStairway);
  features.push(...input.miniBossArenas);
  if (input.bossArena) features.push(input.bossArena);
  return features;
}

export function requiredRouteTargets(features: readonly GeneratedFeatureStamp[], lastRoom: FloorPoint | null): FloorPoint[] {
  const targets = features.flatMap((feature) => feature.ports);
  if (lastRoom) targets.push(lastRoom);
  return targets;
}

export function attemptRouteTargets(input: {
  readonly features: readonly GeneratedFeatureStamp[];
  readonly rooms: readonly GeneratedRoom[];
  readonly connectors: readonly GeneratedConnector[];
}): FloorPoint[] {
  const lastRoom = input.rooms.at(-1);
  const roomTargets = input.rooms.flatMap((room) => room.entrances.map(({ position }) => position).length > 0
    ? room.entrances.map(({ position }) => position)
    : [room.center]);
  return uniquePoints([
    ...requiredRouteTargets(input.features, lastRoom?.entrances[0]?.position ?? lastRoom?.center ?? null),
    ...roomTargets,
    ...input.connectors,
  ]);
}

function uniquePoints(points: readonly FloorPoint[]): FloorPoint[] {
  const byCoordinate = new Map<string, FloorPoint>();
  for (const point of points) byCoordinate.set(`${Math.floor(point.x)},${Math.floor(point.y)}`, point);
  return [...byCoordinate.values()];
}
