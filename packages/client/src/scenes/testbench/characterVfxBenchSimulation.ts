import type Phaser from "phaser";
import { cloneBody, TICK_DT, stepBody, type WorldView } from "@dc2d/engine";
import { worldToScreen } from "../../render/entities/geometry/worldToScreen.js";
import type { CharacterVfxActor } from "./characterVfxBenchActors.js";
const JUMP_GROUNDED_PAUSE_MS = 1200;
const FIXED_STEP_MS = TICK_DT * 1000;

export interface CharacterVfxActorFrame {
  readonly scene: Phaser.Scene;
  readonly actors: readonly CharacterVfxActor[];
  readonly world: CharacterVfxWorld;
  readonly nowMs: number;
  readonly deltaMs: number;
  readonly physicsAccumulatorMs: number;
}

type CharacterVfxWorld = WorldView;

export function updateCharacterVfxActors(frame: CharacterVfxActorFrame): number {
  let accumulatorMs = frame.physicsAccumulatorMs + frame.deltaMs;
  while (accumulatorMs >= FIXED_STEP_MS) {
    for (const actor of frame.actors) stepActor(frame.world, actor);
    accumulatorMs -= FIXED_STEP_MS;
  }
  const renderAlpha = accumulatorMs / FIXED_STEP_MS;
  for (const actor of frame.actors) {
    interpolateActor(actor, renderAlpha);
    updateVfx({ scene: frame.scene, actor, nowMs: frame.nowMs, world: frame.world });
  }
  return accumulatorMs;
}

interface VfxUpdate {
  readonly scene: Phaser.Scene;
  readonly actor: CharacterVfxActor;
  readonly nowMs: number;
  readonly world: CharacterVfxWorld;
}

function stepActor(world: CharacterVfxWorld, actor: CharacterVfxActor): void {
  actor.state.previousBody = cloneBody(actor.state.body);
  const input = inputForActor(actor);
  const result = stepBody(world, actor.state.body, input, TICK_DT);
  if (actor.id === "jump" && result.landed) {
    actor.state.jumpPauseMs = JUMP_GROUNDED_PAUSE_MS;
    actor.state.jumpStarted = false;
  }
  constrainMovingActor(actor);
}

function interpolateActor(actor: CharacterVfxActor, alpha: number): void {
  const previous = actor.state.previousBody;
  const current = actor.state.body;
  actor.state.renderX = interpolate(previous.x, current.x, alpha);
  actor.state.renderY = interpolate(previous.y, current.y, alpha);
  actor.state.renderZ = interpolate(previous.z, current.z, alpha);
  actor.state.renderAir = !current.grounded;
}

function interpolate(previous: number, current: number, alpha: number): number {
  return previous + (current - previous) * alpha;
}

function inputForActor(actor: CharacterVfxActor) {
  if (actor.id === "breath") return { moveX: 0, moveY: 0, jump: false };
  if (actor.id === "jump") return jumpInput(actor);
  return { moveX: actor.state.faceX, moveY: 0, jump: false, run: actor.id === "run" };
}

function jumpInput(actor: CharacterVfxActor): { moveX: number; moveY: number; jump: boolean } {
  const body = actor.state.body;
  if (!body.grounded) return { moveX: 0, moveY: 0, jump: true };
  if (actor.state.jumpPauseMs > 0) {
    actor.state.jumpPauseMs -= FIXED_STEP_MS;
    return { moveX: 0, moveY: 0, jump: false };
  }
  if (actor.state.jumpStarted) return { moveX: 0, moveY: 0, jump: false };
  actor.state.jumpStarted = true;
  return { moveX: 0, moveY: 0, jump: true };
}

function constrainMovingActor(actor: CharacterVfxActor): void {
  if (actor.id === "run") constrainWithin(actor, 11, 17);
  if (actor.id === "walk") constrainWithin(actor, 19, 25);
}

function constrainWithin(actor: CharacterVfxActor, min: number, max: number): void {
  if (actor.state.body.x <= min) {
    actor.state.body.x = min;
    actor.state.faceX = 1;
  }
  if (actor.state.body.x >= max) {
    actor.state.body.x = max;
    actor.state.faceX = -1;
  }
}

function updateVfx({ scene, actor, nowMs, world }: VfxUpdate): void {
  if (actor.id === "breath") updateBreathActor(scene, actor, nowMs);
  else trackMotion(actor, world, nowMs);
  actor.vfx.update(nowMs);
}

function updateBreathActor(scene: Phaser.Scene, actor: CharacterVfxActor, nowMs: number): void {
  actor.state.faceX = pointerFacingSign(scene, actor);
  actor.vfx.syncOutOfBreath({
    x: actor.state.renderX,
    y: actor.state.renderY,
    z: actor.state.renderZ,
    faceX: actor.state.faceX,
    exhausted: true,
    nowMs,
  });
}

function trackMotion(actor: CharacterVfxActor, world: CharacterVfxWorld, nowMs: number): void {
  actor.vfx.trackPlayerMotion({
    x: actor.state.renderX,
    y: actor.state.renderY,
    groundHeight: world.groundAt(actor.state.renderX, actor.state.renderY),
    air: actor.state.renderAir,
    faceX: actor.state.faceX,
    nowMs,
  });
}

function pointerFacingSign(scene: Phaser.Scene, actor: CharacterVfxActor): number {
  const camera = scene.cameras.main;
  const pointerWorld = camera.getWorldPoint(scene.input.activePointer.x, scene.input.activePointer.y);
  const actorWorld = worldToScreen(actor.state.renderX, actor.state.renderY);
  return pointerWorld.x < actorWorld.x ? -1 : 1;
}
