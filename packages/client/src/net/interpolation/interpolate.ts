import type { EntitySnapshot } from "@dc2d/engine";

/**
 * Remote entities render slightly in the past, lerped between snapshot
 * samples — 15-20 Hz server updates become smooth 60 fps motion.
 */

export interface Sample {
  t: number;
  x: number;
  y: number;
  z: number;
}

export interface RemoteEntity {
  snap: EntitySnapshot;
  samples: Sample[];
}

export interface InterpolatedEntity {
  id: string;
  snap: EntitySnapshot;
  x: number;
  y: number;
  z: number;
}

export const MAX_EXTRAPOLATION_MS = 150;
export const REMOTE_SAMPLE_HISTORY_MS = 1000;

/** Record a snapshot position, discarding samples older than a second. */
export function recordSample(remote: RemoteEntity, now: number, snap: EntitySnapshot): void {
  remote.snap = snap;
  let recycled: Sample | undefined;
  while (
    remote.samples[0] &&
    now - remote.samples[0].t > REMOTE_SAMPLE_HISTORY_MS
  ) {
    const stale = remote.samples.shift();
    if (!recycled) recycled = stale;
  }
  const sample = recycled ?? { t: now, x: snap.x, y: snap.y, z: snap.z };
  sample.t = now;
  sample.x = snap.x;
  sample.y = snap.y;
  sample.z = snap.z;
  remote.samples.push(sample);
}

/** Peer positions rendered `delayMs` in the past, lerped. */
export function interpolated(
  entities: ReadonlyMap<string, RemoteEntity>,
  delayMs: number,
  now: number = performance.now(),
): InterpolatedEntity[] {
  return interpolateInto({ entities, delayMs, now, out: [] });
}

export interface InterpolationFrameInput {
  readonly entities: ReadonlyMap<string, RemoteEntity>;
  readonly delayMs: number;
  readonly now: number;
  readonly out: InterpolatedEntity[];
}

/**
 * Writes one presentation frame into caller-owned storage. Records are reused by
 * index, so renderers must consume the returned frame synchronously and not retain it.
 */
export function interpolateInto({
  entities,
  delayMs,
  now,
  out,
}: InterpolationFrameInput): InterpolatedEntity[] {
  const t = now - delayMs;
  let count = 0;
  for (const [id, remote] of entities) {
    const target = out[count] ?? {
      id,
      snap: remote.snap,
      x: 0,
      y: 0,
      z: 0,
    };
    if (!sampleInto({ samples: remote.samples, snap: remote.snap, targetTime: t, out: target })) continue;
    target.id = id;
    target.snap = remote.snap;
    out[count] = target;
    count++;
  }
  out.length = count;
  return out;
}

interface SampleInput {
  readonly samples: Sample[];
  readonly snap: EntitySnapshot;
  readonly targetTime: number;
  readonly out: InterpolatedEntity;
}

function sampleInto({ samples, snap, targetTime, out }: SampleInput): boolean {
  const newest = samples.at(-1);
  if (!newest) return false;
  const oldest = samples[0];
  if (oldest && targetTime < oldest.t) {
    writePosition({ out, x: oldest.x, y: oldest.y, z: oldest.z });
    return true;
  }

  const sampleTime = interpolateOrNewestInto({ samples, newest, targetTime, out });
  extrapolateInto({ out, snap, sampleTime, targetTime });
  return true;
}

interface InterpolateSamplesInput {
  readonly samples: Sample[];
  readonly newest: Sample;
  readonly targetTime: number;
  readonly out: InterpolatedEntity;
}

function interpolateOrNewestInto({ samples, newest, targetTime, out }: InterpolateSamplesInput): number {
  for (let index = samples.length - 1; index > 0; index--) {
    const left = samples[index - 1];
    const right = samples[index];
    if (!left || !right || targetTime < left.t || targetTime > right.t) continue;
    const amount = right.t === left.t ? 1 : (targetTime - left.t) / (right.t - left.t);
    writePosition({
      out,
      x: left.x + (right.x - left.x) * amount,
      y: left.y + (right.y - left.y) * amount,
      z: left.z + (right.z - left.z) * amount,
    });
    return targetTime;
  }
  writePosition({ out, x: newest.x, y: newest.y, z: newest.z });
  return newest.t;
}

interface ExtrapolateInput {
  readonly out: InterpolatedEntity;
  readonly snap: EntitySnapshot;
  readonly sampleTime: number;
  readonly targetTime: number;
}

function extrapolateInto({ out, snap, sampleTime, targetTime }: ExtrapolateInput): void {
  if (targetTime <= sampleTime) return;
  const elapsedSeconds = Math.min(
    targetTime - sampleTime,
    MAX_EXTRAPOLATION_MS,
  ) / 1000;
  out.x += (snap.vx ?? 0) * elapsedSeconds;
  out.y += (snap.vy ?? 0) * elapsedSeconds;
  if (snap.air) out.z += (snap.vz ?? 0) * elapsedSeconds;
}

interface PositionWrite {
  readonly out: InterpolatedEntity;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function writePosition({ out, x, y, z }: PositionWrite): void {
  out.x = x;
  out.y = y;
  out.z = z;
}
