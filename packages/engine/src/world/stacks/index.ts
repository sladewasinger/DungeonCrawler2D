// Public facade for the stack model: authored per-tile stacks, the pure
// compile function, worldgen's mechanical reverse mapping, and current editor-map
// JSON validation. Consumers import from here, never from siblings.

export { stacksToHeightField } from "./compile.js";
export { heightFieldToStacks } from "./fromHeightField.js";
export { editorMapV2Schema } from "./schema.js";
export {
  DEFAULT_FLOOR_CAP,
  FEATURE_TILE,
  STACK_FEATURE,
  TILE_FEATURE,
  type CompiledField,
  type EditorMapV2,
  type StackDir,
  type StackFeature,
  type StackTile,
  type TorchTile,
} from "./types.js";
