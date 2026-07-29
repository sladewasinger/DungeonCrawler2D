import worldGenerationTuning from "./worldGenerationTuning.json" with { type: "json" };

/**
 * Developer-facing controls for district planning and chunk-local features.
 *
 * Distances, widths, and radii are runtime tiles unless their names explicitly
 * say chunks, depth, frequency, threshold, or chance. The editable source is
 * worldGenerationTuning.json; this module is the stable TypeScript boundary.
 */
export const WORLD_GENERATION_TUNING = worldGenerationTuning;
