/** Plays per-species procedural creature voices with optional Sound Studio sample overrides. */
import type { CreatureVocalKind } from "@dc2d/engine";
import { playNoiseBurst, playSweptNoise, playTone } from "../synthSfx.js";
import { BEAST_VOICE_SPECS } from "./creatureVoiceSpecs.js";
import { POI_VOICE_SPECS } from "./creaturePoiVoiceSpecs.js";
import {
  CREATURE_VOICE_KINDS, type CreatureVoiceKind, type CreatureVoiceSet, type VoiceLayer,
} from "./creatureVoiceTypes.js";

export { CREATURE_VOICE_KINDS, CREATURE_VOCAL_KINDS, type CreatureVoiceKind } from "./creatureVoiceTypes.js";

const CREATURE_VOICE_SET = new Set<string>(CREATURE_VOICE_KINDS);

const ALL_VOICE_SPECS: Record<CreatureVoiceKind, CreatureVoiceSet> = {
  ...BEAST_VOICE_SPECS,
  ...POI_VOICE_SPECS,
};

export interface CreatureVocalPlayOpts {
  readonly ctx: AudioContext;
  readonly dst: AudioNode;
  readonly kind: CreatureVoiceKind;
  readonly vocal: CreatureVocalKind;
  readonly sampleOverride?: AudioBuffer | undefined;
  readonly gainScale?: number | undefined;
  readonly delaySec?: number | undefined;
}

export function isWildlifeVoiceKind(kind: unknown): kind is CreatureVoiceKind {
  return typeof kind === "string" && CREATURE_VOICE_SET.has(kind);
}

export function getCreatureVoiceSpec(kind: CreatureVoiceKind, vocal: CreatureVocalKind): readonly VoiceLayer[] {
  return ALL_VOICE_SPECS[kind][vocal];
}

function playSampleOverride(opts: {
  readonly ctx: AudioContext; readonly dst: AudioNode; readonly buffer: AudioBuffer; readonly gainScale: number;
}): void {
  const src = opts.ctx.createBufferSource();
  src.buffer = opts.buffer;
  src.playbackRate.value = 0.94 + Math.random() * 0.12;
  const g = opts.ctx.createGain();
  g.gain.value = Math.max(0.05, Math.min(1.5, opts.gainScale));
  src.connect(g).connect(opts.dst);
  src.start();
}

function playVoiceLayer(opts: {
  readonly ctx: AudioContext; readonly dst: AudioNode; readonly layer: VoiceLayer;
  readonly pitch: number; readonly gainScale: number; readonly baseDelay: number;
}): void {
  const { ctx, dst, layer, pitch, gainScale, baseDelay } = opts;
  const gain = layer.gain * gainScale;
  const holdSec = layer.hold ?? Math.min(layer.dur * 0.42, Math.max(0, layer.dur - 0.02));
  const delay = baseDelay + (layer.delay ?? 0);
  if (layer.kind === "tone") {
    playTone({
      ctx, dst, wave: layer.wave, f0: layer.f0 * pitch, f1: layer.f1 * pitch,
      duration: layer.dur, gain, holdSec, delay,
    });
    return;
  }
  if (layer.kind === "sweep") {
    playSweptNoise({
      ctx, dst, duration: layer.dur, f0: layer.f0 * pitch, f1: layer.f1 * pitch,
      filterType: layer.filter, gain, noiseColor: layer.color, q: layer.q,
      attackSec: layer.atk, holdSec, delay,
    });
    return;
  }
  playNoiseBurst({
    ctx, dst, duration: layer.dur, freq: layer.freq * pitch, filterType: layer.filter,
    gain, noiseColor: layer.color, q: layer.q, holdSec, delay,
  });
}

export function synthCreatureVocal(opts: CreatureVocalPlayOpts): void {
  const gainScale = opts.gainScale ?? 1;
  if (opts.sampleOverride) {
    playSampleOverride({ ctx: opts.ctx, dst: opts.dst, buffer: opts.sampleOverride, gainScale });
    return;
  }
  const layers = getCreatureVoiceSpec(opts.kind, opts.vocal);
  const pitch = 0.93 + Math.random() * 0.14;
  const amp = gainScale * (0.94 + Math.random() * 0.1);
  const baseDelay = opts.delaySec ?? 0;
  for (const layer of layers) {
    playVoiceLayer({ ctx: opts.ctx, dst: opts.dst, layer, pitch, gainScale: amp, baseDelay });
  }
}
