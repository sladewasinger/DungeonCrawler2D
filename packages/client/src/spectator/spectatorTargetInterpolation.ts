import { TICK_RATE } from "@dc2d/engine";

const MAX_EXTRAPOLATION_MS = 100;
const SAMPLE_HISTORY_MS = 1000;
const TICK_MS = 1000 / TICK_RATE;

export interface SpectatorTargetPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SpectatorTargetInterpolationInput {
  readonly pose: SpectatorTargetPose;
  readonly tick: number;
  readonly renderAtMs: number;
  readonly delayMs: number;
  readonly targetId: string | null;
  readonly world: object | null;
  readonly reset?: boolean;
}

interface SpectatorTargetSample extends SpectatorTargetPose {
  readonly atMs: number;
}

/** Smooths the streamed target without running local player prediction. */
export class SpectatorTargetInterpolation {
  private readonly samples: SpectatorTargetSample[] = [];
  private lastTick: number | null = null;
  private targetId: string | null = null;
  private world: object | null = null;

  update(input: SpectatorTargetInterpolationInput): SpectatorTargetPose {
    if (this.shouldReset(input)) this.reset(input);
    else if (this.lastTick !== input.tick) this.record(input);
    return interpolateTarget(this.samples, input.renderAtMs - input.delayMs);
  }

  reset(input: SpectatorTargetInterpolationInput): void {
    this.samples.length = 0;
    this.lastTick = input.tick;
    this.targetId = input.targetId;
    this.world = input.world;
    this.samples.push(sampleAt(input));
  }

  private shouldReset(input: SpectatorTargetInterpolationInput): boolean {
    return input.reset === true || this.lastTick === null || input.tick < this.lastTick ||
      input.targetId !== this.targetId || input.world !== this.world;
  }

  private record(input: SpectatorTargetInterpolationInput): void {
    this.lastTick = input.tick;
    const sample = sampleAt(input);
    this.samples.push(sample);
    while (this.samples[0] && sample.atMs - this.samples[0].atMs > SAMPLE_HISTORY_MS) {
      this.samples.shift();
    }
  }
}

function sampleAt(input: SpectatorTargetInterpolationInput): SpectatorTargetSample {
  return { ...input.pose, atMs: input.tick * TICK_MS };
}

function interpolateTarget(
  samples: readonly SpectatorTargetSample[],
  targetMs: number,
): SpectatorTargetPose {
  const newest = samples.at(-1);
  if (!newest) return { x: 0, y: 0, z: 0 };
  const oldest = samples[0];
  if (!oldest || targetMs <= oldest.atMs) return { ...(oldest ?? newest) };
  const pair = interpolationPair(samples, targetMs);
  if (pair) return interpolateSamples(pair.previous, pair.next, targetMs);
  const previous = samples.at(-2);
  return previous ? extrapolateSample(previous, newest, targetMs) : { ...newest };
}

interface SpectatorSamplePair {
  readonly previous: SpectatorTargetSample;
  readonly next: SpectatorTargetSample;
}

function interpolationPair(
  samples: readonly SpectatorTargetSample[],
  targetMs: number,
): SpectatorSamplePair | null {
  for (let index = samples.length - 1; index > 0; index--) {
    const previous = samples[index - 1];
    const next = samples[index];
    if (previous && next && targetMs >= previous.atMs && targetMs <= next.atMs) {
      return { previous, next };
    }
  }
  return null;
}

function interpolateSamples(
  previous: SpectatorTargetSample,
  newest: SpectatorTargetSample,
  targetMs: number,
): SpectatorTargetPose {
  const duration = Math.max(1, newest.atMs - previous.atMs);
  const progress = Math.max(0, Math.min(1, (targetMs - previous.atMs) / duration));
  return blendPose(previous, newest, progress);
}

function extrapolateSample(
  previous: SpectatorTargetSample,
  newest: SpectatorTargetSample,
  targetMs: number,
): SpectatorTargetPose {
  const duration = Math.max(1, newest.atMs - previous.atMs);
  const progress = Math.min(MAX_EXTRAPOLATION_MS, targetMs - newest.atMs) / duration;
  return {
    x: newest.x + (newest.x - previous.x) * progress,
    y: newest.y + (newest.y - previous.y) * progress,
    z: newest.z + (newest.z - previous.z) * progress,
  };
}

function blendPose(
  previous: SpectatorTargetPose,
  newest: SpectatorTargetPose,
  progress: number,
): SpectatorTargetPose {
  return {
    x: previous.x + (newest.x - previous.x) * progress,
    y: previous.y + (newest.y - previous.y) * progress,
    z: previous.z + (newest.z - previous.z) * progress,
  };
}
