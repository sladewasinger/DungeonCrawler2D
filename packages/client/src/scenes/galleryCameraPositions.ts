// Fixed-seed 1337 camera presets for terrain screenshot verification: hand-picked
// world-tile coordinates for a room cluster, a landmark, a chasm crossing, and a
// sanctuary stretch room — plus one occlusion-groundwork marker position each, the
// entity-showcase row, and the wall-occlusion duo (entityShowcaseLayout.ts).
import { personalRoomChunk, CHUNK_SIZE } from "@dc2d/engine";
import { OCCLUSION_DUO, SHOWCASE_ROW } from "./entityShowcaseLayout.js";
import { VFX_COMBAT, VFX_CORRIDOR, VFX_EFFECTS_ROOM } from "./vfxShowcaseLayout.js";

export interface CameraPreset {
  readonly centerTileX: number;
  readonly centerTileY: number;
  readonly markerTileX: number;
  readonly markerTileY: number;
  readonly markerAnim: string;
  /** Overrides the default "2 tiles east of center" ground-item spot when that would land on showcase content. */
  readonly groundItemTileX?: number;
  readonly groundItemTileY?: number;
}

const sanctuaryCenter = {
  x: personalRoomChunk(0).cx * CHUNK_SIZE + CHUNK_SIZE / 2,
  y: personalRoomChunk(0).cy * CHUNK_SIZE + CHUNK_SIZE / 2,
};

export type CameraPresetName =
  | "rooms"
  | "landmark"
  | "chasm"
  | "sanctuary"
  | "entities"
  | "occlusion"
  | "solidmass"
  | "door"
  | "pillar"
  | "platform"
  | "corridor"
  | "effects"
  | "combat";

export const CAMERA_PRESETS: Readonly<Record<CameraPresetName, CameraPreset>> = {
  rooms: {
    centerTileX: 21,
    centerTileY: 50,
    markerTileX: 19,
    markerTileY: 46,
    markerAnim: "skelet_idle",
  },
  landmark: {
    centerTileX: 48,
    centerTileY: 45,
    markerTileX: 48,
    markerTileY: 41,
    markerAnim: "goblin_idle",
  },
  chasm: {
    centerTileX: -42,
    centerTileY: -106,
    markerTileX: -42,
    markerTileY: -109,
    markerAnim: "wizzard_f_idle",
  },
  sanctuary: {
    centerTileX: sanctuaryCenter.x,
    centerTileY: sanctuaryCenter.y,
    markerTileX: sanctuaryCenter.x,
    markerTileY: sanctuaryCenter.y + 3,
    markerAnim: "wizzard_f_idle",
  },
  entities: {
    centerTileX: SHOWCASE_ROW.baseX + 3,
    centerTileY: SHOWCASE_ROW.baseY - 1,
    markerTileX: SHOWCASE_ROW.baseX,
    markerTileY: SHOWCASE_ROW.baseY,
    markerAnim: "skelet_idle",
    // 2 tiles south of the whole row, clear of every monster slot and the running player.
    groundItemTileX: SHOWCASE_ROW.baseX,
    groundItemTileY: SHOWCASE_ROW.baseY + 2,
  },
  occlusion: {
    centerTileX: OCCLUSION_DUO.northX,
    centerTileY: Math.round((OCCLUSION_DUO.northY + OCCLUSION_DUO.southY) / 2),
    markerTileX: OCCLUSION_DUO.northX,
    markerTileY: OCCLUSION_DUO.northY,
    markerAnim: "skelet_idle",
  },
  /** Deep inside the "rooms" cluster's large eastern fill mass — proves DEFECT A (endless brick fill) is gone. */
  solidmass: {
    centerTileX: 56,
    centerTileY: 50,
    markerTileX: 56,
    markerTileY: 50,
    markerAnim: "skelet_idle",
  },
  /** Tight on the seed-1337 safe-room kiosk at (19,49): the composed 32x32 door assembly acceptance shot. */
  door: {
    centerTileX: 19,
    centerTileY: 48,
    markerTileX: 17,
    markerTileY: 50,
    markerAnim: "wizzard_f_idle",
  },
  /** Isolated wall cell at (14,75): must render as a freestanding column, never wall-run art. */
  pillar: {
    centerTileX: 14,
    centerTileY: 75,
    markerTileX: 12,
    markerTileY: 76,
    markerAnim: "skelet_idle",
  },
  /** Raised walkable surface with an abrupt south drop at (54,133): floor art + half cliff band, visibly raised, never void. */
  platform: {
    centerTileX: 54,
    centerTileY: 133,
    markerTileX: 54,
    markerTileY: 132,
    markerAnim: "wizzard_f_idle",
  },
  /** A real wall-pinch corridor: LightingSystem's general torch scan lights it, not hand-placed props. */
  corridor: {
    centerTileX: VFX_CORRIDOR.centerX,
    centerTileY: VFX_CORRIDOR.centerY,
    markerTileX: VFX_CORRIDOR.centerX - 3,
    markerTileY: VFX_CORRIDOR.centerY,
    markerAnim: "wizzard_f_idle",
  },
  /** The burning-oil/wet/steam line plus poison cloud (vfxShowcaseLayout.ts's HAZARD_TILES). */
  effects: {
    centerTileX: VFX_EFFECTS_ROOM.centerX,
    centerTileY: VFX_EFFECTS_ROOM.centerY,
    markerTileX: VFX_EFFECTS_ROOM.centerX,
    markerTileY: VFX_EFFECTS_ROOM.centerY - 1,
    markerAnim: "skelet_idle",
    groundItemTileX: 51,
    groundItemTileY: 4,
  },
  /** Combat-moment juice: reuses the entity-showcase row, so skip its own marker like "entities" does. */
  combat: {
    centerTileX: VFX_COMBAT.centerX,
    centerTileY: VFX_COMBAT.centerY,
    markerTileX: SHOWCASE_ROW.baseX,
    markerTileY: SHOWCASE_ROW.baseY,
    markerAnim: "skelet_idle",
    groundItemTileX: SHOWCASE_ROW.baseX,
    groundItemTileY: SHOWCASE_ROW.baseY + 2,
  },
};

const DEFAULT_CAMERA_PRESET: CameraPresetName = "rooms";

function isPresetName(name: string): name is CameraPresetName {
  return Object.hasOwn(CAMERA_PRESETS, name);
}

/** Resolves ?camera=<name> to its canonical preset name, falling back to the default for an unknown/missing name. */
export function resolveCameraPresetName(name: string | null): CameraPresetName {
  return name && isPresetName(name) ? name : DEFAULT_CAMERA_PRESET;
}

/** Resolves ?camera=<name> to its preset, falling back to the default for an unknown/missing name. */
export function resolveCameraPreset(name: string | null): CameraPreset {
  return CAMERA_PRESETS[resolveCameraPresetName(name)];
}

/**
 * Presets whose marker tile coincides with a position EntityShowcase already renders
 * on its own: "occlusion" uses OCCLUSION_DUO and "entities" uses SHOWCASE_ROW.
 * GalleryScene skips its own raw marker sprite for these so the fully-featured
 * EntityShowcase render (shadow/hp/nameplate/depth-sort) isn't ghosted by a second,
 * differently-anchored sprite occupying the same spot.
 */
export const PRESETS_WITH_SHOWCASE_MARKER: ReadonlySet<CameraPresetName> = new Set(["entities", "occlusion", "combat"]);
