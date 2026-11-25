/** Distance attenuation and stereo spatialization helpers for world sound events. */

export const SPATIAL_AUDIO_DEFAULTS = {
  fullGainTiles: 2.5,
  maxDistanceTiles: 22,
  panDivisorTiles: 8,
  maxPan: 0.85,
  exponent: 1.55,
} as const;

export interface SpatialMix {
  readonly audible: boolean;
  readonly distance: number;
  readonly gain: number;
  readonly pan: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function computeSpatialMix(offset: { readonly dx: number; readonly dy: number }): SpatialMix {
  const distance = Math.hypot(offset.dx, offset.dy);
  if (distance >= SPATIAL_AUDIO_DEFAULTS.maxDistanceTiles) {
    return { audible: false, distance, gain: 0, pan: 0 };
  }
  const pan = clamp(
    offset.dx / SPATIAL_AUDIO_DEFAULTS.panDivisorTiles,
    -SPATIAL_AUDIO_DEFAULTS.maxPan,
    SPATIAL_AUDIO_DEFAULTS.maxPan,
  );
  if (distance <= SPATIAL_AUDIO_DEFAULTS.fullGainTiles) {
    return { audible: true, distance, gain: 1, pan };
  }
  const span = SPATIAL_AUDIO_DEFAULTS.maxDistanceTiles - SPATIAL_AUDIO_DEFAULTS.fullGainTiles;
  const t = clamp((distance - SPATIAL_AUDIO_DEFAULTS.fullGainTiles) / span, 0, 1);
  return { audible: true, distance, gain: Math.pow(1 - t, SPATIAL_AUDIO_DEFAULTS.exponent), pan };
}

function scheduleBusCleanup(nodes: readonly AudioNode[], delayMs = 3200): void {
  if (typeof globalThis.setTimeout !== "function") return;
  const timer = globalThis.setTimeout(() => {
    for (const n of nodes) {
      try { n.disconnect(); } catch { /* detached */ }
    }
  }, delayMs);
  if (typeof timer === "object" && timer !== null && "unref" in timer) {
    (timer as { unref?: () => void }).unref?.();
  }
}

export function createSpatialBus(opts: {
  readonly ctx: AudioContext;
  readonly dst: AudioNode;
  readonly mix: SpatialMix;
}): AudioNode {
  const gain = opts.ctx.createGain();
  gain.gain.value = clamp(opts.mix.gain, 0, 1);
  gain.connect(opts.dst);
  if (typeof opts.ctx.createStereoPanner !== "function") {
    scheduleBusCleanup([gain]);
    return gain;
  }
  const panner = opts.ctx.createStereoPanner();
  panner.pan.value = opts.mix.pan;
  panner.connect(gain);
  scheduleBusCleanup([panner, gain]);
  return panner;
}
