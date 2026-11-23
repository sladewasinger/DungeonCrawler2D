/** Local movement prediction and WebSocket reconciliation helpers. */
import { STARTER_ARMOR } from "@dc2d/content";
import {
  COMBAT_TUNING, DEFAULT_APPEARANCE, ELEVATION_DROP_TO_JUMP_Z, WorldChunkCache, resolveMovement, stepJumpArc,
  type CharacterAppearance, type PlayerSnapshot,
} from "@dc2d/engine";

const PLAYER_SPEED = COMBAT_TUNING.movement.runSpeedTilesPerSec;
const PLAYER_RADIUS = COMBAT_TUNING.movement.collisionRadiusTiles;

export function createDefaultPlayer(
  id: string,
  prefs?: { readonly name?: string; readonly appearance?: CharacterAppearance },
): PlayerSnapshot {
  return {
    id, name: prefs?.name ?? "Adventurer", x: 0.5, y: 0.5, elevation: 0,
    facingX: 0, facingY: 1, aimX: 0, aimY: 1, jumpZ: 0, jumpVz: 0, moving: false, sprinting: false, torchLit: true, inWater: false,
    lastAckSeq: 0, heldItem: null, appearance: prefs?.appearance ?? DEFAULT_APPEARANCE, armor: { ...STARTER_ARMOR },
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

function serverCombatFields(serverMe: PlayerSnapshot): Partial<PlayerSnapshot> {
  return {
    hp: serverMe.hp, maxHp: serverMe.maxHp, stamina: serverMe.stamina, maxStamina: serverMe.maxStamina,
    comboStep: serverMe.comboStep, swingProgress: serverMe.swingProgress, bowCharge: serverMe.bowCharge,
    blocking: serverMe.blocking, dodging: serverMe.dodging, invulnTimer: serverMe.invulnTimer,
    staggerTimer: serverMe.staggerTimer, bleedTimer: serverMe.bleedTimer,
    hitTimer: serverMe.hitTimer, respawnTimer: serverMe.respawnTimer, inSanctuary: serverMe.inSanctuary,
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
    ...serverCombatFields(serverMe),
    id: serverMe.id,
    heldItem: serverMe.heldItem ?? current.heldItem ?? null,
    ...shared,
    x: current.x + (serverMe.x - current.x) * 0.2,
    y: current.y + (serverMe.y - current.y) * 0.2,
  };
}

function movementMultiplier(player: PlayerSnapshot): number {
  const m = COMBAT_TUNING.movementMults;
  if (player.dodging) return m.dodge;
  if ((player.swingProgress ?? 0) > 0) return m.swing;
  if (player.blocking) return m.block;
  if ((player.bowCharge ?? 0) > 0.05) return m.bowDraw;
  return 1;
}

export function predictLocalPlayerMove(input: {
  readonly cache: WorldChunkCache; readonly player: PlayerSnapshot;
  readonly nx: number; readonly ny: number; readonly dt: number;
  readonly aim?: { readonly x: number; readonly y: number } | undefined;
  readonly jump?: boolean | undefined;
}): PlayerSnapshot {
  if ((input.player.respawnTimer ?? 0) > 0 || (input.player.staggerTimer ?? 0) > 0) {
    return { ...input.player, moving: false, sprinting: false };
  }
  const arc = stepJumpArc(
    { jumpZ: input.player.jumpZ ?? 0, jumpVz: input.player.jumpVz ?? 0 },
    Boolean(input.jump),
    input.dt,
  );
  const mag = Math.hypot(input.nx, input.ny);
  const moving = mag > 0.05;
  const aimVec = resolveAim(input);
  if (!moving) return { ...input.player, ...aimVec, jumpZ: arc.jumpZ, jumpVz: arc.jumpVz, moving: false, sprinting: false };
  const mult = movementMultiplier(input.player);
  const step = PLAYER_SPEED * mult * input.dt;
  const moved = resolveMovement({
    cache: input.cache, x: input.player.x, y: input.player.y,
    dx: input.nx * step, dy: input.ny * step, radius: PLAYER_RADIUS,
    elevation: input.player.elevation, airborne: arc.jumpZ > 0.02, jumpZ: arc.jumpZ,
  });
  const nextJumpZ = Math.max(0, arc.jumpZ + moved.elevationDrop * ELEVATION_DROP_TO_JUMP_Z);
  const sprinting = isSprintingPrediction({ mag, mult, inWater: moved.inWater, dodging: Boolean(input.player.dodging) });
  return {
    ...input.player, x: moved.x, y: moved.y, elevation: moved.elevation,
    ...aimVec, jumpZ: nextJumpZ, jumpVz: arc.jumpVz, moving: true, sprinting, inWater: moved.inWater,
  };
}

function isSprintingPrediction(opts: { readonly mag: number; readonly mult: number; readonly inWater: boolean; readonly dodging: boolean }): boolean {
  return opts.mag > 0.82 && opts.mult >= 0.99 && !opts.inWater && !opts.dodging;
}

function resolveAim(input: {
  readonly player: PlayerSnapshot; readonly nx: number; readonly ny: number;
  readonly aim?: { readonly x: number; readonly y: number } | undefined;
}): { readonly facingX: number; readonly facingY: number; readonly aimX: number; readonly aimY: number } {
  if (input.aim && Math.hypot(input.aim.x, input.aim.y) > 0.05) {
    return { facingX: input.aim.x, facingY: input.aim.y, aimX: input.aim.x, aimY: input.aim.y };
  }
  const moveMag = Math.hypot(input.nx, input.ny);
  if (moveMag > 0.05) {
    const ux = input.nx / moveMag;
    const uy = input.ny / moveMag;
    return { facingX: ux, facingY: uy, aimX: ux, aimY: uy };
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
