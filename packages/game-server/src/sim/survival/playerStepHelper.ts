/** Per-tick player step, stealth sampling, sprint noise emission, and movement integration. */
import {
  COMBAT_TUNING, ELEVATION_DROP_TO_JUMP_Z, STEALTH_TUNING, WorldChunkCache,
  periodForPhase, playerFootSegment, resolveMovement, revealFogAroundPlayer, sampleStealthExposure, stepJumpArc,
} from "@dc2d/engine";
import { stepStationaryPlayerTurn } from "../combat/combatSimHelpers.js";
import type { CombatInputFlags, CombatWorld } from "../combatSim.js";
import { isPlayerNearCampfire } from "../playerInventory.js";
import {
  computeDesiredPlayerDir, computeEffectiveStealthVis, isSprintingMove, setPlayerAimVec,
  stepPlayerSurvivalBuffs,
} from "./playerSurvivalState.js";
import type { SimPlayer } from "./worldPersistenceSync.js";

const PLAYER_SPEED = COMBAT_TUNING.movement.runSpeedTilesPerSec;
const PLAYER_RADIUS = COMBAT_TUNING.movement.collisionRadiusTiles;

function updatePlayerStealthAndNoise(opts: {
  readonly p: SimPlayer; readonly cache: WorldChunkCache; readonly combat: CombatWorld;
  readonly dayPhase: number; readonly dtSeconds: number;
}): void {
  const { p, cache, combat, dayPhase, dtSeconds } = opts;
  if (p.sprinting) p.crouching = false;
  p.attackFlashTimer = Math.max(0, p.attackFlashTimer - dtSeconds);
  const exp = sampleStealthExposure({
    cache, x: p.x, y: p.y, dayPhase, torchLit: p.torchLit, crouching: p.crouching,
    moving: p.moving, sprinting: p.sprinting, inWater: p.inWater || p.inDeepWater,
    attackFlash: p.attackFlashTimer > 0,
  });
  const vis = computeEffectiveStealthVis(p, exp.visibility);
  p.stealthVis = vis; p.visibility = vis; p.inCover = exp.inCover; p.noiseRadius = exp.noiseRadius;
  if (p.sprinting && !p.crouching) {
    p.sprintNoiseAcc += dtSeconds;
    if (p.sprintNoiseAcc >= 0.45) {
      p.sprintNoiseAcc = 0;
      combat.ecology.emitNoise({ x: p.x, y: p.y, radius: STEALTH_TUNING.sprintNoiseRadiusTiles, sourceId: p.id });
    }
    return;
  }
  p.sprintNoiseAcc = 0;
}

function movePlayerBody(opts: {
  readonly p: SimPlayer; readonly cache: WorldChunkCache; readonly combat: CombatWorld; readonly dtSeconds: number;
}): void {
  const { p, cache, combat, dtSeconds } = opts;
  const dir = computeDesiredPlayerDir(p);
  const heldItem = p.inventory.slots[p.selectedHotbar]?.itemId;
  if (!dir) {
    p.moving = false; p.sprinting = false;
    stepStationaryPlayerTurn({ cache, p: { ...p, heldItem, bowCharge: p.combat.bowCharge, heavyCharge: p.combat.heavyCharge } });
    return;
  }
  if (!p.hasExplicitAim && p.combat.dodgeTimer <= 0) setPlayerAimVec(p, dir.ux, dir.uy);
  const seg = playerFootSegment({
    facingX: p.facingX, facingY: p.facingY, aimX: p.aimX, aimY: p.aimY,
    heldItem, bowCharge: p.combat.bowCharge, heavyCharge: p.combat.heavyCharge,
  });
  const mult = combat.moveMultiplier(p);
  const res = resolveMovement({
    cache, x: p.x, y: p.y, dx: dir.nx * PLAYER_SPEED * mult * dtSeconds, dy: dir.ny * PLAYER_SPEED * mult * dtSeconds,
    radius: PLAYER_RADIUS, footSegX: seg.segX, footSegY: seg.segY,
    elevation: p.elevation, airborne: p.jumpZ > 0.02, jumpZ: p.jumpZ,
  });
  p.x = res.x; p.y = res.y; p.elevation = res.elevation;
  p.inWater = res.inWater; p.inDeepWater = res.inDeepWater;
  p.moving = true;
  p.sprinting = isSprintingMove({ mag: dir.mag, mult, inWater: res.inWater, dodging: p.combat.dodgeTimer > 0 });
  if (res.elevationDrop !== 0) p.jumpZ = Math.max(0, p.jumpZ + res.elevationDrop * ELEVATION_DROP_TO_JUMP_Z);
}

export function updatePlayerFogOfWar(p: SimPlayer, dayPhase: number): void {
  const period = periodForPhase(dayPhase);
  const isDaytime = period === "Dawn" || period === "Day" || period === "Golden Hour";
  const key = `${Math.floor(p.x)},${Math.floor(p.y)},${p.elevation},${isDaytime ? 1 : 0}`;
  if (key === p.lastFogTileKey) return;
  p.lastFogTileKey = key;
  const deltas = revealFogAroundPlayer(p.fog, { x: p.x, y: p.y, elevation: p.elevation, isDaytime });
  if (deltas.length > 0) p.pendingFogDeltas.push(...deltas);
}

/** Steps one simulated player's jump arc, combat action, survival buffs, movement, and stealth/noise. */
export function stepPlayerTick(opts: {
  readonly p: SimPlayer; readonly players: Map<string, SimPlayer>; readonly cache: WorldChunkCache;
  readonly combat: CombatWorld; readonly dayPhase: number; readonly dtSeconds: number;
}): void {
  const { p, players, cache, combat, dayPhase, dtSeconds } = opts;
  const arc = stepJumpArc({ jumpZ: p.jumpZ, jumpVz: p.jumpVz }, p.jumpQueued && !p.inDeepWater, dtSeconds);
  p.jumpZ = arc.jumpZ; p.jumpVz = arc.jumpVz;
  const input: CombatInputFlags = {
    moveX: p.moveX, moveY: p.moveY, attackQueued: p.attackQueued, attackHold: p.attackHold,
    bowDrawing: p.bowDrawing, bowReleaseQueued: p.bowReleaseQueued, blockHeld: p.blockHeld,
    dodgeQueued: p.dodgeQueued, dodgeDirX: p.dodgeDirX, dodgeDirY: p.dodgeDirY,
    throwPebble: p.throwPebbleQueued, interactQueued: p.interactQueued,
  };
  combat.stepPlayerAction({ player: p, players, playerName: p.name, respawnPos: combat.structures.respawnPointFor(p.accountId), dt: dtSeconds, input });
  stepPlayerSurvivalBuffs({ p, nearCampfire: isPlayerNearCampfire(cache, p), dt: dtSeconds });
  p.jumpQueued = false; p.attackQueued = false; p.bowReleaseQueued = false; p.dodgeQueued = false;
  p.dodgeDirX = undefined; p.dodgeDirY = undefined; p.throwPebbleQueued = false; p.interactQueued = false;
  movePlayerBody({ p, cache, combat, dtSeconds });
  updatePlayerFogOfWar(p, dayPhase);
  updatePlayerStealthAndNoise({ p, cache, combat, dayPhase, dtSeconds });
}
