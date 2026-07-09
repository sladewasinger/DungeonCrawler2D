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
}

export class EntityRenderer {
  private readonly visuals = new Map<string, EntityVisual>();
  private readonly selfVisual: EntityVisual;
  private readonly barGfx: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    this.selfVisual = {
      shadow: scene.add.ellipse(0, 0, 34, 16, 0x000000, 0.4).setDepth(1),
      sprite: scene.add.image(0, 0, "players", atlas.players.self).setOrigin(0.5, 0.85).setDepth(2),
      label: null,
    };
    this.barGfx = scene.add.graphics().setDepth(4);
  }

  renderSelf(conn: Connection, x: number, y: number, z: number): void {
    const world = conn.world!;
    const sx = x * TILE_PX;
    const sy = y * TILE_PX;
    // Grounded = planted on the shadow, always. Interpolated z crosses
    // tile-height steps mid-walk, and lifting by that difference made
    // stair climbs read as hops.
    const lift = conn.body!.grounded
      ? 0
      : Math.max(0, z - world.heightAt(Math.floor(x), Math.floor(y))) * Z_PX;
    this.selfVisual.shadow.setPosition(sx, sy);
    this.selfVisual.shadow.setScale(1 - Math.min(0.35, lift / 400));
    this.selfVisual.sprite.setPosition(sx, sy - lift);
    this.selfVisual.sprite.setTint(statusTint(conn.fx));
    this.selfVisual.sprite.setAlpha(conn.downed ? 0.5 : 1);
    // On a wall top (or jumping over one) you render above the wall-cap
    // layer; on the ground you render below it (half-hidden behind walls).
    const overWall = world.tileAt(Math.floor(x), Math.floor(y)) === TILE.Wall;
    this.selfVisual.sprite.setDepth(overWall ? 3.5 : 2);
    this.selfVisual.shadow.setDepth(overWall ? 3.4 : 1);
  }

  renderRemotes(conn: Connection): void {
    const world = conn.world!;
    this.barGfx.clear();
    const seen = new Set<string>();

    for (const { id, snap, x, y, z } of conn.interpolated(RENDER_DELAY_MS)) {
      seen.add(id);
      let visual = this.visuals.get(id);
      if (!visual) {
        visual = this.createVisual(snap);
        this.visuals.set(id, visual);
      }
      const px = x * TILE_PX;
      const py = y * TILE_PX;
      // Only airborne entities lift off their shadow (see renderSelf).
      const lift = snap.air
        ? Math.max(0, z - world.heightAt(Math.floor(x), Math.floor(y))) * Z_PX
        : 0;
      visual.shadow.setPosition(px, py);
      visual.sprite.setPosition(px, py - lift);
      visual.sprite.setTint(statusTint(snap.fx ?? []));
      visual.sprite.setAlpha(snap.downed ? 0.5 : 1);
      visual.label?.setPosition(px, py - lift - 44);
      const overWall = world.tileAt(Math.floor(x), Math.floor(y)) === TILE.Wall;
      visual.sprite.setDepth(overWall ? 3.5 : 2);
      visual.shadow.setDepth(overWall ? 3.4 : 1);

      if (snap.hp !== undefined && snap.maxHp !== undefined && snap.hp < snap.maxHp) {
        const frac = Math.max(0, snap.hp / snap.maxHp);
        this.barGfx.fillStyle(0x0d0a12, 0.8).fillRect(px - 20, py - lift - 40, 40, 5);
        this.barGfx
          .fillStyle(frac > 0.35 ? 0x6fce62 : 0xd8574d, 1)
          .fillRect(px - 19, py - lift - 39, 38 * frac, 3);
      }
    }

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
