// Shared shapes for the room-and-corridor generator: axis-aligned rects, rooms, and
// the door/threshold records the height pass needs to carve stair ramps.

/** Inclusive tile bounds, chunk-local coordinates. */
export interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** `grotto` is a sparse organic rubble scatter — the "cavern someone could name" flavor. */
export type Flavor = "chamber" | "gallery" | "pillarHall" | "plaza" | "grotto";

export interface Room {
  readonly rect: Rect;
  readonly flavor: Flavor;
}

/** Climb-direction convention matches world/stairs.ts's DIRS: 0=N, 1=E, 2=S, 3=W. */
export type Side = 0 | 1 | 2 | 3;

/**
 * One corridor threshold at a room's wall: `center` is the along-wall
 * coordinate (x for N/S sides, y for E/W sides) and `width` the run of
 * tiles the corridor carved there. The height pass turns this run into
 * a stair ramp when the room sits above/below the corridor.
 */
export interface Doorway {
  readonly room: Room;
  readonly side: Side;
  readonly center: number;
  readonly width: number;
}
