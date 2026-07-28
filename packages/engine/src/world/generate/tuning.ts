/**
 * Developer-facing geometry controls for the active 32×32 world generator.
 *
 * Distances, widths, and radii are measured directly in runtime tiles unless
 * a property explicitly says chunks, depth, frequency, or chance. Changing a
 * feature size here never changes chunk dimensions or coordinate scale.
 */
export const WORLD_GENERATION_TUNING = {
  districts: {
    chunkSpan: 3,
  },
  roomLayout: {
    minimumPartitionSpan: 6,
    maximumPartitionDepth: 4,
    chunkBorderMargin: 3,
    roomInset: { min: 1, max: 2 },
    minimumRoomSpan: 4,
  },
  corridors: {
    roomToRoomWidth: { min: 2, max: 3 },
    chunkEdgeWidth: { min: 1, max: 3 },
    avenueWidth: { min: 4, max: 6 },
    edgeAnchorMargin: 6,
    doorwayJitter: 2,
    fixedFeatureLinkWidth: 2,
    descentLinkWidth: 2,
  },
  roomDetails: {
    pillarSpacing: 4,
    pillarInset: 2,
    pillarJitter: 1,
    rubbleInset: 2,
    rubbleChanceDenominator: 6,
  },
  heightFeatures: {
    chasmBridgeWidth: 3,
    chasmMinimumSpan: 9,
    doorwayRampMaximumWidth: 2,
  },
  landmarks: {
    arenaWallRadius: 10,
    shrineDaisRadius: 4,
    shrineRingRadius: 6,
    towerOuterRadius: 9,
    towerTierWidth: 3,
    towerAnchorOffset: 11,
    anchorJitterRadius: 6,
  },
  showcase: {
    searchRadius: 24,
    featureSpan: 2,
  },
  fixedFeatures: {
    safeRoomChunkSpacing: 3,
    safeRoomRadius: 5,
    safeRoomBlendMargin: 3,
    safeRoomJitter: 3,
    stairwayJitter: 6,
    stairwayFrequency: 23,
    kioskHalfWidth: 2,
    kioskHeight: 2,
    kioskTopDepth: 2,
  },
  descentStructure: {
    halfWidth: 2,
    backReach: 3,
    frontReach: 1,
    backWallDepth: 2,
  },
  bossArena: {
    radius: 7,
    wallThickness: 2,
    exitThroatLength: 2,
  },
} as const;
