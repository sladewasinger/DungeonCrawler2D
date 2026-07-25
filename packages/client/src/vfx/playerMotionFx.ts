import type Phaser from "phaser";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import { spawnDustPuff, spawnFootstepMote, spawnRunDust } from "./movementParticles.js";
import {
  footstepDue,
  isMoving,
  isRunning,
  motionEventsInto,
  type MotionEvent,
  type MotionSample,
} from "./motionFx.js";
import { MotionSampleBuffer } from "./motionSampleBuffer.js";

export class PlayerMotionFx {
  private readonly samples = new MotionSampleBuffer();
  private readonly events: MotionEvent[] = [];
  private lastFrameMs = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  get latest(): MotionSample | undefined {
    return this.samples.latest;
  }

  track(
    x: number,
    y: number,
    air: boolean,
    faceX: number,
    nowMs: number,
  ): void {
    const sample = this.samples.begin(x, y, air, faceX);
    const previous = this.samples.previous;
    const dt = (nowMs - this.lastFrameMs) / 1000;
    const moving = isMoving(previous, sample, dt);
    const running = isRunning(previous, sample, dt);
    motionEventsInto(previous, sample, this.events);
    this.fireParticles(sample, moving, running, nowMs);
    this.samples.commit();
    this.lastFrameMs = nowMs;
  }

  private fireParticles(
    sample: MotionSample,
    moving: boolean,
    running: boolean,
    nowMs: number,
  ): void {
    const screen = worldToScreen(sample.x, sample.y);
    if (this.events.includes("jumped") || this.events.includes("turned")) {
      spawnDustPuff(this.scene, screen.x, screen.y, 5);
    }
    if (this.events.includes("landed")) {
      spawnDustPuff(this.scene, screen.x, screen.y, 8);
    }
    if (!footstepDue(this.lastFrameMs, nowMs, !sample.air, moving)) return;
    if (running) spawnRunDust(this.scene, screen.x, screen.y);
    else spawnFootstepMote(this.scene, screen.x, screen.y);
  }
}
