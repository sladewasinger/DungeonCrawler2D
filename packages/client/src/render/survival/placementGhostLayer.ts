/** Snapped 0.5-tile emerald/crimson structure placement ghost with aura ring and rejection reason. */
import { FOREST_LIGHT_STYLE, getItemDef } from "@dc2d/content";
import {
  TILE_PX, WorldChunkCache, validateStructurePlacement,
  type PlayerSnapshot, type StructureKind,
} from "@dc2d/engine";
import { Container, Graphics } from "pixi.js";
import { ELEVATION_LIFT_PX } from "../world/cliffStrips.js";

const CRAFT_AURA_TILES = 2.8;

export interface PlacementGhostTarget {
  readonly itemId: string;
  readonly kind: StructureKind;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly valid: boolean;
  readonly reason?: string | undefined;
}

const snapHalfTile = (v: number): number => Math.round(v * 2) * 0.5;

function computeGhostWorldPoint(player: PlayerSnapshot, cursorWorld?: { readonly x: number; readonly y: number }): { readonly x: number; readonly y: number } {
  if (cursorWorld) return { x: snapHalfTile(cursorWorld.x), y: snapHalfTile(cursorWorld.y) };
  const aimDx = player.aimX ?? player.facingX;
  const aimDy = (player.aimY ?? player.facingY) || 1;
  const aimMag = Math.hypot(aimDx, aimDy) || 1;
  return { x: snapHalfTile(player.x + (aimDx / aimMag) * 1.5), y: snapHalfTile(player.y + (aimDy / aimMag) * 1.5) };
}

function resolvePlacementTarget(opts: {
  readonly heldItem: string | null | undefined;
  readonly player: PlayerSnapshot | undefined;
  readonly cache: WorldChunkCache;
  readonly cursorWorld?: { readonly x: number; readonly y: number } | undefined;
  readonly rotation: number;
}): PlacementGhostTarget | null {
  const { heldItem, player, cache, cursorWorld, rotation } = opts;
  const kind = heldItem ? getItemDef(heldItem)?.placeStructure : undefined;
  if (!heldItem || !player || !kind) return null;
  const { x, y } = computeGhostWorldPoint(player, cursorWorld);
  const check = validateStructurePlacement({
    cache, x, y, playerX: player.x, playerY: player.y, playerElev: player.elevation, kind,
  });
  return {
    itemId: heldItem, kind, x, y, rotation: ((rotation % 4) + 4) % 4,
    valid: check.ok, ...(check.ok ? {} : { reason: check.reason }),
  };
}

function drawDashedCircle(g: Graphics, opts: { readonly radiusPx: number; readonly color: number; readonly alpha: number }): void {
  const segs = 28;
  for (let i = 0; i < segs; i += 2) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    g.moveTo(Math.cos(a0) * opts.radiusPx, Math.sin(a0) * opts.radiusPx)
      .lineTo(Math.cos(a1) * opts.radiusPx, Math.sin(a1) * opts.radiusPx)
      .stroke({ color: opts.color, width: 1.3, alpha: opts.alpha });
  }
}

export class PlacementGhostLayer {
  readonly container = new Container();
  private readonly aura = new Graphics();
  private readonly body = new Graphics();
  private readonly badge: HTMLDivElement;
  private rotation = 0;
  private current: PlacementGhostTarget | null = null;

  constructor(host: HTMLElement) {
    this.container.addChild(this.aura, this.body);
    this.container.visible = false;
    this.badge = document.createElement("div");
    this.badge.className = "ow-placement-badge";
    this.badge.hidden = true;
    host.append(this.badge);
  }

  cycleRotation(): number {
    this.rotation = (this.rotation + 1) % 4;
    return this.rotation;
  }

  currentRotation(): number { return this.rotation; }
  currentTarget(): PlacementGhostTarget | null { return this.current; }

  sync(opts: {
    readonly heldItem: string | null | undefined;
    readonly player: PlayerSnapshot | undefined;
    readonly cache: WorldChunkCache;
    readonly cursorWorld?: { readonly x: number; readonly y: number } | undefined;
    readonly visible: boolean;
  }): PlacementGhostTarget | null {
    const target = opts.visible
      ? resolvePlacementTarget({ heldItem: opts.heldItem, player: opts.player, cache: opts.cache, cursorWorld: opts.cursorWorld, rotation: this.rotation })
      : null;
    this.current = target;
    this.container.visible = Boolean(target);
    this.badge.hidden = !target;
    if (!target || !opts.player) return null;
    this.drawGhost(target, opts.player.elevation);
    return target;
  }

  private drawGhostAura(target: PlacementGhostTarget, color: number): void {
    this.aura.clear();
    if (target.kind === "campfire" || target.kind === "workbench") {
      drawDashedCircle(this.aura, { radiusPx: CRAFT_AURA_TILES * TILE_PX, color, alpha: 0.55 });
    } else if (target.kind === "torch") {
      drawDashedCircle(this.aura, { radiusPx: FOREST_LIGHT_STYLE.playerTorchRadiusPx * 0.65, color, alpha: 0.45 });
    }
  }

  private updateGhostBadge(target: PlacementGhostTarget): void {
    this.badge.dataset.valid = String(target.valid);
    this.badge.dataset.rot = String(target.rotation);
    this.badge.textContent = target.valid ? `${target.kind} · [R] Rot ${target.rotation * 90}°` : `${target.kind}: ${target.reason ?? "Blocked"}`;
    this.badge.style.color = target.valid ? "#6ee7b7" : "#fca5a5";
  }

  private drawGhost(target: PlacementGhostTarget, elev: number): void {
    const px = target.x * TILE_PX;
    const py = target.y * TILE_PX - elev * ELEVATION_LIFT_PX;
    const color = target.valid ? 0x34d399 : 0xf87171;
    this.container.position.set(px, py);
    this.body.clear();
    const rotSwap = target.rotation % 2 === 1 && (target.kind === "bed" || target.kind === "palisade");
    const hw = rotSwap ? 7 : 10; const hh = rotSwap ? 10 : 7;
    this.body.roundRect(-hw, -hh, hw * 2, hh * 2, 3).fill({ color, alpha: 0.35 }).stroke({ color, width: 1.6, alpha: 0.85 });
    this.body.alpha = 0.65;
    this.drawGhostAura(target, color);
    this.updateGhostBadge(target);
  }
}
