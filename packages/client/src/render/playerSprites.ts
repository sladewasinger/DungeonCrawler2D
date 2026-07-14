export const PLAYER_DIRECTIONS = ["south", "west", "east", "north"] as const;
export type PlayerDirection = (typeof PLAYER_DIRECTIONS)[number];

export const PLAYER_STATES = ["idle", "walk", "jump", "fall", "land", "attack", "downed"] as const;
export type PlayerAnimationState = (typeof PLAYER_STATES)[number];
export type PlayerPalette = "self" | "peer";

export const PLAYER_FRAMES_PER_DIRECTION = 8;
export const PLAYER_FRAMES_PER_PALETTE = PLAYER_DIRECTIONS.length * PLAYER_FRAMES_PER_DIRECTION;

const STATE_FRAME: Record<Exclude<PlayerAnimationState, "walk">, number> = {
  idle: 0,
  jump: 3,
  fall: 4,
  land: 5,
  attack: 6,
  downed: 7,
};

export function playerDirection(x: number, y: number, fallback: PlayerDirection = "south"): PlayerDirection {
  if (x === 0 && y === 0) return fallback;
  if (Math.abs(x) > Math.abs(y)) return x < 0 ? "west" : "east";
  return y < 0 ? "north" : "south";
}

export function playerFrame(
  palette: PlayerPalette,
  direction: PlayerDirection,
  state: PlayerAnimationState,
  now = 0,
  phase = 0,
): number {
  const paletteOffset = palette === "self" ? 0 : PLAYER_FRAMES_PER_PALETTE;
  const directionOffset = PLAYER_DIRECTIONS.indexOf(direction) * PLAYER_FRAMES_PER_DIRECTION;
  const stateOffset = state === "walk" ? 1 + (Math.floor(now / 125 + phase) & 1) : STATE_FRAME[state];
  return paletteOffset + directionOffset + stateOffset;
}

