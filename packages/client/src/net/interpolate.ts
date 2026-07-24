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
): Array<{ id: string; snap: EntitySnapshot; x: number; y: number; z: number }> {
  const t = now - delayMs;
  const out: Array<{ id: string; snap: EntitySnapshot; x: number; y: number; z: number }> = [];
  for (const [id, remote] of entities) {
    const pos = sampleAtTime(remote.samples, remote.snap, t);
    if (!pos) continue;
    out.push({ id, snap: remote.snap, x: pos.x, y: pos.y, z: pos.z });
  }
  return out;
}

function sampleAtTime(
  samples: Sample[],
  snap: EntitySnapshot,
  targetTime: number,
): Sample | null {
  const newest = samples.at(-1);
  if (!newest) return null;
  const oldest = samples[0];
  if (oldest && targetTime < oldest.t) return oldest;
  const pair = bracketingPair(samples, targetTime);
  const sample = pair ? lerp(pair[0], pair[1], targetTime) : newest;
  return targetTime > sample.t ? extrapolate(sample, snap, targetTime) : sample;
}

function bracketingPair(samples: Sample[], targetTime: number): [Sample, Sample] | null {
  for (let index = samples.length - 1; index > 0; index--) {
    const left = samples[index - 1];
    const right = samples[index];
    if (left && right && left.t <= targetTime && targetTime <= right.t) {
      return [left, right];
    }
  }
  return null;
}

function lerp(left: Sample, right: Sample, targetTime: number): Sample {
  const amount = right.t === left.t ? 1 : (targetTime - left.t) / (right.t - left.t);
  return {
    t: targetTime,
    x: left.x + (right.x - left.x) * amount,
    y: left.y + (right.y - left.y) * amount,
    z: left.z + (right.z - left.z) * amount,
  };
}

function extrapolate(sample: Sample, snap: EntitySnapshot, targetTime: number): Sample {
  const elapsedMs = Math.min(targetTime - sample.t, MAX_EXTRAPOLATION_MS);
  const elapsedSeconds = elapsedMs / 1000;
  return {
    t: sample.t + elapsedMs,
    x: sample.x + (snap.vx ?? 0) * elapsedSeconds,
    y: sample.y + (snap.vy ?? 0) * elapsedSeconds,
    z: sample.z + (snap.air ? (snap.vz ?? 0) * elapsedSeconds : 0),
  };
}
