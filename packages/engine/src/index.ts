/** Public API for @dc2d/engine. */
export { clamp, fbm2d, hash2d, hashUnit2d, lerp, ridgeNoise2d, smoothstep, valueNoise2d } from "./math/noise.js";
export type { FbmOptions } from "./math/noise.js";
export {
  CHUNK_SIZE,
  GroundKind,
  PropKind,
  TILE_PX,
  chunkKey,
  worldTileIndex,
  worldToChunkCoord,
  worldToLocalCoord,
} from "./world/types.js";
export type { BiomeKind, ChunkProp, PointLightSpec, WorldChunk } from "./world/types.js";
export { sampleWorldTile } from "./world/biomeSampler.js";
export type { TileSample } from "./world/biomeSampler.js";
export { generateChunk } from "./world/chunkGenerator.js";
export { WorldChunkCache, resolveMovement } from "./world/collision.js";
export type { MovementQuery, MovementResult, TileLookup } from "./world/collision.js";
export { DAY_DURATION_SECONDS, periodForPhase, sampleDayNight, wrapDayPhase } from "./time/dayNight.js";
export type { DayNightState, RgbTuple, TimeOfDayPeriod } from "./time/dayNight.js";
export {
  BACKPACK_SLOT_COUNT,
  HOTBAR_SLOT_COUNT,
  TOTAL_INVENTORY_SLOTS,
  createEmptyInventoryState,
  insertIntoSlots,
  moveOrSwapSlot,
} from "./inventory/slotModel.js";
export type {
  ArmorEquipment,
  ArmorSlotKey,
  InventorySlot,
  PlayerInventoryState,
  SlotItem,
  StackLimitLookup,
} from "./inventory/slotModel.js";
export {
  ClientMessageSchema,
  PROTOCOL_VERSION,
  ServerMessageSchema,
} from "./net/protocol.js";
export type {
  ClientMessage,
  PlayerSnapshot,
  ServerMessage,
} from "./net/protocol.js";
