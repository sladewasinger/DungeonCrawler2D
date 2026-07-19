// Shared world coordinates for the gallery's entity showcase row and wall-occlusion
// duo — both the camera presets (galleryCameraPositions.ts) and the showcase builder
// (entityShowcase.ts) read these so the camera always frames what's actually there.

/** Monster-cycling row + running/jumping player, laid out east of the "rooms" cluster. */
export const SHOWCASE_ROW = { baseX: 31, baseY: 50 } as const;

/** Reuses "rooms" preset's hand-picked wall-adjacent tile (north) plus a south companion out in the open room. */
export const OCCLUSION_DUO = { northX: 19, northY: 46, southX: 19, southY: 49 } as const;
