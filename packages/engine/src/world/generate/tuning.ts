import worldGenerationTuning from "./worldGenerationTuning.json" with { type: "json" };

/**
 * Developer-facing controls for the active 32×32 world generator.
 *
 * Distances, widths, and radii are runtime tiles unless their names explicitly
 * say chunks, depth, frequency, threshold, or chance. The editable source is
 * worldGenerationTuning.json; this module is the stable TypeScript boundary.
 */
export const WORLD_GENERATION_TUNING = worldGenerationTuning;
