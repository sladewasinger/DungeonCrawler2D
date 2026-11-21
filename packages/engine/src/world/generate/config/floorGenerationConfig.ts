import { hashString } from "../../../core/rng.js";
import {
  DEFAULT_FLOOR_GENERATION_CONFIG,
  FINITE_GENERATOR_VERSION,
  type FloorGenerationConfig,
  type NormalizedFloorGenerationConfig,
} from "../finiteFloorTypes.js";
import { DEFAULT_TERRITORY_ROSTER, isTerritoryId, type TerritoryId } from "../territories/territoryCatalog.js";

export const FINITE_GENERATION_CONFIG_LIMITS = Object.freeze({
  maxRoomTargetCount: 512,
  maxRoomAttemptBudget: 8192,
  maxLoopTargetCount: 256,
  maxLoopPathSaving: 1024,
  maxConnectorSpacing: 128,
});

export class FloorGenerationConfigError extends Error {
  readonly code = "invalid-finite-generation-config" as const;

  constructor(readonly fields: readonly string[]) {
    super(`invalid finite-generation input: ${fields.join(", ")}; use finite values within the editor controls`);
    this.name = "FloorGenerationConfigError";
  }
}

export function normalizeFloorGenerationConfig(config: FloorGenerationConfig | undefined): NormalizedFloorGenerationConfig {
  validateNumericInputs(config);
  const merged = { ...DEFAULT_FLOOR_GENERATION_CONFIG, ...config };
  const dimensions = normalizeDimensions(merged);
  const rooms = normalizeRoomControls(merged, dimensions);
  const topology = normalizeTopologyControls(merged);
  const elevation = normalizeElevationControls(merged);
  const territoryRoster = normalizeTerritoryRoster(merged.territoryRoster);
  return {
    ...merged,
    ...dimensions,
    ...rooms,
    ...topology,
    ...elevation,
    biomeCount: territoryRoster.length,
    territoryRoster,
    roomEntranceWidth: Math.max(1, Math.min(2, Math.floor(merged.roomEntranceWidth))),
    mazeDensity: boundedFraction(merged.mazeDensity),
    connectorDensity: boundedFraction(merged.connectorDensity),
    territoryLayoutDensity: boundedFraction(merged.territoryLayoutDensity),
    mazeCorridorWidth: Math.max(4, Math.floor(merged.mazeCorridorWidth)),
    deadEndRemovalFraction: Math.max(0, Math.min(0.95, merged.deadEndRemovalFraction)),
    minimumBiomeArea: Math.max(64, Math.min(merged.minimumBiomeArea, Math.floor(merged.width * merged.height / (territoryRoster.length * 2)))),
    elevationStep: Math.max(0.5, Math.min(1.5, merged.elevationStep)),
    stairTreadCount: Math.max(1, Math.min(12, Math.floor(merged.stairTreadCount))),
    generatorVersion: merged.generatorVersion ?? FINITE_GENERATOR_VERSION,
  };
}

function normalizeDimensions(config: NormalizedFloorGenerationConfig): { readonly width: number; readonly height: number } {
  return { width: alignDimension(config.width), height: alignDimension(config.height) };
}

function normalizeRoomControls(
  config: NormalizedFloorGenerationConfig,
  dimensions: { readonly width: number; readonly height: number },
): Pick<NormalizedFloorGenerationConfig, "roomSize" | "roomTargetCount" | "roomAttemptBudget" | "roomMinWidth" | "roomMaxWidth" | "roomMinHeight" | "roomMaxHeight" | "roomSizeVariation"> {
  const maxWidth = largestOddDimension(dimensions.width);
  const maxHeight = largestOddDimension(dimensions.height);
  const roomMinWidth = boundedOddDimension(config.roomMinWidth, maxWidth);
  const roomMinHeight = boundedOddDimension(config.roomMinHeight, maxHeight);
  return {
    roomSize: boundedInteger(config.roomSize, 5, Math.min(maxWidth, maxHeight)),
    roomTargetCount: boundedInteger(config.roomTargetCount, 1, FINITE_GENERATION_CONFIG_LIMITS.maxRoomTargetCount),
    roomAttemptBudget: boundedInteger(config.roomAttemptBudget, 1, FINITE_GENERATION_CONFIG_LIMITS.maxRoomAttemptBudget),
    roomMinWidth,
    roomMaxWidth: boundedOddDimension(Math.max(roomMinWidth, config.roomMaxWidth), maxWidth),
    roomMinHeight,
    roomMaxHeight: boundedOddDimension(Math.max(roomMinHeight, config.roomMaxHeight), maxHeight),
    roomSizeVariation: Math.max(0, Math.min(8, Math.floor(config.roomSizeVariation))),
  };
}

function normalizeTopologyControls(config: NormalizedFloorGenerationConfig): Pick<NormalizedFloorGenerationConfig, "targetLoopCount" | "minimumLoopPathSaving" | "connectorSpacing" | "ordinaryCorridorWidthMin" | "ordinaryCorridorWidthMax"> {
  const ordinaryCorridorWidthMin = Math.max(4, Math.floor(config.ordinaryCorridorWidthMin));
  return {
    targetLoopCount: boundedInteger(config.targetLoopCount, 1, FINITE_GENERATION_CONFIG_LIMITS.maxLoopTargetCount),
    minimumLoopPathSaving: boundedInteger(config.minimumLoopPathSaving, 4, FINITE_GENERATION_CONFIG_LIMITS.maxLoopPathSaving),
    connectorSpacing: boundedInteger(config.connectorSpacing, 2, FINITE_GENERATION_CONFIG_LIMITS.maxConnectorSpacing),
    ordinaryCorridorWidthMin,
    ordinaryCorridorWidthMax: Math.max(ordinaryCorridorWidthMin, Math.floor(config.ordinaryCorridorWidthMax)),
  };
}

function normalizeElevationControls(config: NormalizedFloorGenerationConfig): Pick<NormalizedFloorGenerationConfig, "minimumElevation" | "maximumElevation"> {
  const maximumElevation = boundedInteger(config.maximumElevation, -1, 0);
  return {
    minimumElevation: Math.min(maximumElevation, boundedInteger(config.minimumElevation, -4, 0)),
    maximumElevation,
  };
}

function normalizeTerritoryRoster(roster: readonly TerritoryId[]): readonly TerritoryId[] {
  const selected = [...new Set(roster.filter((id) => isTerritoryId(id)))].slice(0, 12);
  for (const id of DEFAULT_TERRITORY_ROSTER) {
    if (selected.length >= 4) break;
    if (!selected.includes(id)) selected.push(id);
  }
  return Object.freeze(selected);
}

const NUMERIC_INPUT_KEYS: readonly (keyof FloorGenerationConfig)[] = [
  "minX", "minY", "width", "height", "roomSize", "roomSpacing", "roomTargetCount",
  "roomAttemptBudget", "roomMinWidth", "roomMaxWidth", "roomMinHeight", "roomMaxHeight",
  "roomSizeVariation", "roomEntranceWidth", "mazeDensity", "connectorDensity",
  "territoryLayoutDensity", "targetLoopCount", "minimumLoopPathSaving", "connectorSpacing",
  "ordinaryCorridorWidthMin", "ordinaryCorridorWidthMax", "mazeCorridorWidth",
  "deadEndRemovalFraction", "minimumBiomeArea", "maximumRetries", "elevationStep",
  "stairTreadCount", "minimumElevation", "maximumElevation", "generatorVersion",
];

function validateNumericInputs(config: FloorGenerationConfig | undefined): void {
  if (!config) return;
  const invalid = NUMERIC_INPUT_KEYS.filter((key) => {
    const value = config[key];
    return value !== undefined && (typeof value !== "number" || !Number.isFinite(value));
  }).map(String);
  if (invalid.length > 0) throw new FloorGenerationConfigError(invalid);
}

export function floorConfigurationFingerprint(config: NormalizedFloorGenerationConfig): string {
  return hashString(JSON.stringify(config)).toString(16);
}

function alignDimension(value: number): number { return Math.max(64, Math.floor(value / 32) * 32); }
function boundedInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}
function largestOddDimension(value: number): number {
  return Math.max(5, value - 3 - ((value - 3) % 2 === 0 ? 1 : 0));
}
function boundedOddDimension(value: number, maximum: number): number {
  const normalized = Math.min(maximum, Math.max(5, Math.floor(value)));
  return normalized % 2 === 0 ? normalized - 1 : normalized;
}
function boundedFraction(value: number): number { return Math.max(0, Math.min(1, value)); }
