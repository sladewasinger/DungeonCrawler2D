import type { FloorGenerationSnapshot, GeneratedFloorTrace } from "../../packages/engine/src/world/generate/finiteFloor.js";

export function immutableTrace(trace: GeneratedFloorTrace["trace"]): GeneratedFloorTrace["trace"] {
  const effectiveConfiguration = trace.effectiveConfiguration;
  if (!effectiveConfiguration) throw new Error("Trace fixture is missing effective configuration");
  return Object.freeze({
    bounds: Object.freeze({ ...trace.bounds }),
    configurationFingerprint: trace.configurationFingerprint,
    effectiveConfiguration: Object.freeze({
      ...effectiveConfiguration,
      territoryRoster: Object.freeze([...effectiveConfiguration.territoryRoster]),
    }),
    snapshots: Object.freeze(trace.snapshots.map(immutableSnapshot)),
  });
}

function immutableSnapshot(snapshot: FloorGenerationSnapshot): FloorGenerationSnapshot {
  return Object.freeze({
    stageId: snapshot.stageId,
    stageIndex: snapshot.stageIndex,
    fingerprint: snapshot.fingerprint,
    get bounds() { return { ...snapshot.bounds }; },
    get tiles() { return snapshot.tiles.slice(); },
    get terrain() { return snapshot.terrain.slice(); },
    get features() { return snapshot.features.slice(); },
    get featureFaces() { return snapshot.featureFaces.slice(); },
    get featureHeight() { return snapshot.featureHeight.slice(); },
    get height() { return snapshot.height.slice(); },
    get semantic() { return snapshot.semantic.slice(); },
    get roomWallIds() { return snapshot.roomWallIds.slice(); },
    get territory() { return snapshot.territory.slice(); },
    get region() { return snapshot.region.slice(); },
    get featureIds() { return snapshot.featureIds.slice(); },
    get protectedCells() { return snapshot.protectedCells.slice(); },
    get surfaceValidation() { return cloneJson(snapshot.surfaceValidation); },
    get rooms() { return cloneJson(snapshot.rooms); },
    get connectors() { return cloneJson(snapshot.connectors); },
    get routes() { return cloneJson(snapshot.routes); },
    get featureStamps() { return cloneJson(snapshot.featureStamps); },
    get territoryLayouts() { return cloneJson(snapshot.territoryLayouts); },
  });
}

function cloneJson<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
