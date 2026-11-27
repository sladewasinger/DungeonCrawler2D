/** Pure DAW timeline math: snap grid, left-edge push, left/right trim, reorder, and ADSR-style envelope points. */
import type { SoundTrackSpec } from "../studioTypes.js";

export const SNAP_STEPS_MS = [0, 1, 5, 10, 25] as const;

export function snapSec(sec: number, snapMs: number): number {
  if (snapMs <= 0) return Math.round(sec * 1000) / 1000;
  const step = snapMs / 1000;
  return Math.round((sec / step)) * step;
}

function roundMsPrecision(sec: number): number {
  return Math.round(sec * 1000) / 1000;
}

export function minTrackDelaySec(tracks: readonly SoundTrackSpec[]): number {
  if (tracks.length === 0) return 0;
  let min = tracks[0]!.delaySec;
  for (const t of tracks) min = Math.min(min, t.delaySec);
  return min;
}

export function trimLeadingSilence(tracks: readonly SoundTrackSpec[]): SoundTrackSpec[] {
  const shift = minTrackDelaySec(tracks);
  if (shift <= 0.0005) return [...tracks];
  return tracks.map((t) => ({ ...t, delaySec: Math.max(0, roundMsPrecision(t.delaySec - shift)) }));
}

export function reorderTracks(tracks: readonly SoundTrackSpec[], id: string, delta: -1 | 1): SoundTrackSpec[] {
  const idx = tracks.findIndex((t) => t.id === id);
  const next = idx + delta;
  if (idx < 0 || next < 0 || next >= tracks.length) return [...tracks];
  const copy = [...tracks];
  const tmp = copy[idx]!;
  copy[idx] = copy[next]!;
  copy[next] = tmp;
  return copy;
}

export function applyTrackMove(opts: {
  readonly tracks: readonly SoundTrackSpec[]; readonly id: string;
  readonly targetDelaySec: number; readonly snapMs: number;
}): SoundTrackSpec[] {
  if (opts.targetDelaySec < 0) {
    const pushRaw = -opts.targetDelaySec;
    const pushSec = Math.min(3, snapSec(pushRaw, opts.snapMs));
    return opts.tracks.map((t) => (
      t.id === opts.id
        ? { ...t, delaySec: 0 }
        : { ...t, delaySec: Math.min(3, roundMsPrecision(t.delaySec + pushSec)) }
    ));
  }
  const clamped = Math.max(0, Math.min(3, snapSec(opts.targetDelaySec, opts.snapMs)));
  const delaySec = roundMsPrecision(clamped);
  return opts.tracks.map((t) => (t.id === opts.id ? { ...t, delaySec } : t));
}

export function applyLeftTrim(opts: {
  readonly track: SoundTrackSpec; readonly targetStartSec: number; readonly snapMs: number;
}): { readonly delaySec: number; readonly durationSec: number } {
  const endSec = opts.track.delaySec + opts.track.durationSec;
  const maxStart = Math.max(0, endSec - 0.02);
  const nextStart = Math.max(0, Math.min(maxStart, roundMsPrecision(snapSec(opts.targetStartSec, opts.snapMs))));
  return {
    delaySec: nextStart,
    durationSec: Math.max(0.02, Math.min(3, roundMsPrecision(endSec - nextStart))),
  };
}

export function applyRightResize(opts: {
  readonly track: SoundTrackSpec; readonly targetEndSec: number; readonly snapMs: number;
}): { readonly durationSec: number } {
  const minEnd = opts.track.delaySec + 0.02;
  const maxEnd = Math.min(3.5, opts.track.delaySec + 3);
  const nextEnd = Math.max(minEnd, Math.min(maxEnd, snapSec(opts.targetEndSec, opts.snapMs)));
  return {
    durationSec: Math.max(0.02, Math.min(3, roundMsPrecision(nextEnd - opts.track.delaySec))),
  };
}

export function computeEnvelopePoints(track: SoundTrackSpec): readonly { readonly t: number; readonly amp: number }[] {
  const dur = Math.max(0.02, track.durationSec);
  const tAttack = Math.min(0.65, Math.max(0.02, track.attackSec / dur));
  const tHold = Math.min(0.95, tAttack + Math.max(0, track.holdSec / dur));
  const pts: { readonly t: number; readonly amp: number }[] = [{ t: 0, amp: 0 }, { t: tAttack, amp: 1 }];
  if (tHold > tAttack + 0.005) pts.push({ t: tHold, amp: 1 });
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    pts.push({ t: tHold + (1 - tHold) * f, amp: Math.pow(0.015, f) });
  }
  return pts;
}

export function adaptiveTickStepMs(spanSec: number): number {
  if (spanSec <= 0.14) return 20;
  if (spanSec <= 0.35) return 50;
  if (spanSec <= 0.85) return 100;
  if (spanSec <= 1.8) return 200;
  return 500;
}
