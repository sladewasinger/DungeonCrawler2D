/** Headless movement-feel measurements, split by scenario for focused tests. */
export { measureChainedPlatforms, measureLedgeClimb, type ClimbResult } from "./feel/climb.js";
export { measureCorridorEntry, type CorridorEntryResult } from "./feel/corridor.js";
export { measureHop, type HopMetrics } from "./feel/hop.js";
export { measureStairContinuity, type StairContinuityMetrics } from "./feel/stairs.js";
export { fixtureWorld } from "./feel/worldFixture.js";
