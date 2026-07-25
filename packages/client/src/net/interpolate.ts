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

/** Record a snapshot position, discarding samples older than a second. */
export function recordSample(remote: RemoteEntity, now: number, snap: EntitySnapshot): void {
  remote.snap = snap;
  remote.samples.push({ t: now, x: snap.x, y: snap.y, z: snap.z });
  while (remote.samples[0] && now - remote.samples[0].t > 1000) {
    remote.samples.shift();
  }
}

/** Peer positions rendered `delayMs` in the past, lerped. */
export function interpolated(
  entities: ReadonlyMap<string, RemoteEntity>,
  delayMs: number,
  now: number = performance.now(),
): InterpolatedEntity[] {
  return interpolateInto(entities, delayMs, now, []);
}

/**
 * Writes one presentation frame into caller-owned storage. Records are reused by
 * index, so renderers must consume the returned frame synchronously and not retain it.
 */
export function interpolateInto(
  entities: ReadonlyMap<string, RemoteEntity>,
  delayMs: number,
  now: number,
  out: InterpolatedEntity[],
): InterpolatedEntity[] {
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
    if (!sampleInto(remote.samples, remote.snap, t, target)) continue;
    target.id = id;
    target.snap = remote.snap;
    out[count] = target;
    count++;
  }
  out.length = count;
  return out;
}

function sampleInto(
  samples: Sample[],
  snap: EntitySnapshot,
  targetTime: number,
  out: InterpolatedEntity,
): boolean {
  const newest = samples.at(-1);
  if (!newest) return false;
  const oldest = samples[0];
  if (oldest && targetTime < oldest.t) {
    writePosition(out, oldest.x, oldest.y, oldest.z);
    return true;
  }

  const sampleTime = interpolateOrNewestInto(
    samples,
    newest,
    targetTime,
    out,
  );
  extrapolateInto(out, snap, sampleTime, targetTime);
  return true;
}

function interpolateOrNewestInto(
  samples: Sample[],
  newest: Sample,
  targetTime: number,
  out: InterpolatedEntity,
): number {
  for (let index = samples.length - 1; index > 0; index--) {
    const left = samples[index - 1];
    const right = samples[index];
    if (!left || !right || targetTime < left.t || targetTime > right.t) continue;
    const amount = right.t === left.t ? 1 : (targetTime - left.t) / (right.t - left.t);
    writePosition(
      out,
      left.x + (right.x - left.x) * amount,
      left.y + (right.y - left.y) * amount,
      left.z + (right.z - left.z) * amount,
    );
    return targetTime;
  }
  writePosition(out, newest.x, newest.y, newest.z);
  return newest.t;
}

function extrapolateInto(
  out: InterpolatedEntity,
  snap: EntitySnapshot,
  sampleTime: number,
  targetTime: number,
): void {
  if (targetTime <= sampleTime) return;
  const elapsedSeconds = Math.min(
    targetTime - sampleTime,
    MAX_EXTRAPOLATION_MS,
  ) / 1000;
  out.x += (snap.vx ?? 0) * elapsedSeconds;
  out.y += (snap.vy ?? 0) * elapsedSeconds;
  if (snap.air) out.z += (snap.vz ?? 0) * elapsedSeconds;
}

function writePosition(
  out: InterpolatedEntity,
  x: number,
  y: number,
  z: number,
): void {
  out.x = x;
  out.y = y;
  out.z = z;
}
