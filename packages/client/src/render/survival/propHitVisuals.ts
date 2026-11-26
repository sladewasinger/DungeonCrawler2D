/** Prop hit wobble, tint flash, decaying 24x4px micro HP bars, cracks, tree tip-over, and tool hints. */
import { TILE_PX, type PlayerSnapshot, type WorldEvent } from "@dc2d/engine";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { isTreeProp } from "../textures/propTextures.js";
import { ELEVATION_LIFT_PX } from "../world/cliffStrips.js";
import type { MountedPropEntry } from "../world/chunkProps.js";

export type PropLookup = (propId: string) => MountedPropEntry | undefined;

interface ActivePropFx {
  readonly id: string;
  readonly bar: Graphics;
  readonly crack: Graphics;
  readonly wx: number;
  readonly wy: number;
  readonly elevation: number;
  readonly biasDir: number;
  hpRatio: number;
  wobbleAge: number;
  barAge: number;
}

interface TippingTreeFx {
  readonly root: Container;
  readonly targetRot: number;
  age: number;
  readonly ttl: number;
}

interface FloatingHint {
  readonly label: Text;
  age: number;
  readonly ttl: number;
}

const HP_BAR_W = 24;
const HP_BAR_H = 4;
const WOBBLE_TTL = 0.18;
const FLASH_TTL = 0.09;
const BAR_TTL = 2.0;
const TREE_TIP_TTL = 0.35;
const HINT_COOLDOWN_MS = 5_000;

function drawHpBarAndCrack(fx: ActivePropFx): void {
  const fillW = Math.max(1, Math.round(HP_BAR_W * Math.max(0, Math.min(1, fx.hpRatio))));
  const fillCol = fx.hpRatio > 0.5 ? 0x4ade80 : fx.hpRatio > 0.25 ? 0xfacc15 : 0xef4444;
  fx.bar.clear();
  fx.bar.rect(-HP_BAR_W * 0.5 - 1, -1, HP_BAR_W + 2, HP_BAR_H + 2).fill(0x090d14);
  fx.bar.rect(-HP_BAR_W * 0.5, 0, fillW, HP_BAR_H).fill(fillCol);
  fx.crack.clear();
  if (fx.hpRatio > 0.5) return;
  fx.crack.moveTo(-3, -6).lineTo(0, -1).lineTo(-2, 3).moveTo(2, -5).lineTo(0, -1).lineTo(4, 2)
    .stroke({ color: 0x090d14, width: 1.5 });
}

function wrongToolHintText(ev: WorldEvent, actor: PlayerSnapshot | undefined): string | null {
  if (!actor || !ev.value) return null;
  const held = actor.heldItem ?? "";
  if (ev.comboStep === 1) return held.includes("axe") ? null : "Axe chops faster";
  if (ev.comboStep === 2) return held.includes("pickaxe") ? null : "Pickaxe mines faster";
  return null;
}

export class PropHitVisuals {
  private readonly props = new Map<string, ActivePropFx>();
  private readonly tippingTrees: TippingTreeFx[] = [];
  private readonly hints: FloatingHint[] = [];
  private nextSlowHintAtMs = 0;

  constructor(private readonly container: Container) {}

  onHarvestHit(ev: WorldEvent, players: readonly PlayerSnapshot[], lookup?: PropLookup): void {
    const actor = ev.actorId ? players.find((p) => p.id === ev.actorId) : undefined;
    const elev = actor?.elevation ?? 0;
    if (ev.reason) this.spawnHint({ x: ev.x, y: ev.y, elev, text: ev.reason, color: 0xfde047 });
    else this.maybeSlowToolHint(ev, actor);
    if (ev.targetId && ev.hpRatio !== undefined) this.upsertPropFx({ ev, elev, lookup });
  }

  onHarvestBreak(ev: WorldEvent, players: readonly PlayerSnapshot[], lookup?: PropLookup): void {
    if (ev.targetId) this.deletePropFx(ev.targetId, lookup);
    const mounted = this.resolveBreakingTree(ev, lookup);
    if (!mounted) return;
    const elev = mounted.elevation || this.findActorElev(ev.actorId, players);
    this.spawnTippingTree({ mounted, dirX: ev.dirX ?? 1, wx: ev.x, wy: ev.y, elev });
  }

  private resolveBreakingTree(ev: WorldEvent, lookup?: PropLookup): MountedPropEntry | null {
    if (ev.comboStep !== 1 || !ev.targetId || !lookup) return null;
    const mounted = lookup(ev.targetId);
    return mounted && isTreeProp(mounted.kind) ? mounted : null;
  }

  private findActorElev(actorId: string | undefined, players: readonly PlayerSnapshot[]): number {
    return (actorId ? players.find((p) => p.id === actorId)?.elevation : undefined) ?? 0;
  }

  onReasonNotice(opts: { readonly x: number; readonly y: number; readonly elev: number; readonly reason: string }): void {
    this.spawnHint({ x: opts.x, y: opts.y, elev: opts.elev, text: opts.reason, color: 0xfca5a5 });
  }

  step(dt: number, lookup?: PropLookup): void {
    this.stepProps(dt, lookup);
    this.stepTippingTrees(dt);
    this.stepHints(dt);
  }

  private maybeSlowToolHint(ev: WorldEvent, actor: PlayerSnapshot | undefined): void {
    const text = wrongToolHintText(ev, actor);
    const now = performance.now();
    if (!text || now < this.nextSlowHintAtMs) return;
    this.nextSlowHintAtMs = now + HINT_COOLDOWN_MS;
    this.spawnHint({ x: ev.x, y: ev.y, elev: actor?.elevation ?? 0, text, color: 0xe2e8f0 });
  }

  private upsertPropFx(opts: { readonly ev: WorldEvent; readonly elev: number; readonly lookup?: PropLookup | undefined }): void {
    const { ev, elev, lookup } = opts;
    const id = ev.targetId!;
    let fx = this.props.get(id);
    const px = ev.x * TILE_PX;
    const py = ev.y * TILE_PX - elev * ELEVATION_LIFT_PX;
    if (!fx) {
      const bar = new Graphics(); bar.position.set(px, py - 24);
      const crack = new Graphics(); crack.position.set(px, py - 6);
      this.container.addChild(bar, crack);
      const biasDir = (ev.dirX ?? 1) >= 0 ? 1 : -1;
      fx = { id, bar, crack, wx: ev.x, wy: ev.y, elevation: elev, biasDir, hpRatio: ev.hpRatio!, wobbleAge: 0, barAge: 0 };
      this.props.set(id, fx);
    } else {
      fx.hpRatio = ev.hpRatio!; fx.wobbleAge = 0; fx.barAge = 0;
    }
    drawHpBarAndCrack(fx);
    const mounted = lookup?.(id);
    if (mounted) mounted.sprite.tint = 0xffeedd;
  }

  private spawnTippingTree(opts: {
    readonly mounted: MountedPropEntry; readonly dirX: number; readonly wx: number; readonly wy: number; readonly elev: number;
  }): void {
    const root = new Container();
    root.position.set(opts.wx * TILE_PX, opts.wy * TILE_PX - opts.elev * ELEVATION_LIFT_PX);
    const trunk = new Sprite(opts.mounted.sprite.texture);
    trunk.anchor.copyFrom(opts.mounted.sprite.anchor); trunk.scale.copyFrom(opts.mounted.sprite.scale);
    root.addChild(trunk);
    if (opts.mounted.canopy) {
      const crown = new Sprite(opts.mounted.canopy.texture);
      crown.anchor.copyFrom(opts.mounted.canopy.anchor); crown.scale.copyFrom(opts.mounted.canopy.scale);
      crown.position.set(0, -6);
      root.addChild(crown);
    }
    this.container.addChild(root);
    this.tippingTrees.push({ root, targetRot: (opts.dirX >= 0 ? 1 : -1) * 1.35, age: 0, ttl: TREE_TIP_TTL });
  }

  private spawnHint(opts: { readonly x: number; readonly y: number; readonly elev: number; readonly text: string; readonly color: number }): void {
    if (this.hints.length >= 8) { const oldest = this.hints.shift(); oldest?.label.destroy(); }
    const label = new Text({
      text: opts.text,
      style: { fontFamily: "system-ui, sans-serif", fontSize: 11, fontWeight: "800", fill: opts.color, stroke: { color: 0x090d14, width: 3 } },
    });
    label.anchor.set(0.5, 1);
    label.position.set(opts.x * TILE_PX, opts.y * TILE_PX - opts.elev * ELEVATION_LIFT_PX - 18);
    this.container.addChild(label);
    this.hints.push({ label, age: 0, ttl: 1.35 });
  }

  private stepProps(dt: number, lookup?: PropLookup): void {
    for (const [id, fx] of this.props) {
      fx.wobbleAge += dt;
      fx.barAge += dt;
      this.applyWobble(fx, lookup);
      const fade = fx.barAge > 1.5 ? Math.max(0, (BAR_TTL - fx.barAge) / 0.5) : 1;
      fx.bar.alpha = fade;
      fx.crack.alpha = fade;
      if (fx.barAge >= BAR_TTL) this.deletePropFx(id, lookup);
    }
  }

  private applyWobble(fx: ActivePropFx, lookup?: PropLookup): void {
    const mounted = lookup?.(fx.id);
    if (!mounted) return;
    if (fx.wobbleAge < WOBBLE_TTL) {
      const decay = 1 - fx.wobbleAge / WOBBLE_TTL;
      mounted.sprite.position.x = mounted.baseX + fx.biasDir * decay * 2.5 * Math.cos(fx.wobbleAge * 52);
      mounted.sprite.rotation = fx.biasDir * decay * 0.06;
      mounted.sprite.tint = fx.wobbleAge < FLASH_TTL ? 0xffeedd : 0xffffff;
      return;
    }
    mounted.sprite.position.x = mounted.baseX;
    mounted.sprite.rotation = 0;
    mounted.sprite.tint = 0xffffff;
  }

  private deletePropFx(id: string, lookup?: PropLookup): void {
    const fx = this.props.get(id);
    if (!fx) return;
    const mounted = lookup?.(id);
    if (mounted) { mounted.sprite.position.x = mounted.baseX; mounted.sprite.rotation = 0; mounted.sprite.tint = 0xffffff; }
    fx.bar.destroy(); fx.crack.destroy();
    this.props.delete(id);
  }

  private stepTippingTrees(dt: number): void {
    for (let i = this.tippingTrees.length - 1; i >= 0; i--) {
      const t = this.tippingTrees[i]!;
      t.age += dt;
      if (t.age >= t.ttl) { t.root.destroy({ children: true }); this.tippingTrees.splice(i, 1); continue; }
      const p = t.age / t.ttl;
      t.root.rotation = t.targetRot * p * p;
      t.root.alpha = p > 0.65 ? Math.max(0, (1 - p) / 0.35) : 1;
    }
  }

  private stepHints(dt: number): void {
    for (let i = this.hints.length - 1; i >= 0; i--) {
      const h = this.hints[i]!;
      h.age += dt;
      if (h.age >= h.ttl) { h.label.destroy(); this.hints.splice(i, 1); continue; }
      h.label.position.y -= dt * 14;
      h.label.alpha = h.age > h.ttl * 0.65 ? Math.max(0, (h.ttl - h.age) / (h.ttl * 0.35)) : 1;
    }
  }
}
