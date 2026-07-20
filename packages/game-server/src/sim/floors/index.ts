/** Epic 7.14 (The Descent) facade: floor-scaling, landmark stubs, boss
 * lifecycle, and cross-sim transfer. Consumers (sim/index.ts, helpers.ts,
 * deaths.ts, players.ts, actions/descend.ts) import from here or from a
 * named sibling — never reach into a sibling's own private helpers. */

export { FLOOR_CAP, WARDEN_DEF_ID } from "./constants.js";
export { floorStatMultiplier, scaledEnemyDef } from "./scaling.js";
export { initBossFloor, stepBoss } from "./boss.js";
export { drainReadyTransfers, receiveTransfer } from "./transfer.js";
