/** Renders POI chests, floating Open/Pickup prompts, and ground loot/arrow views. */
import { AI_TUNING, TILE_PX, type GroundLootSnapshot, type PlayerSnapshot, type WorldChestSnapshot } from "@dc2d/engine";
import { Container, Graphics, Sprite } from "pixi.js";
import { getLoadedSpriteAsset } from "../textures/spriteManifest.js";
import { ELEVATION_LIFT_PX } from "../world/cliffStrips.js";
import { createGroundLootView, syncGroundLootView, type LootView } from "./lootViewHelpers.js";

const PROMPT_CSS = `
.ow-chest-prompt {
  position: fixed; left: 50%; transform: translateX(-50%);
  bottom: calc(max(12px, env(safe-area-inset-bottom)) + var(--ow-slot-size, 44px) + 64px);
  z-index: 41; padding: 6px 14px; border-radius: 999px;
  background: rgba(15, 23, 42, 0.92); color: #fde047;
  border: 1px solid rgba(250, 204, 21, 0.55); font-size: 12px; font-weight: 800;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45); cursor: pointer; touch-action: manipulation;
}
.ow-chest-prompt[hidden] { display: none; }
`;

function drawChestGraphic(g: Graphics, c: WorldChestSnapshot, nearAndClosed: boolean): void {
  const stone = c.poiKind === "ancient-ruins";
  const body = stone ? 0x475569 : 0x78350f;
  const trim = stone ? 0x94a3b8 : 0xb45309;
  const lock = c.opened ? 0x334155 : 0xfacc15;
  g.clear();
  g.ellipse(0, 1, 8, 3).fill({ color: 0x090d14, alpha: 0.35 });
  g.rect(-7, -9, 14, 9).fill(0x0f172a);
  g.rect(-6, -8, 12, 7).fill(body);
  g.rect(-6, c.opened ? -10 : -8, 12, 3).fill(trim);
  g.rect(-1, -6, 2, 3).fill(lock);
  if (nearAndClosed) g.rect(-8, -11, 16, 12).stroke({ color: 0xfde047, width: 1 });
}

interface ChestView {
  readonly root: Container;
  readonly shadow: Graphics;
  readonly highlight: Graphics;
  readonly sprite: Sprite | null;
  readonly fallback: Graphics | null;
  lastKey: string;
  lastHighlight: boolean;
}

function chestSpriteKey(c: WorldChestSnapshot): string {
  const stone = c.poiKind === "ancient-ruins";
  return `${stone ? "chest-stone" : "chest-wood"}-${c.opened ? "open" : "closed"}`;
}

function syncChestHighlight(view: ChestView, highlighted: boolean): void {
  if (view.lastHighlight === highlighted) return;
  view.highlight.clear();
  if (highlighted) view.highlight.ellipse(0, -1, 11, 4.5).stroke({ color: 0xfde047, width: 1.5 });
}

function syncChestViewVisual(view: ChestView, c: WorldChestSnapshot, highlighted: boolean): void {
  const key = chestSpriteKey(c);
  if (view.sprite) {
    const asset = view.lastKey !== key ? getLoadedSpriteAsset(key) : null;
    if (asset) { view.sprite.texture = asset.texture; view.sprite.scale.set(asset.scale); view.sprite.anchor.set(asset.anchorX, asset.anchorY); }
    syncChestHighlight(view, highlighted);
  } else if (view.fallback && (view.lastKey !== key || view.lastHighlight !== highlighted)) {
    drawChestGraphic(view.fallback, c, highlighted);
  }
  view.lastKey = key;
  view.lastHighlight = highlighted;
}

function pruneChestViews(views: Map<string, ChestView>, items: readonly { readonly id: string }[]): void {
  const active = new Set(items.map((item) => item.id));
  for (const [id, view] of views) {
    if (!active.has(id)) { view.root.destroy({ children: true }); views.delete(id); }
  }
}

export class WorldPickupsRenderer {
  readonly container = new Container();
  private readonly chestViews = new Map<string, ChestView>();
  private readonly lootViews = new Map<string, LootView>();
  private readonly promptBtn: HTMLButtonElement;
  private nearLootId: string | undefined;

  constructor(host: HTMLElement, onInteract: (lootId?: string) => void) {
    this.container.sortableChildren = true;
    this.ensurePromptStyle();
    this.promptBtn = document.createElement("button");
    this.promptBtn.type = "button";
    this.promptBtn.className = "ow-chest-prompt";
    this.promptBtn.textContent = "[E] Open Chest";
    this.promptBtn.hidden = true;
    this.promptBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.promptBtn.addEventListener("click", (e) => { e.stopPropagation(); onInteract(this.nearLootId); });
    host.append(this.promptBtn);
  }

  private ensurePromptStyle(): void {
    if (document.getElementById("ow-chest-prompt-css")) return;
    const style = document.createElement("style");
    style.id = "ow-chest-prompt-css";
    style.textContent = PROMPT_CSS;
    document.head.append(style);
  }

  sync(opts: {
    readonly chests: readonly WorldChestSnapshot[];
    readonly groundLoot: readonly GroundLootSnapshot[];
    readonly local: PlayerSnapshot | undefined;
    readonly timeSec: number;
  }): void {
    const nearChestId = this.syncChests(opts.chests, opts.local);
    const nearArrowId = this.syncGroundLoot(opts.groundLoot, opts.local, opts.timeSec);
    this.nearLootId = nearChestId ? undefined : (nearArrowId ?? undefined);
    this.promptBtn.hidden = nearChestId === null && nearArrowId === null;
    if (nearChestId) this.promptBtn.textContent = "[E] Open Chest";
    else if (nearArrowId) this.promptBtn.textContent = "[E] Pick up Arrow";
  }

  private syncChests(chests: readonly WorldChestSnapshot[], local: PlayerSnapshot | undefined): string | null {
    pruneChestViews(this.chestViews, chests);
    let nearestOpenable: string | null = null;
    let bestDist: number = AI_TUNING.chestInteractRadiusTiles;
    for (const c of chests) {
      const dist = local ? Math.hypot(c.x - local.x, c.y - local.y) : 99;
      if (dist <= bestDist) { bestDist = dist; nearestOpenable = c.id; }
      const view = this.chestViews.get(c.id) ?? this.createChestView(c);
      syncChestViewVisual(view, c, c.id === nearestOpenable);
      view.root.position.set(c.x * TILE_PX, c.y * TILE_PX - c.elevation * ELEVATION_LIFT_PX);
      view.root.zIndex = Math.round(c.y * TILE_PX) + c.elevation * 2;
    }
    return nearestOpenable;
  }

  private createChestView(c: WorldChestSnapshot): ChestView {
    const root = new Container();
    const shadow = new Graphics();
    shadow.ellipse(0, 1, 9, 3).fill({ color: 0x090d14, alpha: 0.35 });
    const highlight = new Graphics();
    const asset = getLoadedSpriteAsset(chestSpriteKey(c));
    const sprite = asset ? new Sprite(asset.texture) : null;
    const fallback = asset ? null : new Graphics();
    if (sprite && asset) { sprite.anchor.set(asset.anchorX, asset.anchorY); sprite.scale.set(asset.scale); }
    root.addChild(shadow, highlight, sprite ?? fallback!);
    this.container.addChild(root);
    const view: ChestView = { root, shadow, highlight, sprite, fallback, lastKey: "", lastHighlight: false };
    this.chestViews.set(c.id, view);
    return view;
  }

  private findNearestManualLoot(list: readonly GroundLootSnapshot[], local: PlayerSnapshot | undefined): string | null {
    if (!local) return null;
    let bestId: string | null = null;
    let bestDist = 2.25;
    for (const item of list) {
      if (!item.manualPickup) continue;
      const d = Math.hypot(item.x - local.x, item.y - local.y);
      if (d <= bestDist) { bestDist = d; bestId = item.id; }
    }
    return bestId;
  }

  private syncGroundLoot(list: readonly GroundLootSnapshot[], local: PlayerSnapshot | undefined, timeSec: number): string | null {
    const active = new Set(list.map((g) => g.id));
    for (const [id, view] of this.lootViews) {
      if (!active.has(id)) { view.root.destroy({ children: true }); this.lootViews.delete(id); }
    }
    const nearId = this.findNearestManualLoot(list, local);
    for (const item of list) {
      let view = this.lootViews.get(item.id);
      if (!view) { view = createGroundLootView(item); this.lootViews.set(item.id, view); this.container.addChild(view.root); }
      syncGroundLootView(view, { item, tilePx: TILE_PX, timeSec, highlighted: item.id === nearId });
    }
    return nearId;
  }
}
