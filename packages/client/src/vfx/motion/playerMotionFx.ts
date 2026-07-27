import type Phaser from "phaser";
import { worldToScreen } from "../../render/entities/geometry/worldToScreen.js";
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

interface ParticleFrame {
  readonly sample: MotionSample;
  readonly moving: boolean;
  readonly running: boolean;
  readonly nowMs: number;
}

export class PlayerMotionFx {
  private readonly samples = new MotionSampleBuffer();
  private readonly events: MotionEvent[] = [];
  private lastFrameMs = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  get latest(): MotionSample | undefined {
    return this.samples.latest;
  }

  track(input: MotionSample, nowMs: number): void {
    const sample = this.samples.begin(input);
    const previous = this.samples.previous;
    const dt = (nowMs - this.lastFrameMs) / 1000;
    const moving = isMoving(previous, sample, dt);
    const running = isRunning(previous, sample, dt);
    motionEventsInto(previous, sample, this.events);
    this.fireParticles({ sample, moving, running, nowMs });
    this.samples.commit();
    this.lastFrameMs = nowMs;
  }

  private fireParticles({ sample, moving, running, nowMs }: ParticleFrame): void {
    const screen = worldToScreen(sample.x, sample.y);
    if (this.events.includes("jumped") || this.events.includes("turned")) {
      spawnDustPuff(this.scene, { x: screen.x, y: screen.y, quantity: 5 });
    }
    if (this.events.includes("landed")) {
      spawnDustPuff(this.scene, { x: screen.x, y: screen.y, quantity: 8 });
    }
    if (!footstepDue({ previousMs: this.lastFrameMs, nowMs, grounded: !sample.air, moving })) return;
    if (running) spawnRunDust(this.scene, screen);
    else spawnFootstepMote(this.scene, screen);
  }
}
