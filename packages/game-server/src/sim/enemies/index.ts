/** Enemy subsystem facade: population (chunk activation) + per-tick AI.
 * Consumers import from here, never from the population/ai siblings. */

export { activateChunksNearPlayers } from "./population.js";
export { stepEnemies } from "./ai.js";
export { REPOPULATE_INTERVAL_TICKS, repopulateNearSpawn } from "./repopulation.js";
