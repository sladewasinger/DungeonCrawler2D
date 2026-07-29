import { AOI_RADIUS, TICK_DT } from "@dc2d/engine";

/** Deterministic timing and tolerances for authoritative arena-gate entry. */
export const MINI_BOSS_ARENA_RUNTIME_CONFIGURATION = Object.freeze({
  simulationTickSeconds: TICK_DT,
  entrySpeedTilesPerSecond: 4,
  endpointToleranceTiles: 0.001,
  openGateReplicationRadiusTiles: AOI_RADIUS + 2,
});
