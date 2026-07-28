import type Phaser from "phaser";
import { GRAVITY, JUMP_VELOCITY } from "@dc2d/engine";
import { worldToScreen } from "../../render/entities/geometry/worldToScreen.js";
import type { CharacterVfxActor } from "./characterVfxBenchActors.js";

const JUMP_APEX_Z = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
const JUMP_ASCENT_MS = JUMP_VELOCITY / GRAVITY * 1000;
const JUMP_DESCENT_MS = Math.sqrt(JUMP_APEX_Z / GRAVITY) * 1000;
const JUMP_AIRBORNE_MS = JUMP_ASCENT_MS + JUMP_DESCENT_MS;
const JUMP_GROUNDED_PAUSE_MS = 1200;
const JUMP_CYCLE_MS = JUMP_GROUNDED_PAUSE_MS + JUMP_AIRBORNE_MS;

export interface CharacterVfxActorFrame {
  readonly scene: Phaser.Scene;
  readonly actors: readonly CharacterVfxActor[];
  readonly nowMs: number;
  readonly deltaMs: number;
}

export function updateCharacterVfxActors({ scene, actors, nowMs, deltaMs }: CharacterVfxActorFrame): void {
  for (const actor of actors) updateActor({ scene, actor, nowMs, deltaMs });
}

interface ActorUpdate {
  readonly scene: Phaser.Scene;
  readonly actor: CharacterVfxActor;
  readonly nowMs: number;
  readonly deltaMs: number;
}

function updateActor({ scene, actor, nowMs, deltaMs }: ActorUpdate): void {
  if (actor.id === "breath") updateBreathActor(scene, actor, nowMs);
  if (actor.id === "run") updateMovingActor({ actor, nowMs, deltaMs, bounds: { speed: 4.8, min: 11, max: 17 } });
  if (actor.id === "walk") updateMovingActor({ actor, nowMs, deltaMs, bounds: { speed: 1.1, min: 19, max: 25 } });
  if (actor.id === "jump") updateJumpingActor(actor, nowMs);
  actor.vfx.update(nowMs);
}

function updateBreathActor(scene: Phaser.Scene, actor: CharacterVfxActor, nowMs: number): void {
  actor.state.faceX = pointerFacingSign(scene, actor);
  actor.vfx.syncOutOfBreath({
    x: actor.state.x,
    y: actor.state.y,
    z: actor.state.z,
    faceX: actor.state.faceX,
    exhausted: true,
    nowMs,
  });
}

interface MovingActorUpdate {
  readonly actor: CharacterVfxActor;
  readonly nowMs: number;
  readonly deltaMs: number;
  readonly bounds: MotionBounds;
}

interface MotionBounds {
  readonly speed: number;
  readonly min: number;
  readonly max: number;
}

function updateMovingActor({ actor, nowMs, deltaMs, bounds }: MovingActorUpdate): void {
  actor.state.x += actor.state.faceX * bounds.speed * deltaMs / 1000;
  if (actor.state.x <= bounds.min) {
    actor.state.x = bounds.min;
    actor.state.faceX = 1;
  }
  if (actor.state.x >= bounds.max) {
    actor.state.x = bounds.max;
    actor.state.faceX = -1;
  }
  trackMotion(actor, nowMs);
}

function updateJumpingActor(actor: CharacterVfxActor, nowMs: number): void {
  const cycleMs = nowMs % JUMP_CYCLE_MS;
  const airElapsedMs = cycleMs - JUMP_GROUNDED_PAUSE_MS;
  actor.state.air = airElapsedMs > 0 && airElapsedMs < JUMP_AIRBORNE_MS;
  actor.state.z = actor.state.air ? jumpHeightAt(airElapsedMs) : 0;
  trackMotion(actor, nowMs);
}

function jumpHeightAt(elapsedMs: number): number {
  if (elapsedMs <= JUMP_ASCENT_MS) {
    const seconds = elapsedMs / 1000;
    return JUMP_VELOCITY * seconds - GRAVITY * seconds * seconds / 2;
  }
  const descentSeconds = (elapsedMs - JUMP_ASCENT_MS) / 1000;
  return Math.max(0, JUMP_APEX_Z - GRAVITY * descentSeconds * descentSeconds);
}

function trackMotion(actor: CharacterVfxActor, nowMs: number): void {
  actor.vfx.trackPlayerMotion({
    x: actor.state.x,
    y: actor.state.y,
    groundHeight: 0,
    air: actor.state.air,
    faceX: actor.state.faceX,
    nowMs,
  });
}

function pointerFacingSign(scene: Phaser.Scene, actor: CharacterVfxActor): number {
  const camera = scene.cameras.main;
  const ground = worldToScreen(actor.state.x, actor.state.y);
  const screenX = (ground.x - camera.scrollX) * camera.zoom;
  return scene.input.activePointer.x < screenX ? -1 : 1;
}
