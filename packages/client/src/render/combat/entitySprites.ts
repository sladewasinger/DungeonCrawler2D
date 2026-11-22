/** Renders interactive combat training targets, telegraphs, and status indicators. */
import { TILE_PX, type WorldEntitySnapshot } from "@dc2d/engine";
import { Container, Graphics } from "pixi.js";
import { ELEVATION_LIFT_PX } from "../world/cliffStrips.js";

type WorldEntityKind = WorldEntitySnapshot["kind"];

function drawStrawDummy(body: Graphics): void {
  body.rect(-3, -6, 6, 6).fill(0x78350f);
  body.rect(-6, -15, 12, 10).fill(0x18181b);
  body.rect(-5, -14, 10, 8).fill(0xca8a04);
  body.rect(-9, -14, 18, 4).fill(0x18181b);
  body.rect(-8, -13, 16, 2).fill(0xa16207);
  body.rect(-4, -22, 8, 8).fill(0x18181b);
  body.rect(-3, -21, 6, 6).fill(0xfacc15);
  body.rect(-2, -19, 1, 1).fill(0x18181b);
  body.rect(1, -19, 1, 1).fill(0x18181b);
}

function drawSlimeBody(body: Graphics): void {
  body.rect(-7, -11, 14, 11).fill(0x14532d);
  body.rect(-6, -10, 12, 9).fill(0x22c55e);
  body.rect(-5, -9, 10, 5).fill(0x4ade80);
  body.rect(-4, -8, 3, 2).fill(0x86efac);
  body.rect(-3, -6, 2, 2).fill(0x052e16);
  body.rect(1, -6, 2, 2).fill(0x052e16);
}

function drawSparringDummy(body: Graphics): void {
  body.rect(-3, -6, 6, 6).fill(0x475569);
  body.rect(-6, -16, 12, 11).fill(0x0f172a);
  body.rect(-5, -15, 10, 9).fill(0x64748b);
  body.rect(-4, -14, 4, 6).fill(0x94a3b8);
  body.rect(-5, -23, 10, 8).fill(0x0f172a);
  body.rect(-4, -22, 8, 6).fill(0x94a3b8);
  body.rect(-3, -19, 6, 2).fill(0x0f172a);
  body.rect(5, -14, 3, 9).fill(0x92400e);
  body.rect(-9, -15, 4, 7).fill(0x78350f);
}

const KIND_SLIME = "slime-dummy" as const;

function buildBodyGraphic(kind: WorldEntityKind): Graphics {
  const g = new Graphics();
  if (kind === KIND_SLIME) drawSlimeBody(g);
  else if (kind === "spar-dummy") drawSparringDummy(g);
  else drawStrawDummy(g);
  return g;
}

function resolveBodyTint(snap: WorldEntitySnapshot): number {
  if (snap.hitTimer > 0) return 0xfca5a5;
  if (snap.staggerTimer > 0) return 0xfef08a;
  return 0xffffff;
}

class EntityView {
  readonly root = new Container();
  private readonly shadow = new Graphics();
  private readonly telegraph = new Graphics();
  private readonly body: Graphics;
  private readonly hpBg = new Graphics();
  private readonly hpFill = new Graphics();
  private readonly kind: WorldEntityKind;

  constructor(kind: WorldEntityKind) {
    this.kind = kind;
    this.shadow.ellipse(0, 0, 7, 2.2).fill({ color: 0x0c1018, alpha: 0.36 });
    this.body = buildBodyGraphic(kind);
    this.hpBg.rect(-9, -27, 18, 3).fill({ color: 0x090d14, alpha: 0.85 });
    this.hpBg.visible = false;
    this.hpFill.rect(-8, -26, 16, 1.5).fill(0xef4444);
    this.hpFill.visible = false;
    this.root.addChild(this.shadow, this.telegraph, this.body, this.hpBg, this.hpFill);
  }

  sync(snap: WorldEntitySnapshot, timeSec: number): void {
    const lift = snap.elevation * ELEVATION_LIFT_PX;
    this.root.position.set(snap.x * TILE_PX, snap.y * TILE_PX - lift);
    this.root.zIndex = Math.round(snap.y * TILE_PX) + snap.elevation * 2;
    this.syncBodyState(snap, timeSec);
    this.syncHpBar(snap);
    this.syncTelegraph(snap);
  }

  private syncBodyState(snap: WorldEntitySnapshot, timeSec: number): void {
    const deadSlime = snap.hp <= 0 && this.kind === KIND_SLIME;
    this.body.alpha = deadSlime ? 0.25 : 1;
    const hitShake = snap.hitTimer > 0 ? Math.sin(timeSec * 55) * 0.14 : 0;
    const staggerSpin = snap.staggerTimer > 0 ? Math.sin(timeSec * 22) * 0.22 : 0;
    this.body.rotation = hitShake + staggerSpin;
    this.body.tint = resolveBodyTint(snap);
    this.applyBodyScale(snap, timeSec, deadSlime);
  }

  private applyBodyScale(snap: WorldEntitySnapshot, timeSec: number, deadSlime: boolean): void {
    if (this.kind === KIND_SLIME && !deadSlime) {
      const sy = 1 + Math.sin(timeSec * 4.5 + snap.x) * 0.07;
      this.body.scale.set(1 / sy, sy);
      return;
    }
    this.body.scale.set(1, deadSlime ? 0.35 : 1);
  }

  private syncHpBar(snap: WorldEntitySnapshot): void {
    const show = snap.hp > 0 && snap.hp < snap.maxHp;
    this.hpBg.visible = show;
    this.hpFill.visible = show;
    if (!show) return;
    const ratio = Math.max(0.05, Math.min(1, snap.hp / snap.maxHp));
    this.hpFill.scale.x = ratio;
    this.hpFill.position.x = -8 * (1 - ratio);
  }

  private syncTelegraph(snap: WorldEntitySnapshot): void {
    this.telegraph.clear();
    if (snap.telegraphProgress <= 0 || snap.hp <= 0) return;
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
