/** Mobile-unlocked Hybrid Web Audio Engine with sample-first overrides, panning, and footsteps. */
import { GroundKind, advanceGaitClock, createGaitClock, type CreatureVocalKind, type PlayerSnapshot, type WorldChunkCache, type WorldEvent } from "@dc2d/engine";
import { AmbienceBed } from "./ambienceBed.js";
import { loadAudioPrefs, saveAudioPrefs, type AudioPrefs } from "./audioPrefs.js";
import { isWildlifeVoiceKind, synthCreatureVocal, type CreatureVoiceKind } from "./creatures/synthCreatureSfx.js";
import { computeSpatialMix, createSpatialBus } from "./spatialMix.js";
import { synthFootstep, synthJumpOrLand } from "./synthMovementSfx.js";
import { synthCombatCue, synthImpact, synthSwing, synthUi, type CombatCueKind } from "./synthSfx.js";
import { synthHarvestSfx } from "./weapons/synthWeaponSfx.js";

const UI_DISCOVERY_EVENTS = new Set<WorldEvent["kind"]>(["poiDiscover", "shrineActivate", "waystoneAttune", "vaultUnlock", "loreRead"]);
const UNLOCK_EVENTS = ["pointerdown", "mousedown", "keydown", "touchstart", "click"] as const;
const MAX_CONCURRENT_VOICES = 24;
const VOICE_WINDOW_MS = 450;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private readonly bed = new AmbienceBed();
  private prefs: AudioPrefs = loadAudioPrefs();
  private tension = 0;
  private readonly gaitClock = createGaitClock();
  private prevAirborne = false;
  private activeVoices = 0;
  private unlockListenersAttached = true;

  private readonly handleUnlock = (): void => { this.ensureUnlocked(); };

  constructor() {
    for (const evt of UNLOCK_EVENTS) {
      window.addEventListener(evt, this.handleUnlock, { capture: true, passive: true });
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => this.syncPlaybackState());
    }
  }

  getPrefs(): AudioPrefs { return this.prefs; }
  getActiveVoiceCount(): number { return this.activeVoices; }

  setPrefs(next: AudioPrefs): void {
    this.prefs = next;
    saveAudioPrefs(next);
    this.syncGains();
    this.syncPlaybackState();
  }

  playUi(kind: "click" | "equip" | "craft" | "open" | "discover"): void {
    this.ensureUnlocked();
    if (!this.ctx || !this.sfxGain) return;
    synthUi(this.ctx, this.sfxGain, kind);
  }

  private playSpatialWorldEvent(ev: WorldEvent, listener: { readonly x: number; readonly y: number }): void {
    if (!this.ctx || !this.sfxGain) return;
    if (UI_DISCOVERY_EVENTS.has(ev.kind)) { this.playUi("discover"); return; }
    if (this.activeVoices >= MAX_CONCURRENT_VOICES) return;
    const mix = computeSpatialMix({ dx: ev.x - listener.x, dy: ev.y - listener.y });
    if (!mix.audible) return;
    const node = createSpatialBus({ ctx: this.ctx, dst: this.sfxGain, mix });
    this.activeVoices += 1;
    setTimeout(() => { this.activeVoices = Math.max(0, this.activeVoices - 1); }, VOICE_WINDOW_MS);
    this.dispatchWorldEvent(ev, node);
  }

  handleWorldEvents(events: readonly WorldEvent[], listener: { readonly x: number; readonly y: number }): void {
    if (!this.ctx || !this.sfxGain || this.prefs.muted || this.prefs.sfx <= 0.001) return;
    for (const ev of events) this.playSpatialWorldEvent(ev, listener);
  }

  stepFrame(input: {
    readonly local: PlayerSnapshot | undefined;
    readonly cache: WorldChunkCache;
    readonly dt: number;
    readonly dayPhase: number;
    readonly campfireDist: number;
    readonly waterDist: number;
  }): void {
    if (this.shouldSuspendAudio()) return;
    this.tension = Math.max(0, this.tension - input.dt * 0.25);
    if (!this.ctx || !this.musicGain || !this.sfxGain) return;
    this.bed.update({
      ctx: this.ctx, musicDst: this.musicGain, sfxDst: this.sfxGain, dt: input.dt,
      dayPhase: input.dayPhase, campfireDist: input.campfireDist, waterDist: input.waterDist, tension: this.tension,
    });
    if (input.local) this.stepLocalMovementAudio(input.local, input.cache);
  }

  private playCreatureVoice(opts: {
    readonly kind: CreatureVoiceKind;
    readonly vocal: CreatureVocalKind;
    readonly dst: AudioNode;
    readonly gainScale?: number;
    readonly delaySec?: number;
  }): void {
    if (!this.ctx) return;
    synthCreatureVocal({
      ctx: this.ctx,
      dst: opts.dst,
      kind: opts.kind,
      vocal: opts.vocal,
      gainScale: opts.gainScale,
      delaySec: opts.delaySec,
    });
  }

  private dispatchHitEvent(ev: WorldEvent, dst: AudioNode): void {
    if (!this.ctx) return;
    this.tension = Math.min(1, this.tension + 0.45);
    synthImpact({ ctx: this.ctx, dst, substance: ev.substance ?? "blood", fatal: Boolean(ev.fatal) });
    if (isWildlifeVoiceKind(ev.entityKind)) {
      this.playCreatureVoice({
        kind: ev.entityKind,
        vocal: ev.fatal ? "death" : "hurt",
        dst,
        gainScale: ev.fatal ? 1.2 : 1.0,
        delaySec: 0.035,
      });
    }
  }

  private dispatchSwingEvent(ev: WorldEvent, dst: AudioNode): void {
    if (!this.ctx) return;
    if (isWildlifeVoiceKind(ev.entityKind)) {
      this.playCreatureVoice({ kind: ev.entityKind, vocal: "attack", dst });
      return;
    }
    synthSwing({ ctx: this.ctx, dst, comboStep: ev.comboStep ?? 1, archetype: ev.weaponArchetype ?? "sword" });
  }

  private dispatchTelegraphEvent(ev: WorldEvent, dst: AudioNode): void {
    if (!this.ctx) return;
    this.tension = Math.min(1, this.tension + 0.35);
    if (isWildlifeVoiceKind(ev.entityKind)) {
      this.playCreatureVoice({ kind: ev.entityKind, vocal: "alert", dst, gainScale: 0.9 });
      return;
    }
    synthCombatCue(this.ctx, dst, "telegraph");
  }

  private dispatchVocalEvent(ev: WorldEvent, dst: AudioNode): void {
    if (isWildlifeVoiceKind(ev.entityKind) && ev.vocalKind) {
      this.playCreatureVoice({ kind: ev.entityKind, vocal: ev.vocalKind, dst });
    }
  }

  private dispatchWorldEvent(ev: WorldEvent, dst: AudioNode): void {
    if (!this.ctx) return;
    if (ev.kind === "hit") { this.dispatchHitEvent(ev, dst); return; }
    if (ev.kind === "swing") { this.dispatchSwingEvent(ev, dst); return; }
    if (ev.kind === "telegraph") { this.dispatchTelegraphEvent(ev, dst); return; }
    if (ev.kind === "creatureVocal") { this.dispatchVocalEvent(ev, dst); return; }
    if (ev.kind === "harvestHit" || ev.kind === "harvestBreak") {
      synthHarvestSfx({ ctx: this.ctx, dst, stone: ev.substance === "stone", broken: ev.kind === "harvestBreak" });
      return;
    }
    this.dispatchCueOrSplash({ kind: ev.kind, dst, value: ev.value });
  }

  private dispatchCueOrSplash(opts: { readonly kind: WorldEvent["kind"]; readonly dst: AudioNode; readonly value?: number | undefined }): void {
    if (!this.ctx || UI_DISCOVERY_EVENTS.has(opts.kind)) return;
    if (opts.kind === "pebbleLand" && opts.value !== undefined && opts.value <= GroundKind.ShallowWater) {
      synthJumpOrLand({ ctx: this.ctx, dst: opts.dst, landing: true, inWater: true });
      return;
    }
    synthCombatCue(this.ctx, opts.dst, opts.kind as CombatCueKind);
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

  private stepLocalMovementAudio(local: PlayerSnapshot, cache: WorldChunkCache): void {
    if (!this.ctx || !this.sfxGain) return;
    const ground = this.resolveGroundForStep(local, cache);
    const airborne = (local.jumpZ ?? 0) > 0.03;
    this.syncAirborneAudio({ ground, airborne });
    const sprinting = Boolean(local.sprinting);
    const gait = advanceGaitClock(this.gaitClock, { x: local.x, y: local.y, moving: local.moving, sprinting, airborne });
    if (gait.stepTriggered) {
      synthFootstep({ ctx: this.ctx, dst: this.sfxGain, ground, sprinting, crouching: Boolean(local.crouching) });
    }
  }

  private detachUnlockListeners(): void {
    if (!this.unlockListenersAttached) return;
    this.unlockListenersAttached = false;
    for (const evt of UNLOCK_EVENTS) {
      window.removeEventListener(evt, this.handleUnlock, { capture: true });
    }
  }

  private ensureUnlocked(): void {
    if (!this.ctx) {
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      this.ctx = new AudioCtor();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -6;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.15;
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
      this.syncGains();
    }
    if (this.ctx.state === "running") { this.detachUnlockListeners(); return; }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().then(() => {
        this.syncGains();
        if (this.ctx?.state === "running") this.detachUnlockListeners();
      }).catch(() => {});
    }
  }

  private shouldSuspendAudio(): boolean {
    const hidden = typeof document !== "undefined" && document.hidden;
    return this.prefs.muted || hidden;
  }

  private syncPlaybackState(): void {
    if (!this.ctx) return;
    if (this.shouldSuspendAudio()) {
      if (this.ctx.state === "running") void this.ctx.suspend().catch(() => {});
      return;
    }
    if (this.ctx.state === "suspended" && !this.unlockListenersAttached) {
      void this.ctx.resume().catch(() => {});
    }
  }

  private syncGains(): void {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.prefs.muted ? 0 : 1, now, 0.03);
    this.musicGain.gain.setTargetAtTime(this.prefs.music, now, 0.03);
    this.sfxGain.gain.setTargetAtTime(this.prefs.sfx, now, 0.03);
  }
}
