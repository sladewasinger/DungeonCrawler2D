/** Headless movement-feel measurements, split by scenario for focused tests. */
export { measureChainedPlatforms, measureLedgeClimb, type ClimbResult } from "./climb.js";
export { measureCorridorEntry, type CorridorEntryResult } from "./corridor.js";
export { measureHop, type HopMetrics } from "./hop.js";
export { measureStairContinuity, type StairContinuityMetrics } from "./stairs.js";
export { fixtureWorld } from "./worldFixture.js";
