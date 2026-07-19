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

/** Record a snapshot position, discarding samples older than a second. */
export function recordSample(remote: RemoteEntity, now: number, snap: EntitySnapshot): void {
  remote.snap = snap;
  remote.samples.push({ t: now, x: snap.x, y: snap.y, z: snap.z });
  // length > 0 just checked: index 0 exists.
  while (remote.samples.length > 0 && now - remote.samples[0]!.t > 1000) {
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
    const s = remote.samples;
    if (s.length === 0) continue;
    // s.length > 0 just checked, and the loop below only indexes within [0, s.length).
    let pos: Sample = s[s.length - 1]!;
    for (let i = s.length - 1; i > 0; i--) {
      const a = s[i - 1]!;
      const b = s[i]!;
      if (a.t <= t && t <= b.t) {
        const k = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
        pos = { t, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
        break;
      }
    }
    if (t < s[0]!.t) pos = s[0]!;
    out.push({ id, snap: remote.snap, x: pos.x, y: pos.y, z: pos.z });
  }
  return out;
}
