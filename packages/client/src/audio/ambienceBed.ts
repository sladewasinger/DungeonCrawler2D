/** Nature Day/Night bed, spatial campfire crackle & river babble, and reactive combat tension. */
import { AUDIO_TUNING } from "./audioTuning.js";
import { getSharedNoiseBuffer, playNoiseBurst, playTone } from "./synthSfx.js";

export interface AmbienceStepInput {
  readonly ctx: AudioContext;
  readonly musicDst: AudioNode;
  readonly sfxDst: AudioNode;
  readonly dt: number;
  readonly dayPhase: number;
  readonly campfireDist: number;
  readonly waterDist: number;
  readonly tension: number;
}

function createLoopBed(opts: {
  readonly ctx: AudioContext;
  readonly dst: AudioNode;
  readonly type: BiquadFilterType;
  readonly freq: number;
  readonly q?: number;
}): { readonly gain: GainNode; readonly filter: BiquadFilterNode } {
  const src = opts.ctx.createBufferSource();
  src.buffer = getSharedNoiseBuffer(opts.ctx);
  src.loop = true;
  const filter = opts.ctx.createBiquadFilter();
  filter.type = opts.type;
  filter.frequency.value = opts.freq;
  filter.Q.value = opts.q ?? 0.7;
  const gain = opts.ctx.createGain();
  gain.gain.value = 0.0001;
  src.connect(filter).connect(gain).connect(opts.dst);
  src.start();
  return { gain, filter };
}

function playSongbirdPhrase(ctx: AudioContext, dst: AudioNode): void {
  const g = AUDIO_TUNING.biosphere.birdGain;
  const root = 2750 + Math.random() * 650;
  playTone({ ctx, dst, wave: "sine", f0: root, f1: root * 0.92, duration: 0.042, gain: g });
  playTone({ ctx, dst, wave: "sine", f0: root * 1.12, f1: root * 1.03, duration: 0.042, gain: g * 0.9, delay: 0.075 });
  if (Math.random() > 0.35) {
    playTone({ ctx, dst, wave: "sine", f0: root * 1.25, f1: root * 1.18, duration: 0.048, gain: g * 0.85, delay: 0.16 });
  }
}

const AMBIENT_PARAM_STEP_SEC = 0.1;
const GAIN_EPSILON = 0.0005;

export class AmbienceBed {
  private windBed: { readonly gain: GainNode; readonly filter: BiquadFilterNode } | null = null;
  private fireBed: GainNode | null = null;
  private waterBed: GainNode | null = null;
  private bioTimer = 2.5;
  private fireTimer = 0.7;
  private tensionTimer = 0.5;
  private paramAccum = AMBIENT_PARAM_STEP_SEC;
  private lastNight: boolean | null = null;
  private lastFireGain = -1;
  private lastWaterGain = -1;

  update(input: AmbienceStepInput): void {
    this.ensureBeds(input.ctx, input.sfxDst, input.musicDst);
    const now = input.ctx.currentTime;
    const isNight = input.dayPhase < 0.23 || input.dayPhase > 0.77;
    this.paramAccum += input.dt;
    if (this.paramAccum >= AMBIENT_PARAM_STEP_SEC) {
      this.paramAccum = 0;
      this.syncWindBed(isNight, now);
      this.updateSpatialBeds(input, now);
    }
    this.stepBiosphere(input, isNight);
    this.stepCampfireEmber(input);
    this.stepTensionPulse(input);
  }

  private syncWindBed(isNight: boolean, now: number): void {
    if (!this.windBed || isNight === this.lastNight) return;
    this.lastNight = isNight;
    const w = AUDIO_TUNING.wind;
    this.windBed.gain.gain.setTargetAtTime(isNight ? w.nightGain : w.dayGain, now, 0.25);
    this.windBed.filter.frequency.setTargetAtTime(isNight ? w.nightFreqHz : w.dayFreqHz, now, 0.25);
  }

  private ensureBeds(ctx: AudioContext, sfxDst: AudioNode, musicDst: AudioNode): void {
    const { wind, campfire, river } = AUDIO_TUNING;
    if (!this.windBed) this.windBed = createLoopBed({ ctx, dst: musicDst, type: "lowpass", freq: wind.dayFreqHz });
    if (!this.fireBed) this.fireBed = createLoopBed({ ctx, dst: sfxDst, type: "lowpass", freq: campfire.rumbleFreqHz }).gain;
    if (!this.waterBed) this.waterBed = createLoopBed({ ctx, dst: sfxDst, type: "bandpass", freq: river.freqHz, q: 0.65 }).gain;
  }

  private updateSpatialBeds(input: AmbienceStepInput, now: number): void {
    const { campfire, river } = AUDIO_TUNING;
    const fireGain = input.campfireDist > campfire.maxDistTiles
      ? 0.0001
      : Math.max(0.001, (1 - input.campfireDist / campfire.maxDistTiles) * campfire.rumbleGain);
    const waterGain = input.waterDist > river.maxDistTiles
      ? 0.0001
      : Math.max(0.001, (1 - input.waterDist / river.maxDistTiles) * river.gain);
    if (this.fireBed && Math.abs(fireGain - this.lastFireGain) >= GAIN_EPSILON) {
      this.lastFireGain = fireGain;
      this.fireBed.gain.setTargetAtTime(fireGain, now, 0.2);
    }
    if (this.waterBed && Math.abs(waterGain - this.lastWaterGain) >= GAIN_EPSILON) {
      this.lastWaterGain = waterGain;
      this.waterBed.gain.setTargetAtTime(waterGain, now, 0.2);
    }
  }

  private stepBiosphere(input: AmbienceStepInput, isNight: boolean): void {
    const bio = AUDIO_TUNING.biosphere;
    this.bioTimer -= input.dt;
    if (this.bioTimer > 0) return;
    this.bioTimer = isNight
      ? bio.nightIntervalMinSec + Math.random() * bio.nightIntervalRangeSec
      : bio.dayIntervalMinSec + Math.random() * bio.dayIntervalRangeSec;
    if (isNight) {
      playTone({ ctx: input.ctx, dst: input.musicDst, wave: "sine", f0: 4150, f1: 4100, duration: 0.032, gain: bio.cricketGain });
      playTone({ ctx: input.ctx, dst: input.musicDst, wave: "sine", f0: 4150, f1: 4100, duration: 0.032, gain: bio.cricketGain * 0.9, delay: 0.065 });
      playTone({ ctx: input.ctx, dst: input.musicDst, wave: "sine", f0: 4150, f1: 4100, duration: 0.032, gain: bio.cricketGain * 0.8, delay: 0.13 });
      return;
    }
    playSongbirdPhrase(input.ctx, input.musicDst);
  }

  private stepCampfireEmber(input: AmbienceStepInput): void {
    const c = AUDIO_TUNING.campfire;
    if (input.campfireDist > c.maxDistTiles) return;
    this.fireTimer -= input.dt;
    if (this.fireTimer > 0) return;
    this.fireTimer = c.crackleIntervalMinSec + Math.random() * c.crackleIntervalRangeSec;
    const falloff = Math.max(0.05, 1 - input.campfireDist / c.maxDistTiles);
    playNoiseBurst({
      ctx: input.ctx, dst: input.sfxDst, duration: 0.045 + Math.random() * 0.03,
      freq: c.crackleFreqMinHz + Math.random() * c.crackleFreqRangeHz, filterType: "lowpass", gain: falloff * c.crackleGain, q: 0.7,
    });
    if (Math.random() < c.popChance) {
      playNoiseBurst({
        ctx: input.ctx, dst: input.sfxDst, duration: 0.017,
        freq: c.popFreqMinHz + Math.random() * c.popFreqRangeHz, filterType: "bandpass", gain: falloff * c.popGain, q: 0.9,
      });
    }
  }

  private stepTensionPulse(input: AmbienceStepInput): void {
    if (input.tension <= 0.12) return;
    this.tensionTimer -= input.dt;
    if (this.tensionTimer > 0) return;
    this.tensionTimer = 0.56 - input.tension * 0.16;
    playTone({ ctx: input.ctx, dst: input.musicDst, wave: "triangle", f0: 84, f1: 58, duration: 0.14, gain: AUDIO_TUNING.combat.tensionGain * input.tension });
  }
}
