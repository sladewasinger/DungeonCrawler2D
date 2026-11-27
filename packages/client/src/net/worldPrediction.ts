/** Local movement prediction and WebSocket reconciliation helpers. */
import { STARTER_ARMOR, getItemDef, isBowItem } from "@dc2d/content";
import {
  BOW_MAX_CHARGE_SEC, COMBAT_TUNING, DEFAULT_APPEARANCE, ELEVATION_DROP_TO_JUMP_Z,
  WorldChunkCache, computeCharacterMoveMultiplier, getWeaponStepSpec, playerFootSegment,
  resolveMovement, resolveWeaponArchetype, stepJumpArc,
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
    facingX: 0, facingY: 1, aimX: 0, aimY: 1, jumpZ: 0, jumpVz: 0, moving: false, sprinting: false, torchLit: true, inWater: false, inDeepWater: false,
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
    comboStep: serverMe.comboStep, swingProgress: serverMe.swingProgress, heavyCharge: serverMe.heavyCharge,
    bowCharge: serverMe.bowCharge, blocking: serverMe.blocking, dodging: serverMe.dodging,
    invulnTimer: serverMe.invulnTimer, staggerTimer: serverMe.staggerTimer, bleedTimer: serverMe.bleedTimer,
    burnTimer: serverMe.burnTimer, poisonTimer: serverMe.poisonTimer, poisonLocked: serverMe.poisonLocked,
    webSlowTimer: serverMe.webSlowTimer, webStick: serverMe.webStick, cocoonProgress: serverMe.cocoonProgress, hitTimer: serverMe.hitTimer,
    respawnTimer: serverMe.respawnTimer, inSanctuary: serverMe.inSanctuary, godMode: serverMe.godMode,
    shrineBuff: serverMe.shrineBuff, glowRadiusBonus: serverMe.glowRadiusBonus, moveSpeedMult: serverMe.moveSpeedMult,
    activeBubble: serverMe.activeBubble,
    stealthVis: serverMe.stealthVis, inCover: serverMe.inCover, attackFlash: serverMe.attackFlash,
    inWater: Boolean(serverMe.inWater), inDeepWater: Boolean(serverMe.inDeepWater),
  };
}

const isBowDrawDisabled = (p: PlayerSnapshot): boolean =>
  Boolean(p.dodging || (p.staggerTimer ?? 0) > 0 || (p.respawnTimer ?? 0) > 0);

function resolveReconciledBowCharge(current: PlayerSnapshot, serverMe: PlayerSnapshot, localBowDrawing?: boolean): number | undefined {
  if (localBowDrawing === undefined) return serverMe.bowCharge;
  if (!localBowDrawing || isBowDrawDisabled(serverMe)) return 0;
  return Math.max(current.bowCharge ?? 0, serverMe.bowCharge ?? 0);
}

export function reconcilePredictedPlayer(
  current: PlayerSnapshot,
  serverMe: PlayerSnapshot,
  opts: { readonly preserveTorch?: boolean; readonly preserveAppearance?: boolean; readonly localBowDrawing?: boolean | undefined } = {},
): PlayerSnapshot {
  const shared = preservedIdentity(current, serverMe, opts);
  const bowCharge = resolveReconciledBowCharge(current, serverMe, opts.localBowDrawing);
  const gap = Math.hypot(serverMe.x - current.x, serverMe.y - current.y);
  if (gap > 0.75) return { ...serverMe, ...shared, bowCharge, elevation: serverMe.elevation };
  return {
    ...current,
    ...serverCombatFields(serverMe),
    bowCharge,
    id: serverMe.id,
    heldItem: serverMe.heldItem ?? current.heldItem ?? null,
    ...shared,
    x: current.x + (serverMe.x - current.x) * 0.2,
    y: current.y + (serverMe.y - current.y) * 0.2,
  };
}

function resolvePredictedSwing(player: PlayerSnapshot) {
  const def = player.heldItem ? getItemDef(player.heldItem) : undefined;
  const arch = resolveWeaponArchetype(player.heldItem, def?.weaponArchetype);
  const stepSpec = getWeaponStepSpec(arch, player.comboStep ?? 1);
  return { swingProgress: player.swingProgress ?? 0, swingWindupEnd: stepSpec.windupEnd, swingWeightTier: stepSpec.weightTier };
}

function movementMultiplier(player: PlayerSnapshot): number {
  return computeCharacterMoveMultiplier({
    dodging: Boolean(player.dodging),
    ...resolvePredictedSwing(player),
    blocking: Boolean(player.blocking),
    bowCharge: player.bowCharge ?? 0,
    inWater: Boolean(player.inWater),
    inDeepWater: Boolean(player.inDeepWater),
    stamina: player.stamina ?? 100,
    crouching: Boolean(player.crouching),
    webStick: player.webStick ?? 0,
    cocoonProgress: player.cocoonProgress ?? 0,
    gearAndBuffSpeedMult: player.moveSpeedMult ?? 1,
  });
}

const isPlayerImmobilized = (p: PlayerSnapshot): boolean => (p.respawnTimer ?? 0) > 0 || (p.staggerTimer ?? 0) > 0;

function resolvePredictedBowCharge(opts: {
  readonly player: PlayerSnapshot;
  readonly bowDraw: boolean | undefined;
  readonly dt: number;
  readonly bowDrawSpeedMult?: number | undefined;
}): number | undefined {
  if (opts.bowDraw === undefined) return opts.player.bowCharge;
  if (!opts.bowDraw || !isBowItem(opts.player.heldItem) || isBowDrawDisabled(opts.player)) return 0;
  const speed = 1 + (opts.bowDrawSpeedMult ?? 0);
  return Math.min(1, (opts.player.bowCharge ?? 0) + (opts.dt * speed) / BOW_MAX_CHARGE_SEC);
}

function preparePredictedPlayer(opts: {
  readonly player: PlayerSnapshot; readonly bowDraw: boolean | undefined; readonly crouch: boolean | undefined; readonly dt: number; readonly bowDrawSpeedMult?: number | undefined;
}): PlayerSnapshot {
  const bowCharge = resolvePredictedBowCharge(opts);
  const basePlayer = bowCharge !== opts.player.bowCharge ? { ...opts.player, bowCharge } : opts.player;
  return opts.crouch !== undefined ? { ...basePlayer, crouching: opts.crouch } : basePlayer;
}

function resolveMoveVector(opts: {
  readonly nx: number; readonly ny: number; readonly player: PlayerSnapshot;
}): { readonly moveX: number; readonly moveY: number; readonly mag: number } {
  const rawMag = Math.hypot(opts.nx, opts.ny);
  if (rawMag <= 0.05) return { moveX: 0, moveY: 0, mag: 0 };
  const cap = !opts.player.dodging && (opts.player.bowCharge ?? 0) > 0 ? COMBAT_TUNING.movement.walkSpeedRatio : 1;
  if (rawMag <= cap) return { moveX: opts.nx, moveY: opts.ny, mag: rawMag };
  const scale = cap / rawMag;
  return { moveX: opts.nx * scale, moveY: opts.ny * scale, mag: cap };
}

function stationaryTurnPos(opts: {
  readonly cache: WorldChunkCache; readonly player: PlayerSnapshot;
  readonly seg: { readonly segX: number; readonly segY: number }; readonly jumpZ: number;
}): { readonly x: number; readonly y: number } {
  if (opts.jumpZ > 0.02) return opts.player;
  return resolveMovement({
    cache: opts.cache, x: opts.player.x, y: opts.player.y, dx: 0, dy: 0, radius: PLAYER_RADIUS,
    footSegX: opts.seg.segX, footSegY: opts.seg.segY, elevation: opts.player.elevation, airborne: false, jumpZ: 0,
  });
}

function advanceMovingPrediction(opts: {
  readonly cache: WorldChunkCache; readonly curPlayer: PlayerSnapshot;
  readonly aimVec: { readonly facingX: number; readonly facingY: number; readonly aimX: number; readonly aimY: number };
  readonly seg: { readonly segX: number; readonly segY: number };
  readonly arc: ReturnType<typeof stepJumpArc>;
  readonly moveX: number; readonly moveY: number; readonly mag: number; readonly dt: number;
}): PlayerSnapshot {
  const { cache, curPlayer, aimVec, seg, arc, moveX, moveY, mag, dt } = opts;
  const mult = movementMultiplier(curPlayer);
  const step = PLAYER_SPEED * mult * dt;
  const moved = resolveMovement({
    cache, x: curPlayer.x, y: curPlayer.y, dx: moveX * step, dy: moveY * step,
    radius: PLAYER_RADIUS, footSegX: seg.segX, footSegY: seg.segY,
    elevation: curPlayer.elevation, airborne: arc.jumpZ > 0.02, jumpZ: arc.jumpZ,
  });
  const nextJumpZ = Math.max(0, arc.jumpZ + moved.elevationDrop * ELEVATION_DROP_TO_JUMP_Z);
  const sprinting = isSprintingPrediction({ mag, mult, inWater: moved.inWater, dodging: Boolean(curPlayer.dodging) });
  return {
    ...curPlayer, x: moved.x, y: moved.y, elevation: moved.elevation, ...aimVec, jumpZ: nextJumpZ, jumpVz: arc.jumpVz,
    crouching: sprinting ? false : Boolean(curPlayer.crouching),
    moving: true, sprinting, inWater: moved.inWater, inDeepWater: moved.inDeepWater,
  };
}

export function predictLocalPlayerMove(input: {
  readonly cache: WorldChunkCache; readonly player: PlayerSnapshot;
  readonly nx: number; readonly ny: number; readonly dt: number;
  readonly aim?: { readonly x: number; readonly y: number } | undefined;
  readonly jump?: boolean | undefined;
  readonly crouch?: boolean | undefined;
  readonly bowDraw?: boolean | undefined;
  readonly bowDrawSpeedMult?: number | undefined;
}): PlayerSnapshot {
  const curPlayer = preparePredictedPlayer({
    player: input.player, bowDraw: input.bowDraw, crouch: input.crouch, dt: input.dt, bowDrawSpeedMult: input.bowDrawSpeedMult,
  });
  if (isPlayerImmobilized(curPlayer)) return { ...curPlayer, moving: false, sprinting: false };
  const arc = stepJumpArc({ jumpZ: curPlayer.jumpZ ?? 0, jumpVz: curPlayer.jumpVz ?? 0 }, Boolean(input.jump) && !curPlayer.inDeepWater, input.dt);
  const { moveX, moveY, mag } = resolveMoveVector({ nx: input.nx, ny: input.ny, player: curPlayer });
  const aimVec = resolveAim({ ...input, player: curPlayer });
  const seg = playerFootSegment({ ...curPlayer, ...aimVec });
  if (mag <= 0.05) {
    const turn = stationaryTurnPos({ cache: input.cache, player: curPlayer, seg, jumpZ: arc.jumpZ });
    return { ...curPlayer, x: turn.x, y: turn.y, ...aimVec, jumpZ: arc.jumpZ, jumpVz: arc.jumpVz, moving: false, sprinting: false };
  }
  return advanceMovingPrediction({ cache: input.cache, curPlayer, aimVec, seg, arc, moveX, moveY, mag, dt: input.dt });
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
