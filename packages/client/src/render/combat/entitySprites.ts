/** Renders interactive combat training targets, wildlife, POI guards, and fallen bodies. */
import { JUMP_VISUAL_PX_PER_TILE, TILE_PX, type PlayerSnapshot, type WorldEntitySnapshot } from "@dc2d/engine";
import { Container, Graphics, Sprite } from "pixi.js";
import { getLoadedSpriteAsset, type LoadedSpriteAnimations } from "../textures/spriteManifest.js";
import { ELEVATION_LIFT_PX } from "../world/cliffStrips.js";
import {
  createWaterSubmergeRig, syncSubmergedSprite, syncWaterSubmergeState,
  type WaterSubmergeRig, type WaterlineMetrics,
} from "../world/playerPoseHelpers.js";
import { AiIndicatorView, resolveAiVisualEffects } from "./aiStateIndicators.js";
import { drawCreatureBody } from "./creatureDrawers.js";
import { createAnimatorTrackState, sampleAnimatedFrame } from "./entityAnimator.js";

type WorldEntityKind = WorldEntitySnapshot["kind"];

const KIND_SLIME_DUMMY: WorldEntityKind = "slime-dummy";
const KIND_SLIME: WorldEntityKind = "slime";
const PILE_CORPSE_KINDS = new Set<WorldEntityKind>(["golem", "skeleton"]);
const CORPSE_GROUND_Z_OFFSET = -500_000;

function isCorpseState(snap: WorldEntitySnapshot): boolean {
  return Boolean(snap.corpse) || snap.hp <= 0;
}

function resolveEntityZIndex(snap: WorldEntitySnapshot, dead: boolean): number {
  if (!dead) return Math.round(snap.y * TILE_PX) + snap.elevation * 2;
  if (snap.elevation === 0) return CORPSE_GROUND_Z_OFFSET + Math.round(snap.y * TILE_PX);
  return Math.floor(snap.y) * TILE_PX + snap.elevation + 0.5;
}

function resolveBodyTint(snap: WorldEntitySnapshot, timeSec: number): number {
  if (isCorpseState(snap)) return 0xcbd5e1;
  if (snap.hitTimer > 0) return 0xfca5a5;
  if (snap.burning) return Math.floor(timeSec * 12) % 2 === 0 ? 0xfdba74 : 0xfed7aa;
  if (snap.staggerTimer > 0) return 0xfef08a;
  return 0xffffff;
}

function resolveStrideBounce(moving: boolean, phaseX: number, timeSec: number): number {
  return moving ? -Math.abs(Math.sin(timeSec * 12 + phaseX)) * 1.4 : 0;
}

function resolveFallbackBodyY(opts: {
  readonly snap: WorldEntitySnapshot; readonly moving: boolean; readonly timeSec: number; readonly dead: boolean;
}): number {
  if (opts.dead) return 0;
  return resolveStrideBounce(opts.moving, opts.snap.x, opts.timeSec) - (opts.snap.jumpZ ?? 0) * JUMP_VISUAL_PX_PER_TILE;
}

function createEntityBody(kind: WorldEntityKind): {
  readonly body: Sprite | Graphics;
  readonly baseScale: number;
  readonly hpTopY: number;
  readonly shadowRx: number;
  readonly visualH: number;
  readonly animations: LoadedSpriteAnimations | null;
} {
  const asset = getLoadedSpriteAsset(kind);
  if (asset) {
    const sprite = new Sprite(asset.texture);
    sprite.anchor.set(asset.anchorX, asset.anchorY);
    sprite.scale.set(asset.scale);
    const visualW = (asset.contentWidth ?? asset.width) * asset.scale;
    const visualH = (asset.contentHeight ?? asset.height) * asset.scale;
    return {
      body: sprite,
      baseScale: asset.scale,
      hpTopY: -Math.round(visualH) - 4,
      shadowRx: Math.max(6, Math.round(visualW * 0.36)),
      visualH,
      animations: asset.loadedAnimations ?? null,
    };
  }
  const gfx = new Graphics();
  drawCreatureBody(kind, gfx);
  return { body: gfx, baseScale: 1, hpTopY: -27, shadowRx: 7, visualH: 22, animations: null };
}

function buildEntityWaterMetrics(shadowRx: number, visualH: number): WaterlineMetrics {
  const halfW = Math.max(7.5, shadowRx + 2.0);
  return {
    cutY: -Math.max(5.5, Math.min(9.5, Math.round(visualH * 0.28))),
    halfW,
    bowPx: Math.max(2.0, Math.min(3.2, halfW * 0.28)),
  };
}

class EntityView {
  readonly root = new Container();
  private readonly shadow = new Graphics();
  private readonly waterRig: WaterSubmergeRig;
  private readonly body: Sprite | Graphics;
  private readonly baseScale: number;
  private readonly visualH: number;
  private readonly animations: LoadedSpriteAnimations | null;
  private readonly animTrack = createAnimatorTrackState();
  private readonly hpBg = new Graphics();
  private readonly hpFill = new Graphics();
  private readonly indicator: AiIndicatorView;
  private readonly kind: WorldEntityKind;
  private lastX = Number.NaN;
  private lastY = Number.NaN;
  private moveHoldUntilSec = 0;

  constructor(kind: WorldEntityKind) {
    this.kind = kind;
    const built = createEntityBody(kind);
    this.body = built.body;
    this.baseScale = built.baseScale;
    this.visualH = built.visualH;
    this.animations = built.animations;
    this.waterRig = createWaterSubmergeRig(buildEntityWaterMetrics(built.shadowRx, built.visualH), built.body instanceof Sprite);
    if (this.waterRig.submergedBody && built.body instanceof Sprite) {
      this.waterRig.submergedBody.anchor.copyFrom(built.body.anchor);
    }
    this.indicator = new AiIndicatorView(built.hpTopY);
    this.shadow.ellipse(0, 0, built.shadowRx, Math.max(2.2, built.shadowRx * 0.3)).fill({ color: 0x0c1018, alpha: 0.36 });
    this.hpBg.rect(-9, built.hpTopY, 18, 3).fill({ color: 0x090d14, alpha: 0.85 });
    this.hpBg.visible = false;
    this.hpFill.rect(-8, built.hpTopY + 1, 16, 1.5).fill(0xef4444);
    this.hpFill.visible = false;
    this.root.addChild(this.shadow);
    if (this.waterRig.submergedBody) this.root.addChild(this.waterRig.submergedMask, this.waterRig.submergedBody);
    this.root.addChild(this.waterRig.waterRing, this.waterRig.waterMask, this.body, this.waterRig.waterFrontLip, this.hpBg, this.hpFill, this.indicator.container);
  }

  private syncWaterState(snap: WorldEntitySnapshot, dead: boolean, jumpZ: number): boolean {
    const swimming = Boolean(snap.inDeepWater && !dead && jumpZ <= 0.03);
    syncWaterSubmergeState({ rig: this.waterRig, target: this.body, shadow: this.shadow, swimming, showShadow: !dead && !swimming });
    return swimming;
  }

  sync(snap: WorldEntitySnapshot, timeSec: number, localPlayer?: PlayerSnapshot): void {
    const dead = isCorpseState(snap);
    const hidePileCorpse = dead && PILE_CORPSE_KINDS.has(snap.kind);
    this.root.visible = !hidePileCorpse;
    if (hidePileCorpse) return;
    const moved = Number.isFinite(this.lastX) && Math.hypot(snap.x - this.lastX, snap.y - this.lastY) > 0.004;
    if (moved) this.moveHoldUntilSec = timeSec + 0.14;
    this.lastX = snap.x;
    this.lastY = snap.y;
    const jumpZ = snap.jumpZ ?? 0;
    this.root.position.set(snap.x * TILE_PX, snap.y * TILE_PX - snap.elevation * ELEVATION_LIFT_PX);
    this.root.zIndex = resolveEntityZIndex(snap, dead);
    const swimming = this.syncWaterState(snap, dead, jumpZ);
    this.shadow.scale.set(Math.max(0.55, 1 - jumpZ * 0.6));
    this.shadow.alpha = Math.max(0.45, 1 - jumpZ * 0.7);
    this.syncBodyState({ snap, timeSec, moving: moved || timeSec < this.moveHoldUntilSec || snap.aiState === "charge", swimming });
    const hpVisible = this.syncHpBar(snap, dead);
    this.indicator.sync({ snap, timeSec, dead, hpVisible, localPlayer });
  }

  private syncAnimatedSprite(opts: {
    readonly snap: WorldEntitySnapshot; readonly timeSec: number; readonly moving: boolean;
    readonly dead: boolean; readonly swimBob: number; readonly swimming: boolean;
  }): boolean {
    if (!this.animations || !(this.body instanceof Sprite)) return false;
    const frame = sampleAnimatedFrame({ animations: this.animations, track: this.animTrack, ...opts });
    if (!frame) return false;
    const fx = resolveAiVisualEffects(opts.snap, opts.timeSec, opts.dead);
    this.body.texture = frame.texture;
    this.body.alpha = fx.alpha;
    this.body.rotation = opts.dead ? 0 : this.liveShakeAngle(opts.snap, opts.timeSec);
    this.body.position.y = opts.dead ? 0 : -(opts.snap.jumpZ ?? 0) * JUMP_VISUAL_PX_PER_TILE + opts.swimBob;
    this.body.tint = resolveBodyTint(opts.snap, opts.timeSec);
    this.body.scale.set(frame.flipX * this.baseScale, this.baseScale * fx.scaleYMult);
    syncSubmergedSprite({
      sub: this.waterRig.submergedBody, src: this.body, swimming: opts.swimming,
      x: this.body.position.x, y: this.body.position.y, rot: this.body.rotation,
      scaleX: this.body.scale.x, scaleY: this.body.scale.y, alpha: this.body.alpha,
    });
    return true;
  }

  private syncBodyState(opts: { readonly snap: WorldEntitySnapshot; readonly timeSec: number; readonly moving: boolean; readonly swimming: boolean }): void {
    const { snap, timeSec, moving, swimming } = opts;
    const dead = isCorpseState(snap);
    const swimBob = swimming ? Math.max(3.2, Math.min(6.0, this.visualH * 0.22)) + Math.sin(timeSec * 4.8 + snap.x) * 0.55 : 0;
    if (this.syncAnimatedSprite({ snap, timeSec, moving, dead, swimBob, swimming })) return;
    if (this.waterRig.submergedBody) this.waterRig.submergedBody.visible = false;
    const slime = this.kind === KIND_SLIME_DUMMY || this.kind === KIND_SLIME;
    if (dead && slime) {
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
    if (!dead && (this.kind === KIND_SLIME_DUMMY || this.kind === KIND_SLIME)) {
      const sy = 1 + Math.sin(timeSec * 4.5 + snap.x) * 0.07;
      this.body.scale.set((flipX / sy) * this.baseScale, sy * this.baseScale);
      return;
    }
    const vScale = resolveAiVisualEffects(snap, timeSec, dead).scaleYMult;
    this.body.scale.set(flipX * this.baseScale, vScale * this.baseScale);
  }

  private syncHpBar(snap: WorldEntitySnapshot, dead: boolean): boolean {
    const show = !dead && snap.hp > 0 && snap.hp < snap.maxHp;
    this.hpBg.visible = show;
    this.hpFill.visible = show;
    if (!show) return false;
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
      view.root.destroy({ children: true });
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
