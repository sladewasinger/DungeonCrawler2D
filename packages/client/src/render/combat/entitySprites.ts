/** Renders interactive combat training targets, wildlife, POI guards, and fallen bodies. */
import { TILE_PX, type WorldEntitySnapshot } from "@dc2d/engine";
import { Container, Graphics, Sprite } from "pixi.js";
import { getLoadedSpriteAsset } from "../textures/spriteManifest.js";
import { ELEVATION_LIFT_PX } from "../world/cliffStrips.js";
import { drawCreatureBody } from "./creatureDrawers.js";

type WorldEntityKind = WorldEntitySnapshot["kind"];

const KIND_SLIME_DUMMY: WorldEntityKind = "slime-dummy";
const KIND_SLIME: WorldEntityKind = "slime";
const KIND_SPIDER: WorldEntityKind = "spider";
const MOVE_STATES = new Set(["patrol", "investigate", "chase", "flank", "charge"]);

function isCorpseState(snap: WorldEntitySnapshot): boolean {
  return Boolean(snap.corpse) || snap.hp <= 0;
}

function resolveBodyTint(snap: WorldEntitySnapshot): number {
  if (isCorpseState(snap)) return 0x94a3b8;
  if (snap.hitTimer > 0) return 0xfca5a5;
  if (snap.staggerTimer > 0) return 0xfef08a;
  return 0xffffff;
}

function resolveStrideBounce(moving: boolean, phaseX: number, timeSec: number): number {
  return moving ? -Math.abs(Math.sin(timeSec * 12 + phaseX)) * 1.4 : 0;
}

function resolveVerticalScale(snap: WorldEntitySnapshot, timeSec: number, dead: boolean): number {
  if (dead) return 1;
  if (snap.telegraphProgress > 0) return 1 + snap.telegraphProgress * 0.12;
  return snap.aiState === "feed" ? 1 - Math.abs(Math.sin(timeSec * 6)) * 0.12 : 1;
}

function createEntityBody(kind: WorldEntityKind): {
  readonly body: Sprite | Graphics;
  readonly baseScale: number;
  readonly hpTopY: number;
} {
  const asset = getLoadedSpriteAsset(kind);
  if (asset) {
    const sprite = new Sprite(asset.texture);
    sprite.anchor.set(asset.anchorX, asset.anchorY);
    sprite.scale.set(asset.scale);
    return { body: sprite, baseScale: asset.scale, hpTopY: -Math.round(asset.height * asset.scale) - 4 };
  }
  const gfx = new Graphics();
  drawCreatureBody(kind, gfx);
  return { body: gfx, baseScale: 1, hpTopY: -27 };
}

class EntityView {
  readonly root = new Container();
  private readonly shadow = new Graphics();
  private readonly telegraph = new Graphics();
  private readonly body: Sprite | Graphics;
  private readonly baseScale: number;
  private readonly hpBg = new Graphics();
  private readonly hpFill = new Graphics();
  private readonly kind: WorldEntityKind;
  private lastX = Number.NaN;
  private lastY = Number.NaN;

  constructor(kind: WorldEntityKind) {
    this.kind = kind;
    const built = createEntityBody(kind);
    this.body = built.body;
    this.baseScale = built.baseScale;
    const shadowRx = Math.max(7, Math.round(built.baseScale * 20));
    this.shadow.ellipse(0, 0, shadowRx, Math.max(2.2, shadowRx * 0.3)).fill({ color: 0x0c1018, alpha: 0.36 });
    this.hpBg.rect(-9, built.hpTopY, 18, 3).fill({ color: 0x090d14, alpha: 0.85 });
    this.hpBg.visible = false;
    this.hpFill.rect(-8, built.hpTopY + 1, 16, 1.5).fill(0xef4444);
    this.hpFill.visible = false;
    this.root.addChild(this.shadow, this.telegraph, this.body, this.hpBg, this.hpFill);
  }

  sync(snap: WorldEntitySnapshot, timeSec: number): void {
    const moved = Number.isFinite(this.lastX) && Math.hypot(snap.x - this.lastX, snap.y - this.lastY) > 0.002;
    this.lastX = snap.x;
    this.lastY = snap.y;
    const lift = snap.elevation * ELEVATION_LIFT_PX;
    this.root.position.set(snap.x * TILE_PX, snap.y * TILE_PX - lift);
    this.root.zIndex = Math.round(snap.y * TILE_PX) + snap.elevation * 2;
    this.syncBodyState({ snap, timeSec, moving: moved || MOVE_STATES.has(snap.aiState ?? "") });
    this.syncHpBar(snap);
    this.syncTelegraph(snap);
  }

  private syncBodyState(opts: { readonly snap: WorldEntitySnapshot; readonly timeSec: number; readonly moving: boolean }): void {
    const { snap, timeSec, moving } = opts;
    const dead = isCorpseState(snap);
    const slime = this.kind === KIND_SLIME_DUMMY || this.kind === KIND_SLIME;
    if (dead && slime) {
      this.body.alpha = 0.25;
      this.body.rotation = 0;
      this.body.position.y = 0;
      this.body.scale.set(1.15 * this.baseScale, 0.35 * this.baseScale);
      this.body.tint = 0x86efac;
      return;
    }
    this.body.alpha = this.resolveBodyAlpha(snap, dead);
    this.body.rotation = dead ? Math.PI * 0.48 : this.liveShakeAngle(snap, timeSec);
    this.body.position.y = dead ? 0 : resolveStrideBounce(moving, snap.x, timeSec);
    this.body.tint = resolveBodyTint(snap);
    this.applyBodyScale(snap, timeSec, dead);
  }

  private resolveBodyAlpha(snap: WorldEntitySnapshot, dead: boolean): number {
    if (dead) return 0.72;
    return this.kind === KIND_SPIDER && snap.aiState === "ambush" ? 0.45 : 1;
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
    const vScale = resolveVerticalScale(snap, timeSec, dead);
    this.body.scale.set(flipX * this.baseScale, vScale * this.baseScale);
  }

  private syncHpBar(snap: WorldEntitySnapshot): void {
    const show = !isCorpseState(snap) && snap.hp > 0 && snap.hp < snap.maxHp;
    this.hpBg.visible = show;
    this.hpFill.visible = show;
    if (!show) return;
    const ratio = Math.max(0.05, Math.min(1, snap.hp / snap.maxHp));
    this.hpFill.scale.x = ratio;
    this.hpFill.position.x = -8 * (1 - ratio);
  }

  private syncTelegraph(snap: WorldEntitySnapshot): void {
    this.telegraph.clear();
    if (isCorpseState(snap) || snap.telegraphProgress <= 0 || snap.hp <= 0) return;
    const ang = Math.atan2(snap.facingY || 0.01, snap.facingX || 1);
    const radius = 18;
    const a0 = ang - 0.85;
    const a1 = ang + 0.85;
    const urgent = snap.telegraphProgress > 0.72;
    this.telegraph
      .moveTo(0, -4)
      .arc(0, -4, radius, a0, a1)
      .lineTo(0, -4)
      .fill({ color: urgent ? 0xef4444 : 0xf59e0b, alpha: 0.22 + snap.telegraphProgress * 0.25 });
    this.telegraph.arc(0, -4, radius, a0, a1).stroke({ color: urgent ? 0xfca5a5 : 0xfbbf24, width: 1.4 });
  }
}

export class EntityRenderer {
  private readonly views = new Map<string, EntityView>();

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
      view.sync(snap, timeSec);
    }
  }
}
