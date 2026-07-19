// Fixed seed-1337 world coordinates for the VFX showcase set-pieces: a real generated
// wall-pinch corridor (torches place themselves there via LightingSystem's general
// wall-scan — nothing hardcoded), a room for the fire/oil/wet/steam/poison hazard
// tableau, and the entity-showcase row reused for the combat-moment juice demo.
import { SHOWCASE_ROW } from "./entityShowcaseLayout.js";

/** A real 10-tile wall-pinch corridor in the seed-1337 world (verified by direct world scan). */
export const VFX_CORRIDOR = { centerX: 64, centerY: 12 } as const;

/** The open room north of the corridor pinch — real floor, not a synthetic showcase strip. */
export const VFX_EFFECTS_ROOM = { centerX: 53, centerY: 6 } as const;

/** Combat-moment juice reuses the entity-showcase row so the running/jumping player and cycling monsters are already there. */
export const VFX_COMBAT = { centerX: SHOWCASE_ROW.baseX, centerY: SHOWCASE_ROW.baseY - 1 } as const;

/** Oil trail catching fire and meeting a wet patch (steam), plus a drifting poison cloud — all verified open floor at seed 1337. */
export const HAZARD_TILES = {
  oil: [
    { x: 52, y: 6 },
    { x: 53, y: 6 },
    { x: 54, y: 6 },
  ],
  fire: [{ x: 55, y: 6 }],
  steam: [{ x: 56, y: 6 }],
  wet: [
    { x: 57, y: 6 },
    { x: 58, y: 6 },
  ],
  poison: [
    { x: 48, y: 5 },
    { x: 49, y: 5 },
    { x: 50, y: 5 },
    { x: 48, y: 6 },
    { x: 49, y: 6 },
  ],
} as const;
