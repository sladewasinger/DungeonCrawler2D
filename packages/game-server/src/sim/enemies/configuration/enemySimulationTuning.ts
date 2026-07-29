import enemySimulationTuning from "./enemySimulationTuning.json" with { type: "json" };

/**
 * Developer-facing controls for enemy density, perception, and traversal.
 * Distances and heights are runtime tiles. Edit enemySimulationTuning.json;
 * this module is the stable TypeScript boundary.
 */
export const ENEMY_SIMULATION_TUNING = enemySimulationTuning;
