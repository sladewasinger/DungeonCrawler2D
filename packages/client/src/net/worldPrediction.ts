/** Local movement prediction and WebSocket reconciliation helpers. */
import { WorldChunkCache, resolveMovement, type PlayerSnapshot } from "@dc2d/engine";

const PLAYER_SPEED = 5.4;
const PLAYER_RADIUS = 0.28;

export function createDefaultPlayer(id: string): PlayerSnapshot {
  return {
    id, name: "Adventurer", x: 0.5, y: 0.5, elevation: 0,
    facingX: 0, facingY: 1, moving: false, torchLit: true, inWater: false, lastAckSeq: 0, heldItem: null,
  };
}

export function reconcilePredictedPlayer(current: PlayerSnapshot, serverMe: PlayerSnapshot): PlayerSnapshot {
  const gap = Math.hypot(serverMe.x - current.x, serverMe.y - current.y);
  if (gap > 0.75) return { ...serverMe };
  return {
    ...current,
    id: serverMe.id,
    name: serverMe.name,
    heldItem: serverMe.heldItem ?? current.heldItem ?? null,
    torchLit: serverMe.torchLit,
    x: current.x + (serverMe.x - current.x) * 0.2,
    y: current.y + (serverMe.y - current.y) * 0.2,
    elevation: serverMe.elevation,
  };
}

export function predictLocalPlayerMove(input: {
  readonly cache: WorldChunkCache;
  readonly player: PlayerSnapshot;
  readonly nx: number;
  readonly ny: number;
  readonly dt: number;
}): PlayerSnapshot {
  const moving = Math.hypot(input.nx, input.ny) > 0.05;
  if (!moving) return { ...input.player, moving: false };
  const step = PLAYER_SPEED * input.dt;
  const moved = resolveMovement({
    cache: input.cache,
    x: input.player.x,
    y: input.player.y,
    dx: input.nx * step,
    dy: input.ny * step,
    radius: PLAYER_RADIUS,
    elevation: input.player.elevation,
  });
  return {
    ...input.player,
    x: moved.x,
    y: moved.y,
    elevation: moved.elevation,
    facingX: input.nx,
    facingY: input.ny,
    moving: true,
    inWater: moved.inWater,
  };
}

export function defaultWsUrl(): string {
  const configured = import.meta.env.VITE_GAME_WS_URL as string | undefined;
  if (configured) return configured;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}
