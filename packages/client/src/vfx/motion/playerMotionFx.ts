import type Phaser from "phaser";
import { groundToScreen } from "../../render/entities/geometry/worldToScreen.js";
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

const LANDING_DUST_QUANTITY = 14;
const RUN_DUST_INTERVAL_MS = 90;

interface ParticleFrame {
  readonly sample: MotionSample;
  readonly moving: boolean;
  readonly running: boolean;
  readonly nowMs: number;
}

interface RunDustFrame {
  readonly screen: { readonly x: number; readonly y: number };
  readonly running: boolean;
  readonly grounded: boolean;
  readonly nowMs: number;
}

export class PlayerMotionFx {
  private readonly samples = new MotionSampleBuffer();
  private readonly events: MotionEvent[] = [];
  private lastFrameMs = 0;
  private lastRunDustMs = Number.NEGATIVE_INFINITY;

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
    const screen = groundToScreen(sample.x, sample.y, sample.groundHeight);
    this.fireRunDust({ screen, running, grounded: !sample.air, nowMs });
    if (this.events.includes("jumped") || this.events.includes("turned")) {
      spawnDustPuff(this.scene, { x: screen.x, y: screen.y, quantity: 5 });
    }
    if (this.events.includes("landed")) {
      spawnDustPuff(this.scene, { x: screen.x, y: screen.y, quantity: LANDING_DUST_QUANTITY });
    }
    if (running || !footstepDue({ previousMs: this.lastFrameMs, nowMs, grounded: !sample.air, moving })) return;
    spawnFootstepMote(this.scene, screen);
  }

  private fireRunDust({ screen, running, grounded, nowMs }: RunDustFrame): void {
    if (!running || !grounded) {
      this.lastRunDustMs = Number.NEGATIVE_INFINITY;
      return;
    }
    if (nowMs - this.lastRunDustMs < RUN_DUST_INTERVAL_MS) return;
    spawnRunDust(this.scene, screen);
    this.lastRunDustMs = nowMs;
  }
}
