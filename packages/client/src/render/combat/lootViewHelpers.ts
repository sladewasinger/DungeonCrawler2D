/** Ground loot visuals: crisp angled recoverable arrows and real pixel-art item icon sprites. */
import type { GroundLootSnapshot, PlayerSnapshot, WorldChestSnapshot } from "@dc2d/engine";
import { AI_TUNING } from "@dc2d/engine";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { getItemHeldTexture } from "../../ui/icons/itemIcons.js";
import { ELEVATION_LIFT_PX } from "../world/cliffStrips.js";

export function findTapChestAt(opts: {
  readonly chests: readonly WorldChestSnapshot[]; readonly world: { readonly x: number; readonly y: number }; readonly me: PlayerSnapshot;
}): WorldChestSnapshot | undefined {
  return opts.chests.find((c) => {
    const cy = c.y - c.elevation * 0.625 - 0.25;
    return Math.hypot(opts.world.x - c.x, opts.world.y - cy) <= 1.25 && Math.hypot(c.x - opts.me.x, c.y - opts.me.y) <= AI_TUNING.chestInteractRadiusTiles + 0.45;
  });
}

export function findTapManualLootAt(opts: {
  readonly groundLoot: readonly GroundLootSnapshot[]; readonly world: { readonly x: number; readonly y: number }; readonly me: PlayerSnapshot;
}): GroundLootSnapshot | undefined {
  return opts.groundLoot.find((g) => {
    const gy = g.y - g.elevation * 0.625;
    return Math.hypot(opts.world.x - g.x, opts.world.y - gy) <= 0.95 && Math.hypot(g.x - opts.me.x, g.y - opts.me.y) <= 2.25;
  });
}

export interface LootView {
  readonly root: Container;
  readonly body: Container;
  readonly shadow: Graphics;
  readonly highlight: Graphics;
  lastHighlighted: boolean;
}

export function drawUnifiedArrowGraphic(g: Graphics, opts?: { readonly charge?: number | undefined }): void {
  g.clear();
  if ((opts?.charge ?? 0) >= 0.7) {
    g.moveTo(-11, 0).lineTo(-5, 0).stroke({ color: 0xfef08a, width: 1.1, alpha: 0.7 });
  }
  g.moveTo(-5.5, 0).lineTo(4.0, 0).stroke({ color: 0x0f172a, width: 2.4, cap: "round" });
  g.poly([2.2, -2.3, 7.2, 0, 2.2, 2.3], true).fill(0x0f172a);
  g.poly([-6.6, -2.0, -3.2, -0.7, -3.2, 0.7, -6.6, 2.0, -5.2, 0], true).fill(0x0f172a);
  g.moveTo(-5.0, 0).lineTo(3.4, 0).stroke({ color: 0xb45309, width: 1.1 });
  g.poly([2.8, -1.6, 6.4, 0, 2.8, 1.6], true).fill(0xe2e8f0);
  g.poly([-5.9, -1.4, -3.5, -0.4, -4.6, 0], true).fill(0xf8fafc);
  g.poly([-5.9, 1.4, -3.5, 0.4, -4.6, 0], true).fill(0xe2e8f0);
}

function createArrowView(item: GroundLootSnapshot): LootView {
  const root = new Container();
  const body = new Container();
  const shadow = new Graphics();
  shadow.ellipse(0, 1, 5, 1.8).fill({ color: 0x090d14, alpha: 0.35 });
  const highlight = new Graphics();
  const shaft = new Graphics();
  drawUnifiedArrowGraphic(shaft);
  shaft.position.set(0, item.stuck ? -6 : -1);
  shaft.rotation = item.angle ?? 0.35;
  body.addChild(shaft);
  root.addChild(shadow, highlight, body);
  return { root, body, shadow, highlight, lastHighlighted: false };
}

function createCountBadge(count: number): Text {
  const txt = new Text({
    text: String(count), resolution: 2, roundPixels: false, textureStyle: { scaleMode: "linear" },
    style: {
      fontSize: 28, fontWeight: "800", fill: 0xfef08a,
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      stroke: { color: 0x0f172a, width: 6, join: "round" },
    },
  });
  txt.anchor.set(1, 1);
  txt.scale.set(0.24);
  txt.position.set(7, 2);
  return txt;
}

function createIconLootView(item: GroundLootSnapshot): LootView {
  const root = new Container();
  const shadow = new Graphics();
  shadow.ellipse(0, 1, 6, 2.2).fill({ color: 0x090d14, alpha: 0.36 });
  const highlight = new Graphics();
  const body = new Container();
  const tex = getItemHeldTexture(item.itemId);
  if (tex) {
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5, 0.85);
    sprite.scale.set(0.38);
    body.addChild(sprite);
  } else {
    const fallback = new Graphics();
    fallback.circle(0, -4, 3).fill(0x93c5fd);
    body.addChild(fallback);
  }
  if (item.count > 1) body.addChild(createCountBadge(item.count));
  root.addChild(shadow, highlight, body);
  return { root, body, shadow, highlight, lastHighlighted: false };
}

export function findManualLootInReach(groundLoot: readonly GroundLootSnapshot[], me: PlayerSnapshot): GroundLootSnapshot | undefined {
  return groundLoot.find((g) => g.manualPickup && Math.hypot(g.x - me.x, g.y - me.y) <= 2.25);
}

export function resolveTapInteractTarget(opts: {
  readonly chests: readonly WorldChestSnapshot[]; readonly groundLoot: readonly GroundLootSnapshot[];
  readonly world: { readonly x: number; readonly y: number }; readonly me: PlayerSnapshot | undefined;
}): { readonly kind: "chest" | "loot"; readonly id: string } | null {
  if (!opts.me) return null;
  const chest = findTapChestAt({ chests: opts.chests, world: opts.world, me: opts.me });
  if (chest) return { kind: "chest", id: chest.id };
  const loot = findTapManualLootAt({ groundLoot: opts.groundLoot, world: opts.world, me: opts.me });
  return loot ? { kind: "loot", id: loot.id } : null;
}

export function createGroundLootView(item: GroundLootSnapshot): LootView {
  return item.itemId === "arrow" && item.manualPickup ? createArrowView(item) : createIconLootView(item);
}

export function syncGroundLootView(view: LootView, opts: {
  readonly item: GroundLootSnapshot; readonly tilePx: number; readonly timeSec: number; readonly highlighted: boolean;
}): void {
  const { item, tilePx, timeSec, highlighted } = opts;
  const bob = item.manualPickup ? (highlighted ? Math.sin(timeSec * 5) * 0.6 : 0) : Math.sin(timeSec * 6 + item.x * 2) * 1.5;
  view.body.position.set(0, bob);
  const lift = item.elevation * ELEVATION_LIFT_PX;
  view.root.position.set(item.x * tilePx, item.y * tilePx - lift);
  view.root.zIndex = Math.round(item.y * tilePx) + item.elevation * 2 + 1;
  if (view.lastHighlighted === highlighted) return;
  view.highlight.clear();
  if (highlighted) view.highlight.ellipse(0, -1, 7.5, 3.6).stroke({ color: 0xfde047, width: 1.2 });
  view.lastHighlighted = highlighted;
}
