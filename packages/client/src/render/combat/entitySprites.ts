/** Renders interactive combat training targets, wildlife, POI guards, and fallen bodies. */
import { JUMP_VISUAL_PX_PER_TILE, TILE_PX, type PlayerSnapshot, type WorldEntitySnapshot } from "@dc2d/engine";
import { Container, Graphics, Sprite } from "pixi.js";
import type { LoadedSpriteAnimations } from "../textures/spriteManifest.js";
import { ELEVATION_LIFT_PX } from "../world/cliffStrips.js";
import {
  createWaterSubmergeRig, syncSubmergedSprite, syncWaterSubmergeState, type WaterSubmergeRig,
} from "../world/player/playerPoseHelpers.js";
import { AiIndicatorView, resolveAiVisualEffects } from "./aiStateIndicators.js";
import { EliteVisuals } from "./eliteVisuals.js";
import { createAnimatorTrackState, sampleAnimatedFrame } from "./entityAnimator.js";
import {
  KIND_SLIME, KIND_SLIME_DUMMY, PILE_CORPSE_KINDS, type WorldEntityKind,
  buildEntityWaterMetrics, createEntityBody, isCorpseState,
  resolveBodyTint, resolveEntityZIndex, resolveFallbackBodyY, shouldActivateIndicator,
} from "./entityViewHelpers.js";

class EntityView {
  readonly root = new Container();
  private readonly shadow = new Graphics();
  private waterRig: WaterSubmergeRig | null = null;
  private readonly body: Sprite | Graphics;
  private readonly baseScale: number;
  private readonly shadowRx: number;
  private readonly hpTopY: number;
  private readonly visualH: number;
  private readonly animations: LoadedSpriteAnimations | null;
  private readonly animTrack = createAnimatorTrackState();
  private hpBg: Graphics | null = null;
  private hpFill: Graphics | null = null;
  private indicator: AiIndicatorView | null = null;
  private elite: EliteVisuals | null = null;
  private readonly kind: WorldEntityKind;
  private lastX = Number.NaN;
  private lastY = Number.NaN;
  private moveHoldUntilSec = 0;

  constructor(kind: WorldEntityKind) {
    this.kind = kind;
    const built = createEntityBody(kind);
    this.body = built.body;
    this.baseScale = built.baseScale;
    this.shadowRx = built.shadowRx;
    this.hpTopY = built.hpTopY;
    this.visualH = built.visualH;
    this.animations = built.animations;
    this.shadow.ellipse(0, 0, built.shadowRx, Math.max(2.2, built.shadowRx * 0.3)).fill({ color: 0x0c1018, alpha: 0.36 });
    this.root.addChild(this.shadow, this.body);
  }

  private ensureWaterRig(): WaterSubmergeRig {
    if (this.waterRig) return this.waterRig;
    const rig = createWaterSubmergeRig(buildEntityWaterMetrics(this.shadowRx, this.visualH), this.body instanceof Sprite);
    if (rig.submergedBody && this.body instanceof Sprite) rig.submergedBody.anchor.copyFrom(this.body.anchor);
    if (rig.submergedBody) this.root.addChild(rig.submergedMask, rig.submergedBody);
    this.root.addChild(rig.waterRing, rig.waterMask, rig.waterFrontLip);
    this.waterRig = rig;
    return rig;
  }

  private syncWaterState(snap: WorldEntitySnapshot, dead: boolean, jumpZ: number): boolean {
    const swimming = Boolean(snap.inDeepWater && !dead && jumpZ <= 0.03);
    if (!swimming && !this.waterRig) { this.body.mask = null; this.shadow.visible = !dead; return false; }
    const rig = this.ensureWaterRig();
    syncWaterSubmergeState({ rig, target: this.body, shadow: this.shadow, swimming, showShadow: !dead && !swimming });
    return swimming;
  }

  sync(snap: WorldEntitySnapshot, timeSec: number, localPlayer?: PlayerSnapshot): void {
    const dead = isCorpseState(snap);
    const hidePileCorpse = dead && PILE_CORPSE_KINDS.has(snap.kind);
    this.root.visible = !hidePileCorpse;
    if (hidePileCorpse) return;
    const moved = Number.isFinite(this.lastX) && Math.hypot(snap.x - this.lastX, snap.y - this.lastY) > 0.004;
    if (moved) this.moveHoldUntilSec = timeSec + 0.14;
    this.lastX = snap.x; this.lastY = snap.y;
    const jumpZ = snap.jumpZ ?? 0;
    this.root.position.set(snap.x * TILE_PX, snap.y * TILE_PX - snap.elevation * ELEVATION_LIFT_PX);
    this.root.zIndex = resolveEntityZIndex(snap, dead);
    const swimming = this.syncWaterState(snap, dead, jumpZ);
    this.shadow.scale.set(Math.max(0.55, 1 - jumpZ * 0.6));
    this.shadow.alpha = Math.max(0.45, 1 - jumpZ * 0.7);
    this.syncBodyState({ snap, timeSec, moving: moved || timeSec < this.moveHoldUntilSec || snap.aiState === "charge", swimming });
    const hpVisible = this.syncHpBar(snap, dead);
    this.syncIndicator({ snap, timeSec, dead, hpVisible, localPlayer });
    this.syncElite(snap, dead, timeSec);
  }

  private syncIndicator(opts: { readonly snap: WorldEntitySnapshot; readonly timeSec: number; readonly dead: boolean; readonly hpVisible: boolean; readonly localPlayer?: PlayerSnapshot | undefined }): void {
    const active = shouldActivateIndicator(opts.snap, opts.dead, opts.localPlayer);
    if (!active && !this.indicator) return;
    if (!this.indicator) {
      this.indicator = new AiIndicatorView(this.hpTopY);
      this.root.addChildAt(this.indicator.backstabContainer, 0);
      this.root.addChild(this.indicator.container);
    }
    this.indicator.sync(opts);
  }

  private syncElite(snap: WorldEntitySnapshot, dead: boolean, timeSec: number): void {
    const needsElite = !dead && (Boolean(snap.isElite) || (snap.dangerTier ?? 1) >= 2);
    if (!needsElite && !this.elite) return;
    if (!this.elite) {
      this.elite = new EliteVisuals(this.hpTopY);
      this.root.addChildAt(this.elite.aura, 0);
      this.root.addChild(this.elite.label);
    }
    this.elite.sync(snap, dead, timeSec);
  }

  dispose(): void {
    this.elite?.dispose();
    this.root.destroy({ children: true });
  }

  private eliteScale(snap: WorldEntitySnapshot, dead: boolean): number {
    return this.baseScale * (snap.isElite && !dead ? 1.22 : 1);
  }

  private submergedSprite(): Sprite | null {
    return this.waterRig?.submergedBody ?? null;
  }

  private applySpritePose(opts: {
    readonly snap: WorldEntitySnapshot; readonly timeSec: number; readonly dead: boolean;
    readonly swimBob: number; readonly swimming: boolean; readonly texture: Sprite["texture"]; readonly flipX: number;
  }): void {
    const sprite = this.body as Sprite;
    const fx = resolveAiVisualEffects(opts.snap, opts.timeSec, opts.dead);
    const sc = this.eliteScale(opts.snap, opts.dead);
    sprite.texture = opts.texture;
    sprite.alpha = fx.alpha;
    sprite.rotation = opts.dead ? 0 : this.liveShakeAngle(opts.snap, opts.timeSec);
    sprite.position.y = opts.dead ? 0 : -(opts.snap.jumpZ ?? 0) * JUMP_VISUAL_PX_PER_TILE + opts.swimBob;
    sprite.tint = resolveBodyTint(opts.snap, opts.timeSec);
    sprite.scale.set(opts.flipX * sc, sc * fx.scaleYMult);
    syncSubmergedSprite({
      sub: this.submergedSprite(), src: sprite, swimming: opts.swimming,
      x: sprite.position.x, y: sprite.position.y, rot: sprite.rotation,
      scaleX: sprite.scale.x, scaleY: sprite.scale.y, alpha: sprite.alpha,
    });
  }

  private syncAnimatedSprite(opts: {
    readonly snap: WorldEntitySnapshot; readonly timeSec: number; readonly moving: boolean;
    readonly dead: boolean; readonly swimBob: number; readonly swimming: boolean;
  }): boolean {
    if (!this.animations || !(this.body instanceof Sprite)) return false;
    const frame = sampleAnimatedFrame({ animations: this.animations, track: this.animTrack, ...opts });
    if (!frame) return false;
    this.applySpritePose({ ...opts, texture: frame.texture, flipX: frame.flipX });
    return true;
  }

  private isSlimeKind(): boolean {
    return this.kind === KIND_SLIME_DUMMY || this.kind === KIND_SLIME;
  }

  private syncBodyState(opts: { readonly snap: WorldEntitySnapshot; readonly timeSec: number; readonly moving: boolean; readonly swimming: boolean }): void {
    const { snap, timeSec, moving, swimming } = opts;
    const dead = isCorpseState(snap);
    const swimBob = swimming ? Math.max(3.2, Math.min(6.0, this.visualH * 0.22)) + Math.sin(timeSec * 4.8 + snap.x) * 0.55 : 0;
    if (this.syncAnimatedSprite({ snap, timeSec, moving, dead, swimBob, swimming })) return;
    const sub = this.submergedSprite();
    if (sub) sub.visible = false;
    if (dead && this.isSlimeKind()) {
      this.body.alpha = 1; this.body.rotation = 0; this.body.position.y = 0;
      this.body.scale.set(1.15 * this.baseScale, 0.35 * this.baseScale); this.body.tint = 0x86efac;
      return;
    }
    this.body.alpha = resolveAiVisualEffects(snap, timeSec, dead).alpha;
    this.body.rotation = dead ? Math.PI * 0.48 : this.liveShakeAngle(snap, timeSec);
    this.body.position.y = resolveFallbackBodyY({ snap, moving, timeSec, dead }) + swimBob;
    this.body.tint = resolveBodyTint(snap, timeSec);
    this.applyBodyScale(snap, timeSec, dead);
  }

  private liveShakeAngle(snap: WorldEntitySnapshot, timeSec: number): number {
    const hitShake = snap.hitTimer > 0 ? Math.sin(timeSec * 55) * 0.14 : 0;
    const staggerSpin = snap.staggerTimer > 0 ? Math.sin(timeSec * 22) * 0.22 : 0;
    return hitShake + staggerSpin;
  }

  private applyBodyScale(snap: WorldEntitySnapshot, timeSec: number, dead: boolean): void {
    const flipX = !dead && snap.facingX < -0.1 ? -1 : 1;
    const sc = this.baseScale * (snap.isElite && !dead ? 1.22 : 1);
    if (!dead && (this.kind === KIND_SLIME_DUMMY || this.kind === KIND_SLIME)) {
      const sy = 1 + Math.sin(timeSec * 4.5 + snap.x) * 0.07;
      this.body.scale.set((flipX / sy) * sc, sy * sc);
      return;
    }
    const vScale = resolveAiVisualEffects(snap, timeSec, dead).scaleYMult;
    this.body.scale.set(flipX * sc, vScale * sc);
  }

  private syncHpBar(snap: WorldEntitySnapshot, dead: boolean): boolean {
    const show = !dead && snap.hp > 0 && snap.hp < snap.maxHp;
    if (!show) {
      if (this.hpBg) this.hpBg.visible = false;
      if (this.hpFill) this.hpFill.visible = false;
      return false;
    }
    if (!this.hpBg || !this.hpFill) {
      this.hpBg = new Graphics();
      this.hpBg.rect(-9, this.hpTopY, 18, 3).fill({ color: 0x090d14, alpha: 0.85 });
      this.hpFill = new Graphics();
      this.hpFill.rect(-8, this.hpTopY + 1, 16, 1.5).fill(0xef4444);
      this.root.addChild(this.hpBg, this.hpFill);
    }
    this.hpBg.visible = true;
    this.hpFill.visible = true;
    const ratio = Math.max(0.05, Math.min(1, snap.hp / snap.maxHp));
    this.hpFill.scale.x = ratio;
    this.hpFill.position.x = -8 * (1 - ratio);
    return true;
  }
}

export class EntityRenderer {
  private readonly views = new Map<string, EntityView>();
  private localPlayer: PlayerSnapshot | undefined;

  setLocalPlayer(localPlayer: PlayerSnapshot | undefined): void { this.localPlayer = localPlayer; }

  sync(ysortLayer: Container, entities: readonly WorldEntitySnapshot[], timeSec: number): void {
    const active = new Set(entities.map((e) => e.id));
    for (const [id, view] of this.views) {
      if (active.has(id)) continue;
      view.dispose();
      this.views.delete(id);
    }
    for (const snap of entities) {
      let view = this.views.get(snap.id);
      if (!view) {
        view = new EntityView(snap.kind);
        this.views.set(snap.id, view);
        ysortLayer.addChild(view.root);
      }
      view.sync(snap, timeSec, this.localPlayer);
    }
  }
}
