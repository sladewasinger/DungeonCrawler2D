/* eslint-disable max-lines -- generation types stay grouped at the public boundary. */
import type { FeatureFace } from "../core/types.js";
import type { WorldFeatures } from "../core/worldFeatures.js";
import type { BiomeKind, DistrictKind } from "./layout/district.js";
import { DEFAULT_TERRITORY_ROSTER, type TerritoryId, type TerritoryProfile } from "./territories/territoryCatalog.js";

export const FINITE_GENERATOR_VERSION = 9;
export const FLOOR_SEMANTIC = {
  Solid: 0, Corridor: 1, Room: 2, SpawnExterior: 3, SafeRoom: 4,
  StairwayUp: 5, StairwayDown: 6, MiniBossArena: 7, BossArena: 8, Transition: 9,
  RoomWall: 10,
} as const;
export type FloorSemantic = (typeof FLOOR_SEMANTIC)[keyof typeof FLOOR_SEMANTIC];

export interface FloorBounds {
  readonly minX: number; readonly minY: number;
  readonly width: number; readonly height: number;
  readonly maxX: number; readonly maxY: number;
  readonly minChunkX: number; readonly minChunkY: number;
  readonly maxChunkX: number; readonly maxChunkY: number;
}

export interface FloorGenerationConfig {
  readonly minX?: number; readonly minY?: number;
  readonly width?: number; readonly height?: number;
  readonly biomeCount?: number; readonly territoryRoster?: readonly TerritoryId[]; readonly roomSize?: number;
  readonly roomSpacing?: number; readonly roomTargetCount?: number; readonly roomAttemptBudget?: number;
  readonly roomMinWidth?: number; readonly roomMaxWidth?: number;
  readonly roomMinHeight?: number; readonly roomMaxHeight?: number; readonly roomSizeVariation?: number;
  readonly roomEntranceWidth?: number; readonly mazeDensity?: number; readonly connectorDensity?: number;
  readonly territoryLayoutDensity?: number; readonly targetLoopCount?: number;
  readonly minimumLoopPathSaving?: number; readonly connectorSpacing?: number;
  readonly ordinaryCorridorWidthMin?: number; readonly ordinaryCorridorWidthMax?: number;
  readonly mazeCorridorWidth?: number;
  readonly deadEndRemovalFraction?: number; readonly minimumBiomeArea?: number;
  readonly maximumRetries?: number; readonly elevationStep?: number; readonly stairTreadCount?: number;
  readonly minimumElevation?: number; readonly maximumElevation?: number;
  readonly generatorVersion?: number;
}

export type FloorGenerationTraceConfig = Pick<FloorGenerationConfig,
  | "territoryRoster" | "roomSize" | "roomSpacing" | "roomTargetCount"
  | "roomMinWidth" | "roomMaxWidth" | "roomMinHeight" | "roomMaxHeight"
  | "roomSizeVariation" | "roomEntranceWidth" | "mazeDensity"
  | "connectorDensity" | "territoryLayoutDensity" | "targetLoopCount"
  | "minimumLoopPathSaving" | "connectorSpacing" | "ordinaryCorridorWidthMin"
  | "ordinaryCorridorWidthMax" | "mazeCorridorWidth" | "deadEndRemovalFraction">;

export interface FloorGenerationTraceRequest {
  readonly worldSeed: number;
  readonly floor: number;
  readonly features?: WorldFeatures;
  readonly config?: FloorGenerationTraceConfig;
}

export interface NormalizedFloorGenerationConfig {
  readonly minX: number; readonly minY: number;
  readonly width: number; readonly height: number;
  readonly biomeCount: number; readonly territoryRoster: readonly TerritoryId[]; readonly roomSize: number;
  readonly roomSpacing: number; readonly roomTargetCount: number; readonly roomAttemptBudget: number;
  readonly roomMinWidth: number; readonly roomMaxWidth: number;
  readonly roomMinHeight: number; readonly roomMaxHeight: number; readonly roomSizeVariation: number;
  readonly roomEntranceWidth: number; readonly mazeDensity: number; readonly connectorDensity: number;
  readonly territoryLayoutDensity: number; readonly targetLoopCount: number;
  readonly minimumLoopPathSaving: number; readonly connectorSpacing: number;
  readonly ordinaryCorridorWidthMin: number; readonly ordinaryCorridorWidthMax: number;
  readonly mazeCorridorWidth: number;
  readonly deadEndRemovalFraction: number; readonly minimumBiomeArea: number;
  readonly maximumRetries: number; readonly elevationStep: number; readonly stairTreadCount: number;
  readonly minimumElevation: number; readonly maximumElevation: number;
  readonly generatorVersion: number;
}

export const DEFAULT_FLOOR_GENERATION_CONFIG: NormalizedFloorGenerationConfig = Object.freeze({
  minX: -128, minY: -128, width: 512, height: 512,
  biomeCount: DEFAULT_TERRITORY_ROSTER.length, territoryRoster: DEFAULT_TERRITORY_ROSTER,
  roomSize: 15, roomSpacing: 4, roomTargetCount: 64, roomAttemptBudget: 1024,
  roomMinWidth: 9, roomMaxWidth: 21, roomMinHeight: 9, roomMaxHeight: 21,
  roomSizeVariation: 2, roomEntranceWidth: 1, mazeDensity: 1, connectorDensity: 1,
  territoryLayoutDensity: 1,
  targetLoopCount: 24, minimumLoopPathSaving: 24, connectorSpacing: 6,
  ordinaryCorridorWidthMin: 4, ordinaryCorridorWidthMax: 8,
  mazeCorridorWidth: 4,
  deadEndRemovalFraction: 0.55, minimumBiomeArea: 4096,
  maximumRetries: 4, elevationStep: 1, stairTreadCount: 3,
  minimumElevation: -2, maximumElevation: 0,
  generatorVersion: FINITE_GENERATOR_VERSION,
});

export interface FloorRect { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number; }
export interface FloorPoint { readonly x: number; readonly y: number; }

export interface GeneratedRoom extends FloorRect {
  readonly id: number; readonly regionId: number;
  readonly biome: BiomeKind; readonly center: FloorPoint;
  readonly wallEnvelope: FloorRect; readonly entrances: readonly GeneratedRoomEntrance[];
}

export interface GeneratedRoomEntrance {
  readonly position: FloorPoint; readonly axis: "horizontal" | "vertical";
  readonly width: number; readonly connectedRegion: number;
}

export interface GeneratedConnector {
  readonly x: number; readonly y: number;
  readonly regionIds: readonly number[]; readonly loop: boolean; readonly protected: boolean;
  readonly pathSaving: number;
}

export interface FloorTopologySummary {
  readonly regionCount: number; readonly connectorCandidateCount: number;
  readonly spanningConnectorCount: number; readonly loopConnectorCount: number;
  readonly prunedDeadEndCount: number; readonly retainedDeadEndCount: number;
  readonly ordinaryCorridorWidthMinimum: number; readonly ordinaryCorridorWidthMaximum: number;
  readonly ordinaryCorridorWidths: readonly number[];
  readonly mazeCorridorWidth: number;
  readonly work?: import("./budget/finiteFloorWorkBudget.js").FiniteFloorWorkSummary;
}

export type FloorGenerationStageId =
  | "mandatory-backbone"
  | "rooms-envelopes"
  | "maze-fill"
  | "region-connectivity"
  | "loops-dead-ends-elevation"
  | "final-validated";

export interface FloorGenerationSnapshot {
  readonly stageId: FloorGenerationStageId;
  readonly stageIndex: number;
  readonly bounds: FloorBounds;
  readonly tiles: Readonly<Uint8Array>;
  readonly terrain: Readonly<Uint8Array>;
  readonly features: Readonly<Uint8Array>;
  readonly featureFaces: Readonly<Uint8Array>;
  readonly featureHeight: Readonly<Float32Array>;
  readonly height: Readonly<Float32Array>;
  readonly semantic: Readonly<Uint8Array>;
  readonly roomWallIds: Readonly<Int16Array>;
  readonly territory: Readonly<Uint8Array>;
  readonly region: Readonly<Uint16Array>;
  readonly featureIds: Readonly<Int16Array>;
  readonly protectedCells: Readonly<Uint8Array>;
  readonly surfaceValidation: FloorSurfaceValidation;
  readonly rooms: readonly GeneratedRoom[];
  readonly connectors: readonly GeneratedConnector[];
  readonly routes: readonly (readonly FloorPoint[])[];
  readonly featureStamps: readonly GeneratedFeatureStamp[];
  readonly territoryLayouts: readonly GeneratedTerritoryLayout[];
  readonly fingerprint: string;
}

export interface FloorSurfaceValidation {
  readonly status: "planning" | "validated";
  readonly failures: readonly string[];
}

export interface FloorGenerationTrace {
  readonly bounds: FloorBounds;
  readonly configurationFingerprint: string;
  readonly effectiveConfiguration?: NormalizedFloorGenerationConfig;
  readonly snapshots: readonly FloorGenerationSnapshot[];
}

export interface GeneratedTerritoryLayout {
  readonly territoryId: TerritoryId;
  /** Stable catalog key for preview selection and round-tripping. */
  readonly catalogId: TerritoryId;
  readonly label: string;
  readonly visualIdentity: string;
  readonly ownershipTags: readonly string[];
  readonly layoutSignature: string;
  /** False means the authored structure was intentionally skipped by density. */
  readonly materialized?: boolean;
  readonly openedCells: number;
  readonly obstacleCells: number;
  readonly branchPockets: number;
  readonly elevatedCells: number;
  readonly geometryMetrics: Readonly<Record<string, number>>;
}

export interface GeneratedFeatureStamp {
  readonly id: string; readonly kind: string; readonly bounds: FloorRect;
  readonly ports: readonly FloorPoint[]; readonly protectedCells: readonly FloorPoint[];
  readonly position?: FloorPoint;
}

export interface GeneratedStairway extends GeneratedFeatureStamp {
  readonly kind: "up-stair" | "down-stair"; readonly role: "up" | "down";
  readonly position: FloorPoint; readonly chunk: { readonly cx: number; readonly cy: number };
}

export interface GeneratedSafeRoomEntrance extends GeneratedFeatureStamp {
  readonly kind: "safe-room"; readonly door: FloorPoint & { readonly featureFace: FeatureFace };
}

export interface GeneratedMiniBossGate {
  readonly x: number; readonly y: number; readonly featureFace: FeatureFace;
  readonly inside: FloorPoint; readonly outside: FloorPoint;
}

export interface GeneratedMiniBossArena extends GeneratedFeatureStamp {
  readonly kind: "mini-boss-arena"; readonly key: string;
  readonly chunk: { readonly cx: number; readonly cy: number };
  readonly interior: FloorRect; readonly center: FloorPoint;
  readonly gates: readonly GeneratedMiniBossGate[];
  readonly platforms: readonly { x: number; y: number; height: number; screenDepthTiles: number }[];
}

export interface GeneratedBossArena extends GeneratedFeatureStamp {
  readonly kind: "boss-arena"; readonly center: FloorPoint; readonly gate: FloorPoint;
}

export interface FloorGenerationIdentity {
  readonly seed: number; readonly generatorVersion: number; readonly retryIndex: number;
  readonly configurationFingerprint: string; readonly fingerprint: string;
  readonly bounds: FloorBounds;
}

export interface FloorBuffers {
  readonly tiles: Uint8Array; readonly terrain: Uint8Array; readonly features: Uint8Array;
  readonly featureFaces: Uint8Array; readonly featureHeight: Float32Array;
  readonly height: Float32Array; readonly zones: Uint8Array;
  readonly semantic: Uint8Array; readonly biome: Uint8Array; readonly region: Uint16Array;
  readonly territory: Uint8Array;
  readonly protectedCells: Uint8Array; readonly roomIds: Int16Array; readonly roomWallIds: Int16Array;
  readonly featureIds: Int16Array;
}

export interface FloorAttempt {
  readonly buffers: FloorBuffers; readonly rooms: GeneratedRoom[];
  readonly connectors: GeneratedConnector[]; readonly routes: FloorPoint[][];
  readonly featureStamps: GeneratedFeatureStamp[];
  readonly downStairways: GeneratedStairway[]; readonly upStairway: GeneratedStairway | null;
  readonly safeRooms: GeneratedSafeRoomEntrance[]; readonly miniBossArenas: GeneratedMiniBossArena[];
  readonly bossArena: GeneratedBossArena | null; readonly spawn: FloorPoint;
  readonly spawnExterior: GeneratedFeatureStamp;
  readonly featurePortFailures?: readonly string[];
  readonly territoryLayouts: GeneratedTerritoryLayout[];
  readonly topology: FloorTopologySummary;
}

export interface GeneratedFloor {
  readonly worldSeed: number; readonly floor: number; readonly voidTerrain: boolean;
  readonly configuration: NormalizedFloorGenerationConfig;
  readonly identity: FloorGenerationIdentity; readonly bounds: FloorBounds;
  readonly tiles: Uint8Array; readonly terrain: Uint8Array; readonly features: Uint8Array;
  readonly featureFaces: Uint8Array; readonly featureHeight: Float32Array;
  readonly height: Float32Array; readonly zones: Uint8Array;
  readonly semantic: Uint8Array; readonly biome: Uint8Array; readonly region: Uint16Array;
  readonly territory: Uint8Array; readonly territories: readonly TerritoryProfile[];
  readonly territoryLayouts: readonly GeneratedTerritoryLayout[];
  readonly protectedCells: Uint8Array; readonly roomIds: Int16Array; readonly roomWallIds: Int16Array;
  readonly featureIds: Int16Array;
  readonly rooms: readonly GeneratedRoom[]; readonly connectors: readonly GeneratedConnector[];
  readonly routes: readonly (readonly FloorPoint[])[]; readonly featureStamps: readonly GeneratedFeatureStamp[];
  readonly downStairways: readonly GeneratedStairway[]; readonly upStairway: GeneratedStairway | null;
  readonly safeRooms: readonly GeneratedSafeRoomEntrance[]; readonly miniBossArenas: readonly GeneratedMiniBossArena[];
  readonly bossArena: GeneratedBossArena | null; readonly spawn: FloorPoint;
  readonly spawnExterior: GeneratedFeatureStamp;
  readonly topology: FloorTopologySummary;
}

export interface FloorGenerationRequest {
  readonly worldSeed: number; readonly floor: number;
  readonly features?: WorldFeatures; readonly config?: FloorGenerationConfig;
}

export interface BiomeLookup { readonly district: DistrictKind; readonly biome: BiomeKind; }
