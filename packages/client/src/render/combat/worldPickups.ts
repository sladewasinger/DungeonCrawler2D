/** Renders POI chests, floating Open prompt, and magnetized ground loot pickups. */
import { AI_TUNING, TILE_PX, type GroundLootSnapshot, type PlayerSnapshot, type WorldChestSnapshot } from "@dc2d/engine";
import { Container, Graphics } from "pixi.js";
import { ELEVATION_LIFT_PX } from "../world/cliffStrips.js";

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

function lootTintFor(itemId: string): number {
  if (itemId.includes("meat") || itemId === "bandage") return 0xf87171;
  if (itemId === "arrow" || itemId === "torch") return 0xfbbf24;
  if (itemId === "herb") return 0x4ade80;
  return 0x93c5fd;
}

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

function pruneMissingViews(views: Map<string, Graphics>, items: readonly { readonly id: string }[]): void {
  const active = new Set(items.map((item) => item.id));
  for (const [id, view] of views) {
    if (!active.has(id)) { view.destroy(); views.delete(id); }
  }
}

export class WorldPickupsRenderer {
  readonly container = new Container();
  private readonly chestViews = new Map<string, Graphics>();
  private readonly lootViews = new Map<string, Graphics>();
  private readonly promptBtn: HTMLButtonElement;

  constructor(host: HTMLElement, onInteractChest: () => void) {
    this.container.sortableChildren = true;
    this.ensurePromptStyle();
    this.promptBtn = document.createElement("button");
    this.promptBtn.type = "button";
    this.promptBtn.className = "ow-chest-prompt";
    this.promptBtn.textContent = "[E] Open Chest";
    this.promptBtn.hidden = true;
    this.promptBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.promptBtn.addEventListener("click", (e) => { e.stopPropagation(); onInteractChest(); });
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
    const nearId = this.syncChests(opts.chests, opts.local);
    this.promptBtn.hidden = nearId === null;
    this.syncGroundLoot(opts.groundLoot, opts.timeSec);
  }

  private syncChests(chests: readonly WorldChestSnapshot[], local: PlayerSnapshot | undefined): string | null {
    pruneMissingViews(this.chestViews, chests);
    let nearestOpenable: string | null = null;
    let bestDist: number = AI_TUNING.chestInteractRadiusTiles;
    for (const c of chests) {
      const dist = local ? Math.hypot(c.x - local.x, c.y - local.y) : 99;
      if (dist <= bestDist) { bestDist = dist; nearestOpenable = c.id; }
      const view = this.chestViews.get(c.id) ?? this.createChestView(c.id);
      drawChestGraphic(view, c, c.id === nearestOpenable);
      view.position.set(c.x * TILE_PX, c.y * TILE_PX - c.elevation * ELEVATION_LIFT_PX);
      view.zIndex = Math.round(c.y * TILE_PX) + c.elevation * 2;
    }
    return nearestOpenable;
  }

  private createChestView(id: string): Graphics {
    const g = new Graphics();
    this.chestViews.set(id, g);
    this.container.addChild(g);
    return g;
  }

  private syncGroundLoot(list: readonly GroundLootSnapshot[], timeSec: number): void {
    const active = new Set(list.map((g) => g.id));
    for (const [id, view] of this.lootViews) {
      if (!active.has(id)) { view.destroy(); this.lootViews.delete(id); }
    }
    for (const item of list) {
      const view = this.lootViews.get(item.id) ?? this.createLootView(item);
      const bob = Math.sin(timeSec * 6 + item.x * 2) * 1.6;
      const lift = item.elevation * ELEVATION_LIFT_PX;
      view.position.set(item.x * TILE_PX, item.y * TILE_PX - lift + bob);
      view.zIndex = Math.round(item.y * TILE_PX) + item.elevation * 2 + 1;
    }
  }

  private createLootView(item: GroundLootSnapshot): Graphics {
    const g = new Graphics();
    const tint = lootTintFor(item.itemId);
    g.circle(0, -3, 5).fill({ color: tint, alpha: 0.25 });
    g.rect(-3, -6, 6, 6).fill(0x0f172a);
    g.rect(-2, -5, 4, 4).fill(tint);
    g.rect(-1, -5, 2, 1).fill(0xffffff);
    this.lootViews.set(item.id, g);
    this.container.addChild(g);
    return g;
  }
}
