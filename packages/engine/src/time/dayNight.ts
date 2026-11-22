/** Continuous Day/Night cycle curves driving WebGL lighting, shadows, and particles. */
import { clamp, lerp, smoothstep } from "../math/noise.js";

export const DAY_DURATION_SECONDS = 480;

export type RgbTuple = readonly [number, number, number];

export type TimeOfDayPeriod = "Night" | "Dawn" | "Day" | "Golden Hour" | "Dusk";

export interface DayNightState {
  readonly phase: number;
  readonly period: TimeOfDayPeriod;
  readonly sunAngle: number;
  readonly shadowDx: number;
  readonly shadowDy: number;
  readonly shadowAlpha: number;
  readonly ambientRgb: RgbTuple;
  readonly sunRgb: RgbTuple;
  readonly fogRgb: RgbTuple;
  readonly bloomStrength: number;
  readonly sunbeamStrength: number;
  readonly fireflyStrength: number;
  readonly cloudShadowAlpha: number;
  readonly nightFactor: number;
}

interface PhaseKeyframe {
  readonly phase: number;
  readonly ambient: RgbTuple;
  readonly sun: RgbTuple;
  readonly fog: RgbTuple;
  readonly bloom: number;
  readonly beams: number;
  readonly fireflies: number;
  readonly clouds: number;
  readonly night: number;
}

const KEYFRAMES: readonly PhaseKeyframe[] = [
  { phase: 0.0, ambient: [0.22, 0.27, 0.48], sun: [0.35, 0.44, 0.72], fog: [0.16, 0.22, 0.38], bloom: 0.52, beams: 0.0, fireflies: 0.95, clouds: 0.12, night: 0.92 },
  { phase: 0.18, ambient: [0.26, 0.31, 0.52], sun: [0.55, 0.5, 0.68], fog: [0.24, 0.26, 0.42], bloom: 0.48, beams: 0.08, fireflies: 0.8, clouds: 0.15, night: 0.78 },
  { phase: 0.27, ambient: [0.84, 0.66, 0.56], sun: [1.0, 0.76, 0.54], fog: [0.92, 0.74, 0.58], bloom: 0.38, beams: 0.85, fireflies: 0.18, clouds: 0.24, night: 0.22 },
  { phase: 0.46, ambient: [0.95, 0.96, 0.92], sun: [1.0, 0.97, 0.88], fog: [0.82, 0.91, 0.84], bloom: 0.22, beams: 0.72, fireflies: 0.0, clouds: 0.32, night: 0.0 },
  { phase: 0.68, ambient: [0.96, 0.78, 0.58], sun: [1.0, 0.7, 0.4], fog: [0.95, 0.68, 0.46], bloom: 0.42, beams: 0.95, fireflies: 0.15, clouds: 0.26, night: 0.16 },
  { phase: 0.79, ambient: [0.52, 0.42, 0.62], sun: [0.86, 0.48, 0.42], fog: [0.42, 0.34, 0.54], bloom: 0.5, beams: 0.2, fireflies: 0.78, clouds: 0.16, night: 0.68 },
  { phase: 0.9, ambient: [0.23, 0.28, 0.5], sun: [0.38, 0.46, 0.75], fog: [0.16, 0.22, 0.38], bloom: 0.54, beams: 0.0, fireflies: 1.0, clouds: 0.12, night: 0.92 },
  { phase: 1.0, ambient: [0.22, 0.27, 0.48], sun: [0.35, 0.44, 0.72], fog: [0.16, 0.22, 0.38], bloom: 0.52, beams: 0.0, fireflies: 0.95, clouds: 0.12, night: 0.92 },
];

export function wrapDayPhase(phase: number): number {
  const mod = phase % 1;
  return mod < 0 ? mod + 1 : mod;
}

export function periodForPhase(phase: number): TimeOfDayPeriod {
  if (phase < 0.2 || phase >= 0.83) return "Night";
  if (phase < 0.32) return "Dawn";
  if (phase < 0.62) return "Day";
  if (phase < 0.74) return "Golden Hour";
  return "Dusk";
}

function lerpRgb(a: RgbTuple, b: RgbTuple, t: number): RgbTuple {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function findFramePair(phase: number): { a: PhaseKeyframe; b: PhaseKeyframe; t: number } {
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    const a = KEYFRAMES[i];
    const b = KEYFRAMES[i + 1];
    if (a && b && phase >= a.phase && phase <= b.phase) {
      const span = b.phase - a.phase || 1;
      return { a, b, t: smoothstep(0, 1, (phase - a.phase) / span) };
    }
  }
  const first = KEYFRAMES[0] ?? { phase: 0, ambient: [1, 1, 1], sun: [1, 1, 1], fog: [1, 1, 1], bloom: 0.2, beams: 0.5, fireflies: 0, clouds: 0.2, night: 0 };
  return { a: first, b: first, t: 0 };
}

export function sampleDayNight(rawPhase: number): DayNightState {
  const phase = wrapDayPhase(rawPhase);
  const { a, b, t } = findFramePair(phase);
  const nightFactor = lerp(a.night, b.night, t);
  const sunArc = (phase - 0.22) * Math.PI * 1.65;
  const sunAngle = clamp(sunArc, -Math.PI, Math.PI);
  const shadowDx = Math.cos(sunAngle + 0.55) * lerp(1.15, 0.45, 1 - nightFactor * 0.4);
  const shadowDy = Math.max(0.32, Math.sin(sunAngle) * 0.55 + 0.62);
  const shadowAlpha = lerp(0.38, 0.22, nightFactor);
  return {
    phase,
    period: periodForPhase(phase),
    sunAngle,
    shadowDx,
    shadowDy,
    shadowAlpha,
    ambientRgb: lerpRgb(a.ambient, b.ambient, t),
    sunRgb: lerpRgb(a.sun, b.sun, t),
    fogRgb: lerpRgb(a.fog, b.fog, t),
    bloomStrength: lerp(a.bloom, b.bloom, t),
    sunbeamStrength: lerp(a.beams, b.beams, t),
    fireflyStrength: lerp(a.fireflies, b.fireflies, t),
    cloudShadowAlpha: lerp(a.clouds, b.clouds, t),
    nightFactor,
  };
}
