/** Mobile-unlocked Hybrid Web Audio Engine with sample-first overrides, panning, and footsteps. */
import { GroundKind, clamp, type PlayerSnapshot, type WorldChunkCache, type WorldEvent } from "@dc2d/engine";
import { AmbienceBed } from "./ambienceBed.js";
import { loadAudioPrefs, saveAudioPrefs, type AudioPrefs } from "./audioPrefs.js";
import { AUDIO_TUNING } from "./audioTuning.js";
import { synthCombatCue, synthFootstep, synthImpact, synthJumpOrLand, synthSwing, synthUi } from "./synthSfx.js";

const PENDING_CUES = new Set<string>(["chestOpen", "loot"]);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private readonly bed = new AmbienceBed();
  private prefs: AudioPrefs = loadAudioPrefs();
  private tension = 0;
  private stepAccum = 0;
  private prevAirborne = false;

  constructor() {
    const unlock = (): void => { this.ensureUnlocked(); };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
    try { this.ensureUnlocked(); } catch { /* Browsers blocking autoplay unlock on first gesture */ }
  }

  getPrefs(): AudioPrefs { return this.prefs; }

  setPrefs(next: AudioPrefs): void {
    this.prefs = next;
    saveAudioPrefs(next);
    this.syncGains();
  }

  async preloadSample(key: string, url: string): Promise<void> {
    if (!this.ctx) return;
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const decoded = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this.bed.registerSample(key, decoded);
    } catch {
      // Optional asset missing or decode skipped cleanly.
    }
  }

  playUi(kind: "click" | "equip" | "craft" | "open"): void {
    if (!this.ctx || !this.sfxGain) return;
    synthUi(this.ctx, this.sfxGain, kind);
  }

  handleWorldEvents(events: readonly WorldEvent[], listener: { readonly x: number; readonly y: number }): void {
    if (!this.ctx || !this.sfxGain) return;
    for (const ev of events) {
      const pan = clamp((ev.x - listener.x) / 8, -0.85, 0.85);
      const node = this.createPanner(pan);
      this.dispatchWorldEvent(ev, node);
    }
  }

  stepFrame(input: {
    readonly local: PlayerSnapshot | undefined;
    readonly cache: WorldChunkCache;
    readonly dt: number;
    readonly dayPhase: number;
    readonly campfireDist: number;
    readonly waterDist: number;
  }): void {
    this.tension = Math.max(0, this.tension - input.dt * 0.25);
    if (!this.ctx || !this.musicGain || !this.sfxGain) return;
    this.bed.update({
      ctx: this.ctx, musicDst: this.musicGain, sfxDst: this.sfxGain, dt: input.dt,
      dayPhase: input.dayPhase, campfireDist: input.campfireDist, waterDist: input.waterDist, tension: this.tension,
    });
    if (input.local) this.stepLocalMovementAudio(input.local, input.cache, input.dt);
  }

  private dispatchWorldEvent(ev: WorldEvent, dst: AudioNode): void {
    if (!this.ctx) return;
    if (ev.kind === "hit") {
      this.tension = Math.min(1, this.tension + 0.45);
      synthImpact({ ctx: this.ctx, dst, substance: ev.substance ?? "blood", fatal: Boolean(ev.fatal) });
      return;
    }
    if (ev.kind === "swing") { synthSwing(this.ctx, dst, ev.comboStep ?? 1); return; }
    if (ev.kind === "telegraph") { this.tension = Math.min(1, this.tension + 0.35); synthCombatCue(this.ctx, dst, "telegraph"); return; }
    if (PENDING_CUES.has(ev.kind)) return;
    synthCombatCue(this.ctx, dst, ev.kind as Parameters<typeof synthCombatCue>[2]);
  }

  private isWaterGround(ground: GroundKind): boolean {
    return ground === GroundKind.ShallowWater || ground === GroundKind.DeepWater;
  }

  private resolveGroundForStep(local: PlayerSnapshot, cache: WorldChunkCache): GroundKind {
    if (local.inWater) return GroundKind.ShallowWater;
    return cache.tileAt(Math.floor(local.x), Math.floor(local.y)).ground;
  }

  private syncAirborneAudio(opts: { readonly ground: GroundKind; readonly airborne: boolean }): void {
    if (!this.ctx || !this.sfxGain || opts.airborne === this.prevAirborne) return;
    synthJumpOrLand({
      ctx: this.ctx,
      dst: this.sfxGain,
      landing: !opts.airborne,
      inWater: this.isWaterGround(opts.ground),
    });
    this.prevAirborne = opts.airborne;
  }

  private stepLocalMovementAudio(local: PlayerSnapshot, cache: WorldChunkCache, dt: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const ground = this.resolveGroundForStep(local, cache);
    const airborne = (local.jumpZ ?? 0) > 0.03;
    this.syncAirborneAudio({ ground, airborne });
    if (!local.moving || airborne) { this.stepAccum = 0.18; return; }
    this.stepAccum += dt;
    if (this.stepAccum < AUDIO_TUNING.footsteps.stepIntervalSec) return;
    this.stepAccum = 0;
    synthFootstep(this.ctx, this.sfxGain, ground);
  }

  private createPanner(pan: number): AudioNode {
    if (!this.ctx || !this.sfxGain) throw new Error("Audio context missing");
    if (typeof this.ctx.createStereoPanner !== "function") return this.sfxGain;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(this.sfxGain);
    return panner;
  }

  private ensureUnlocked(): void {
    if (!this.ctx) {
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      this.ctx = new AudioCtor();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.syncGains();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private syncGains(): void {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.prefs.muted ? 0 : 1, now, 0.03);
    this.musicGain.gain.setTargetAtTime(this.prefs.music, now, 0.03);
    this.sfxGain.gain.setTargetAtTime(this.prefs.sfx, now, 0.03);
  }
}
