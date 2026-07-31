/**
 * Presentation-only anchor for actor visuals. This centers visible players, pets,
 * monsters, and their shadows over unchanged movement/collision positions.
 */
export const ACTOR_VISUAL_SCREEN_OFFSET_Y_PX = 4;

export interface ActorScreenAnchorInput {
  readonly screen: { readonly x: number; readonly y: number };
  readonly liftPx: number;
  readonly baselineOffsetPx?: number;
}

export function actorScreenAnchor({
  screen,
  liftPx,
  baselineOffsetPx = 0,
}: ActorScreenAnchorInput): { x: number; y: number } {
  return {
    x: screen.x,
    y: screen.y - liftPx + baselineOffsetPx + ACTOR_VISUAL_SCREEN_OFFSET_Y_PX,
  };
}
