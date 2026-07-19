// Shared world coordinates for the gallery's entity showcase row and wall-occlusion
// duo — both the camera presets (galleryCameraPositions.ts) and the showcase builder
// (entityShowcase.ts) read these so the camera always frames what's actually there.

/** Monster-cycling row + running/jumping player, laid out east of the "rooms" cluster. */
export const SHOWCASE_ROW = { baseX: 31, baseY: 50 } as const;

/** Bodies on opposite sides of a clean ten-cell wall run centered near (-42,-44). */
export const OCCLUSION_DUO = { northX: -42.5, northY: -44.05, southX: -42.5, southY: -41.5 } as const;
