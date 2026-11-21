import {
  DEFAULT_FLOOR_GENERATION_CONFIG,
  normalizeFloorGenerationConfig,
  type FloorGenerationConfig,
  type FloorGenerationRequest,
  type NormalizedFloorGenerationConfig,
} from "@dc2d/engine";
import {
  createGenerationPreviewControlDom,
  draftFromControlFields,
} from "./generationPreviewControlDom.js";

export type ApprovedGenerationControl =
  | "roomTargetCount" | "roomSize" | "roomSizeVariation" | "mazeDensity"
  | "connectorDensity" | "minimumLoopPathSaving" | "deadEndRemovalFraction"
  | "territoryLayoutDensity" | "territoryRoster";

export type ApprovedGenerationConfig = {
  readonly [Key in ApprovedGenerationControl]: Required<FloorGenerationConfig>[Key];
};

export interface GenerationPreviewDraft {
  readonly seed: number;
  readonly floor: number;
  readonly config: ApprovedGenerationConfig;
}

export interface GenerationPreviewControls {
  readonly root: HTMLElement;
  readonly generate: HTMLButtonElement;
  readonly previous: HTMLButtonElement;
  readonly next: HTMLButtonElement;
  readonly status: HTMLElement;
  readDraft(): GenerationPreviewDraft;
  setStatus(value: string): void;
}

export function defaultGenerationPreviewDraft(seed = 1): GenerationPreviewDraft {
  return { seed, floor: 1, config: approvedConfigFromNormalized(DEFAULT_FLOOR_GENERATION_CONFIG) };
}

export function serializeGenerationPreviewRequest(
  draft: GenerationPreviewDraft,
): FloorGenerationRequest {
  const normalized = normalizeFloorGenerationConfig(authoredGenerationConfig(draft.config));
  return {
    worldSeed: integerOr(draft.seed, 1),
    floor: integerOr(draft.floor, 1),
    config: authoredGenerationConfigFromNormalized(normalized),
  };
}

export function approvedConfigFromNormalized(
  config: NormalizedFloorGenerationConfig,
): ApprovedGenerationConfig {
  return {
    roomTargetCount: config.roomTargetCount,
    roomSize: config.roomSize,
    roomSizeVariation: config.roomSizeVariation,
    mazeDensity: config.mazeDensity,
    connectorDensity: config.connectorDensity,
    minimumLoopPathSaving: config.minimumLoopPathSaving,
    deadEndRemovalFraction: config.deadEndRemovalFraction,
    territoryLayoutDensity: config.territoryLayoutDensity,
    territoryRoster: [...config.territoryRoster],
  };
}

function authoredGenerationConfig(config: ApprovedGenerationConfig): FloorGenerationConfig {
  const roomDelta = config.roomSizeVariation * 3;
  return {
    roomTargetCount: config.roomTargetCount,
    roomSize: config.roomSize,
    roomSizeVariation: config.roomSizeVariation,
    roomMinWidth: config.roomSize - roomDelta,
    roomMaxWidth: config.roomSize + roomDelta,
    roomMinHeight: config.roomSize - roomDelta,
    roomMaxHeight: config.roomSize + roomDelta,
    mazeDensity: config.mazeDensity,
    connectorDensity: config.connectorDensity,
    minimumLoopPathSaving: config.minimumLoopPathSaving,
    deadEndRemovalFraction: config.deadEndRemovalFraction,
    territoryLayoutDensity: config.territoryLayoutDensity,
    territoryRoster: [...config.territoryRoster],
  };
}

function authoredGenerationConfigFromNormalized(
  config: ReturnType<typeof normalizeFloorGenerationConfig>,
): FloorGenerationConfig {
  return {
    roomTargetCount: config.roomTargetCount,
    roomSize: config.roomSize,
    roomSizeVariation: config.roomSizeVariation,
    roomMinWidth: config.roomMinWidth,
    roomMaxWidth: config.roomMaxWidth,
    roomMinHeight: config.roomMinHeight,
    roomMaxHeight: config.roomMaxHeight,
    mazeDensity: config.mazeDensity,
    connectorDensity: config.connectorDensity,
    minimumLoopPathSaving: config.minimumLoopPathSaving,
    deadEndRemovalFraction: config.deadEndRemovalFraction,
    territoryLayoutDensity: config.territoryLayoutDensity,
    territoryRoster: [...config.territoryRoster],
  };
}

export function createGenerationPreviewControls(
  draft: GenerationPreviewDraft = defaultGenerationPreviewDraft(),
): GenerationPreviewControls {
  const dom = createGenerationPreviewControlDom(draft);
  return {
    root: dom.root, generate: dom.generate, previous: dom.previous,
    next: dom.next, status: dom.status,
    readDraft: () => draftFromControlFields(dom.fields, draft.floor),
    setStatus: (value) => { dom.status.textContent = value; },
  };
}

function integerOr(value: number, fallback: number): number {
  return Number.isInteger(value) ? value : fallback;
}
