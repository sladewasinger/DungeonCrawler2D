import { content } from "@dc2d/content";
import { MELEE_RANGE, TILE, hashString, type EntitySnapshot } from "@dc2d/engine";
import Phaser from "phaser";
import type { Connection } from "../net/connection";
import atlas from "./atlas.json";
import { TILE_PX, Z_PX } from "./constants";

/**
 * Every replicated entity plus the predicted self: sprite + ground
 * shadow (the sprite lifts off it by height above local terrain),
 * status tints, hp bars, swing arcs, and floating damage text.
 */

const RENDER_DELAY_MS = 120;

interface EntityVisual {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text | null;
  /** Eased screen elevation of the body (px). */
  elevPx?: number;
  /** Eased screen elevation of the ground under it (px, the shadow). */
  groundPx?: number;
}

/** Elevation chase rate (reaches ~90% in ~0.19s). */
const ELEV_EASE_RATE = 12;

export class EntityRenderer {
  private readonly visuals = new Map<string, EntityVisual>();
  private readonly selfVisual: EntityVisual;
  private readonly selfGhost: Phaser.GameObjects.Image;
  private readonly barGfx: Phaser.GameObjects.Graphics;
  private readonly hoverTip: Phaser.GameObjects.Text;
  private lastFrameAt = 0;
  private frameDt = 1 / 60;

  constructor(private readonly scene: Phaser.Scene) {
    this.selfVisual = {
      shadow: scene.add.ellipse(0, 0, 34, 16, 0x000000, 0.4).setDepth(1),
      sprite: scene.add.image(0, 0, "players", atlas.players.self).setOrigin(0.5, 0.85).setDepth(2),
      label: null,
    };
    // Silhouette ghost above the wall-cap layer: walls two tiles tall
    // hide a player standing right behind them completely — the ghost
    // keeps you located while occluded, invisible otherwise.
    this.selfGhost = scene.add
      .image(0, 0, "players", atlas.players.self)
      .setOrigin(0.5, 0.85)
      .setDepth(4.5)
      .setAlpha(0.3)
      .setVisible(false);
    this.barGfx = scene.add.graphics().setDepth(4);
    // Ground-item name on mouse hover — know what it is before [R].
    this.hoverTip = scene.add
      .text(0, 0, "", {
        fontSize: "12px",
        color: "#ffe9b0",
        backgroundColor: "#0d0a12",
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(45)
      .setVisible(false);
  }

  /**
   * Screen elevation — the sprite's up-screen shift for being high.
   * One EASED term driven by the body's z alone: grounded z is stepped
   * terrain (easing turns stair tiles into a smooth descend/ascend),
   * airborne z is the gravity arc (already smooth). Any model that
   * re-baselines against the under-tile terrain hops when the
   * reference and gravity disagree — walking off a ledge used to bounce
   * the sprite UP; a single eased z is monotone through a plain fall.
   * The shadow gets its own eased term tracking the ground underneath,
   * so the sprite-shadow gap still reads as jump height.
   */
  private elevate(visual: EntityVisual, z: number, terrain: number): { body: number; ground: number } {
    const k = 1 - Math.exp(-this.frameDt * ELEV_EASE_RATE);
    const chase = (cur: number | undefined, target: number): number =>
      cur === undefined ? target : cur + (target - cur) * k;
    visual.elevPx = chase(visual.elevPx, z * Z_PX);
    visual.groundPx = chase(visual.groundPx, terrain * Z_PX);
    return { body: visual.elevPx, ground: visual.groundPx };
  }

  renderSelf(conn: Connection, x: number, y: number, z: number): void {
    const world = conn.world!;
    const now = performance.now();
    this.frameDt = Math.min(0.1, (now - this.lastFrameAt) / 1000) || 1 / 60;
    this.lastFrameAt = now;
    const sx = x * TILE_PX;
    const sy = y * TILE_PX;
    // z is honest everywhere now — grounded z rides the stair ramps
    // physically (World.groundAt), airborne z is the jump arc. The
    // shadow tracks the ground under the body.
    const elev = this.elevate(this.selfVisual, z, world.groundAt(x, y));
    this.selfVisual.shadow.setPosition(sx, sy - elev.ground);
    this.selfVisual.shadow.setScale(1 - Math.min(0.35, (elev.body - elev.ground) / 400));
    this.selfVisual.sprite.setPosition(sx, sy - elev.body);
    this.selfVisual.sprite.setTint(statusTint(conn.fx));
    this.selfVisual.sprite.setAlpha(conn.downed ? 0.5 : 1);
    // On a wall top (or jumping over one) you render above the wall-cap
    // layer; on the ground you render below it (half-hidden behind walls).
    const overWall = world.tileAt(Math.floor(x), Math.floor(y)) === TILE.Wall;
    this.selfVisual.sprite.setDepth(overWall ? 3.5 : 2);
    this.selfVisual.shadow.setDepth(overWall ? 3.4 : 1);
    // Behind a wall (its cap covers this tile): show the silhouette.
    const occluded = !overWall && world.tileAt(Math.floor(x), Math.floor(y) + 1) === TILE.Wall;
    this.selfGhost.setVisible(occluded);
    if (occluded) this.selfGhost.setPosition(this.selfVisual.sprite.x, this.selfVisual.sprite.y);
  }

  renderRemotes(conn: Connection): void {
    const world = conn.world!;
    this.barGfx.clear();
    const seen = new Set<string>();
    const pointer = this.scene.input.activePointer;
    const cursor = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    let hover: { x: number; y: number; text: string; d: number } | null = null;

    for (const { id, snap, x, y, z } of conn.interpolated(RENDER_DELAY_MS)) {
      seen.add(id);
      let visual = this.visuals.get(id);
      if (!visual) {
        visual = this.createVisual(snap);
        this.visuals.set(id, visual);
      }
      const px = x * TILE_PX;
      const py = y * TILE_PX;
      const elev = this.elevate(visual, z, world.groundAt(x, y));
      visual.shadow.setPosition(px, py - elev.ground);
      visual.shadow.setScale(1 - Math.min(0.35, (elev.body - elev.ground) / 400));
      visual.sprite.setPosition(px, py - elev.body);
      visual.sprite.setTint(statusTint(snap.fx ?? []));
      visual.sprite.setAlpha(snap.downed ? 0.5 : 1);
      visual.label?.setPosition(px, py - elev.body - 44);
      const overWall = world.tileAt(Math.floor(x), Math.floor(y)) === TILE.Wall;
      visual.sprite.setDepth(overWall ? 3.5 : 2);
      visual.shadow.setDepth(overWall ? 3.4 : 1);

      if (snap.hp !== undefined && snap.maxHp !== undefined && snap.hp < snap.maxHp) {
        const frac = Math.max(0, snap.hp / snap.maxHp);
        this.barGfx.fillStyle(0x0d0a12, 0.8).fillRect(px - 20, py - elev.body - 40, 40, 5);
        this.barGfx
          .fillStyle(frac > 0.35 ? 0x6fce62 : 0xd8574d, 1)
          .fillRect(px - 19, py - elev.body - 39, 38 * frac, 3);
      }

      if (snap.kind === "item") {
        const d = Math.hypot(px - cursor.x, py - elev.body - cursor.y);
        if (d < 36 && (hover === null || d < hover.d)) {
          const name = content.items.get(snap.defId ?? "")?.name ?? snap.defId ?? "?";
          const qty = snap.qty !== undefined && snap.qty > 1 ? ` ×${snap.qty}` : "";
          hover = { x: px, y: py - elev.body - 14, text: name + qty, d };
        }
      }
    }

    this.hoverTip.setVisible(hover !== null);
    if (hover) this.hoverTip.setPosition(hover.x, hover.y).setText(hover.text);

    for (const [id, visual] of this.visuals) {
      if (!seen.has(id)) {
        visual.sprite.destroy();
        visual.shadow.destroy();
        visual.label?.destroy();
        this.visuals.delete(id);
      }
    }
  }

  /** Cosmetic melee swing arc — attacking must feel like something, hit or miss. */
  showSwing(dx: number, dy: number): void {
    const len = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy / len, dx / len);
    const px = this.selfVisual.sprite.x;
    const py = this.selfVisual.sprite.y;
    const radius = MELEE_RANGE * TILE_PX * 0.9;
    const g = this.scene.add.graphics().setDepth(4);
    g.fillStyle(0xffe9b0, 0.35);
    g.slice(px, py, radius, angle - 0.55, angle + 0.55);
    g.fillPath();
    g.lineStyle(3, 0xfff6d8, 0.9);
    g.beginPath();
    g.arc(px, py, radius, angle - 0.55, angle + 0.55);
    g.strokePath();
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 130, onComplete: () => g.destroy() });
  }

  spawnFloatingText(conn: Connection): void {
    for (const event of conn.drainVisualEvents()) {
      if (event.t !== "hit") continue;
      const pos = entityScreenPos(conn, event.id);
      if (!pos) continue;
      const text = this.scene.add
        .text(pos.x, pos.y - 50, `${event.amount > 0 ? "+" : ""}${Math.round(event.amount)}`, {
          fontSize: "14px",
          color: event.amount < 0 ? "#ff7a66" : "#8fe08a",
          fontStyle: "bold",
        })
        .setOrigin(0.5, 1)
        .setDepth(50);
      this.scene.tweens.add({
        targets: text,
        y: pos.y - 90,
        alpha: 0,
        duration: 800,
        onComplete: () => text.destroy(),
      });
    }
  }

  private createVisual(snap: EntitySnapshot): EntityVisual {
    let sprite: Phaser.GameObjects.Image;
    let label: Phaser.GameObjects.Text | null = null;
    switch (snap.kind) {
      case "player": {
        sprite = this.scene.add.image(0, 0, "players", atlas.players.peer).setOrigin(0.5, 0.85);
        label = this.scene.add
          .text(0, 0, snap.name ?? "?", { fontSize: "12px", color: "#c8ecf7" })
          .setOrigin(0.5, 1)
          .setDepth(4); // above the wall-cap layer
        break;
      }
      case "enemy": {
        const spriteName = snap.defId ? content.enemies.get(snap.defId)?.sprite : undefined;
        const frame = spriteName
          ? ((atlas.enemies as Record<string, number>)[spriteName] ?? 0)
          : 0;
        sprite = this.scene.add.image(0, 0, "enemies", frame).setOrigin(0.5, 0.85);
        break;
      }
      case "item": {
        sprite = this.scene.add.image(0, 0, this.itemTexture(snap.defId ?? "?")).setOrigin(0.5, 0.7);
        break;
      }
      case "projectile":
      default: {
        sprite = this.scene.add
          .image(0, 0, this.itemTexture(snap.defId ?? "spit"))
          .setOrigin(0.5, 0.5)
          .setScale(0.6);
        break;
      }
    }
    sprite.setDepth(2);
    const small = snap.kind === "item" || snap.kind === "projectile";
    const shadow = this.scene.add
      .ellipse(0, 0, small ? 18 : 34, small ? 9 : 16, 0x000000, 0.35)
      .setDepth(1);
    return { sprite, shadow, label };
  }

  /** Item icons are generated (REPLACE-LATER art): tinted disc + initial. */
  private itemTexture(defId: string): string {
    const key = `item-${defId}`;
    if (this.scene.textures.exists(key)) return key;
    const canvas = this.scene.textures.createCanvas(key, 28, 28)!;
    const ctx = canvas.getContext();
    const hue = hashString(defId) % 360;
    ctx.fillStyle = `hsl(${hue}, 45%, 42%)`;
    ctx.beginPath();
    ctx.arc(14, 14, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0d0a12";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#f4efe4";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((content.items.get(defId)?.name ?? defId).charAt(0).toUpperCase(), 14, 15);
    canvas.refresh();
    return key;
  }
}

function entityScreenPos(conn: Connection, id: string): { x: number; y: number } | null {
  if (id === conn.welcome?.playerId) {
    return { x: conn.body!.x * TILE_PX, y: conn.body!.y * TILE_PX };
  }
  const remote = conn.entities.get(id);
  if (!remote) return null;
  return { x: remote.snap.x * TILE_PX, y: remote.snap.y * TILE_PX };
}

/** Status-driven sprite tint (first match wins). */
function statusTint(fx: readonly string[]): number {
  if (fx.includes("on-fire")) return 0xffa066;
  if (fx.includes("poisoned")) return 0xa8e08a;
  if (fx.includes("wet")) return 0x9ec4ff;
  if (fx.includes("slowed")) return 0xc0b8d8;
  return 0xffffff;
}
