/** Local movement prediction and WebSocket reconciliation helpers. */
import {
  DEFAULT_APPEARANCE, ELEVATION_DROP_TO_JUMP_Z, WorldChunkCache, resolveMovement, stepJumpArc,
  type ArmorEquipment, type CharacterAppearance, type PlayerSnapshot,
} from "@dc2d/engine";

const PLAYER_SPEED = 5.4;
const PLAYER_RADIUS = 0.28;
const EMPTY_ARMOR: ArmorEquipment = { head: null, chest: null, legs: null, feet: null };

export function createDefaultPlayer(
  id: string,
  prefs?: { readonly name?: string; readonly appearance?: CharacterAppearance },
): PlayerSnapshot {
  return {
    id, name: prefs?.name ?? "Adventurer", x: 0.5, y: 0.5, elevation: 0,
    facingX: 0, facingY: 1, aimX: 0, aimY: 1, jumpZ: 0, jumpVz: 0, moving: false, torchLit: true, inWater: false,
    lastAckSeq: 0, heldItem: null, appearance: prefs?.appearance ?? DEFAULT_APPEARANCE, armor: { ...EMPTY_ARMOR },
  };
}

function keepJump(current: PlayerSnapshot, serverMe: PlayerSnapshot): {
  readonly jumpZ: number; readonly jumpVz: number; readonly elevation: number;
} {
  const localAir = (current.jumpZ ?? 0) > 0 || (current.jumpVz ?? 0) > 0;
  const src = localAir ? current : serverMe;
  return { jumpZ: src.jumpZ ?? 0, jumpVz: src.jumpVz ?? 0, elevation: src.elevation };
}

function keepAim(current: PlayerSnapshot): { readonly aimX?: number; readonly aimY?: number } {
  return current.aimX !== undefined && current.aimY !== undefined
    ? { aimX: current.aimX, aimY: current.aimY }
    : {};
}

export function normalizeDirection(vec?: { readonly x: number; readonly y: number }, clampLength = false): { readonly x: number; readonly y: number } | undefined {
  if (!vec) return undefined;
  const mag = Math.hypot(vec.x, vec.y);
  if (mag <= 0.05) return undefined;
  const denom = clampLength ? Math.max(1, mag) : mag;
  return { x: vec.x / denom, y: vec.y / denom };
}

function preservedIdentity(
  current: PlayerSnapshot,
  serverMe: PlayerSnapshot,
  opts: { readonly preserveTorch?: boolean; readonly preserveAppearance?: boolean },
) {
  const appearance = opts.preserveAppearance ? current.appearance : (serverMe.appearance ?? current.appearance);
  const armor = serverMe.armor ?? current.armor;
  return {
    torchLit: opts.preserveTorch ? current.torchLit : serverMe.torchLit,
    name: opts.preserveAppearance ? current.name : serverMe.name,
    facingX: current.facingX,
    facingY: current.facingY,
    ...keepJump(current, serverMe),
    ...keepAim(current),
    ...(appearance ? { appearance } : {}),
    ...(armor ? { armor } : {}),
  };
}

export function reconcilePredictedPlayer(
  current: PlayerSnapshot,
  serverMe: PlayerSnapshot,
  opts: { readonly preserveTorch?: boolean; readonly preserveAppearance?: boolean } = {},
): PlayerSnapshot {
  const shared = preservedIdentity(current, serverMe, opts);
  const gap = Math.hypot(serverMe.x - current.x, serverMe.y - current.y);
  if (gap > 0.75) return { ...serverMe, ...shared, elevation: serverMe.elevation };
  return {
    ...current,
    id: serverMe.id,
    heldItem: serverMe.heldItem ?? current.heldItem ?? null,
    ...shared,
    x: current.x + (serverMe.x - current.x) * 0.2,
    y: current.y + (serverMe.y - current.y) * 0.2,
  };
}

export function predictLocalPlayerMove(input: {
  readonly cache: WorldChunkCache; readonly player: PlayerSnapshot;
  readonly nx: number; readonly ny: number; readonly dt: number;
  readonly aim?: { readonly x: number; readonly y: number } | undefined;
  readonly jump?: boolean | undefined;
}): PlayerSnapshot {
  const arc = stepJumpArc(
    { jumpZ: input.player.jumpZ ?? 0, jumpVz: input.player.jumpVz ?? 0 },
    Boolean(input.jump),
    input.dt,
  );
  const moving = Math.hypot(input.nx, input.ny) > 0.05;
  const aimVec = resolveAim(input);
  if (!moving) return { ...input.player, ...aimVec, jumpZ: arc.jumpZ, jumpVz: arc.jumpVz, moving: false };
  const step = PLAYER_SPEED * input.dt;
  const moved = resolveMovement({
    cache: input.cache, x: input.player.x, y: input.player.y,
    dx: input.nx * step, dy: input.ny * step, radius: PLAYER_RADIUS,
    elevation: input.player.elevation, airborne: arc.jumpZ > 0.02,
  });
  const nextJumpZ = arc.jumpZ + moved.elevationDrop * ELEVATION_DROP_TO_JUMP_Z;
  return {
    ...input.player, x: moved.x, y: moved.y, elevation: moved.elevation,
    ...aimVec, jumpZ: nextJumpZ, jumpVz: arc.jumpVz, moving: true, inWater: moved.inWater,
  };
}

function resolveAim(input: {
  readonly player: PlayerSnapshot; readonly nx: number; readonly ny: number;
  readonly aim?: { readonly x: number; readonly y: number } | undefined;
}): { readonly facingX: number; readonly facingY: number; readonly aimX: number; readonly aimY: number } {
  if (input.aim && Math.hypot(input.aim.x, input.aim.y) > 0.05) {
    return { facingX: input.aim.x, facingY: input.aim.y, aimX: input.aim.x, aimY: input.aim.y };
  }
  if (Math.hypot(input.nx, input.ny) > 0.05) {
    return { facingX: input.nx, facingY: input.ny, aimX: input.nx, aimY: input.ny };
  }
  return {
    facingX: input.player.facingX,
    facingY: input.player.facingY,
    aimX: input.player.aimX ?? input.player.facingX,
    aimY: input.player.aimY ?? input.player.facingY,
  };
}

export function defaultWsUrl(): string {
  const configured = import.meta.env.VITE_GAME_WS_URL as string | undefined;
  if (configured) return configured;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}
