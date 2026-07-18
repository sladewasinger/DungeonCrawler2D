import { content } from "@dc2d/content";
import {
  GRAVITY,
  MAX_THROW_RANGE,
  MELEE_RANGE,
  THROW_SPEED,
  TILE,
  type EnemyAnimationState,
  type EntitySnapshot,
} from "@dc2d/engine";
import Phaser from "phaser";
import type { ThrowPreview } from "../input/controller";
import type { Connection } from "../net/connection";
import atlas from "./atlas.json";
import { CombatParticles } from "./combatParticles";
import {
  AIM_PREVIEW_DEPTH,
  SELF_GHOST_DEPTH,
  WALL_TOP_ENTITY_DEPTH,
  WORLD_OVERLAY_DEPTH,
  entityDepth,
} from "./depth";
import {
  ITEM_METRICS,
  PLAYER_METRICS,
  PROJECTILE_METRICS,
  enemyMetrics,
  type SpriteMetrics,
} from "./entityMetrics";
import { enemyTextureKey } from "./enemySprites";
import { itemTextureKey } from "./itemSprites";
import {
  playerDirection,
  playerFrame,
  type PlayerAnimationState,
  type PlayerDirection,
  type PlayerPalette,
} from "./playerSprites";
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
  kind: EntitySnapshot["kind"];
  defId?: string;
  metrics: SpriteMetrics;
  phase: number;
  lastX?: number;
  lastY?: number;
  moving?: boolean;
  animationState?: EnemyAnimationState;
  animationStartedAt?: number;
  aimX?: number;
  aimY?: number;
  faceX?: number;
  faceY?: number;
  lastZ?: number;
  playerDirection?: PlayerDirection;
  playerState?: PlayerAnimationState;
  wasAirborne?: boolean;
  landUntil?: number;
  attackUntil?: number;
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
  private readonly heldWeapon: Phaser.GameObjects.Image;
  private readonly barGfx: Phaser.GameObjects.Graphics;
  private readonly hoverTip: Phaser.GameObjects.Text;
  private readonly throwArc: Phaser.GameObjects.Graphics;
  private readonly particles: CombatParticles;
  private lastFrameAt = 0;
  private frameDt = 1 / 60;

  constructor(private readonly scene: Phaser.Scene) {
    this.particles = new CombatParticles(scene);
    this.selfVisual = {
      shadow: scene
        .add.ellipse(0, 0, PLAYER_METRICS.shadowWidth, PLAYER_METRICS.shadowHeight, 0x000000, 0.4)
        .setDepth(entityDepth(0, 0, -0.002)),
      sprite: scene.add
        .image(0, 0, "players", playerFrame("self", "south", "idle"))
        .setOrigin(PLAYER_METRICS.originX, PLAYER_METRICS.originY)
        .setDisplaySize(PLAYER_METRICS.width, PLAYER_METRICS.height)
        .setDepth(entityDepth(0, 0)),
      label: null,
      kind: "player",
      metrics: PLAYER_METRICS,
      phase: 0,
      playerDirection: "south",
      playerState: "idle",
    };
    // Silhouette ghost above the wall-cap layer: walls two tiles tall
    // hide a player standing right behind them completely — the ghost
    // keeps you located while occluded, invisible otherwise.
    this.selfGhost = scene.add
      .image(0, 0, "players", playerFrame("self", "south", "idle"))
      .setOrigin(PLAYER_METRICS.originX, PLAYER_METRICS.originY)
      .setDisplaySize(PLAYER_METRICS.width, PLAYER_METRICS.height)
      .setDepth(SELF_GHOST_DEPTH)
      .setAlpha(0.3)
      .setVisible(false);
    this.heldWeapon = scene.add
      .image(0, 0, "item-rag")
      .setOrigin(0.28, 0.72)
      .setDisplaySize(38, 38)
      .setDepth(2.2)
      .setVisible(false);
    this.barGfx = scene.add.graphics().setDepth(WORLD_OVERLAY_DEPTH);
    this.throwArc = scene.add.graphics().setDepth(AIM_PREVIEW_DEPTH);
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
  private elevate(visual: EntityVisual, z: number, terrain: number, airborne: boolean): { body: number; ground: number } {
    const rate = airborne ? ELEV_EASE_RATE : 28;
    const k = 1 - Math.exp(-this.frameDt * rate);
    const chase = (cur: number | undefined, target: number): number =>
      cur === undefined ? target : cur + (target - cur) * k;
    visual.groundPx = chase(visual.groundPx, terrain * Z_PX);
    visual.elevPx = airborne ? chase(visual.elevPx, z * Z_PX) : visual.groundPx;
    return { body: visual.elevPx, ground: visual.groundPx };
  }

  renderSelf(conn: Connection, x: number, y: number, z: number): void {
    const world = conn.world!;
    const body = conn.body!;
    const now = performance.now();
    this.frameDt = Math.min(0.1, (now - this.lastFrameAt) / 1000) || 1 / 60;
    this.lastFrameAt = now;
    const sx = x * TILE_PX;
    const sy = y * TILE_PX;
    // z is honest everywhere now — grounded z rides the stair ramps
    // physically (World.groundAt), airborne z is the jump arc. The
    // shadow tracks the ground under the body.
    const terrain = world.groundAt(x, y);
    const airborne = !body.grounded;
    const elev = this.elevate(this.selfVisual, z, terrain, airborne);
    this.selfVisual.shadow.setPosition(sx, sy - elev.ground);
    this.selfVisual.shadow.setScale(1 - Math.min(0.35, (elev.body - elev.ground) / 400));
    const bob = this.motionOffset(this.selfVisual, x, y, now);
    this.selfVisual.sprite.setPosition(sx, sy - elev.body + bob);
    this.selfVisual.sprite.setTint(statusTint(conn.fx));
    this.selfVisual.sprite.setAlpha(conn.downed ? 0.5 : 1);
    const overWall = world.tileAt(Math.floor(x), Math.floor(y)) === TILE.Wall;
    const spriteDepth = overWall ? WALL_TOP_ENTITY_DEPTH : entityDepth(y, z, 0.001);
    this.selfVisual.sprite.setDepth(spriteDepth);
    this.selfVisual.shadow.setDepth(overWall ? WALL_TOP_ENTITY_DEPTH - 0.01 : entityDepth(y, terrain, -0.002));
    const cursor = this.scene.cameras.main.getWorldPoint(
      this.scene.input.activePointer.x,
      this.scene.input.activePointer.y,
    );
    const angle = Math.atan2(cursor.y - this.selfVisual.sprite.y, cursor.x - this.selfVisual.sprite.x);
    const hasWeapon = conn.weapon !== null && !conn.downed;
    if (hasWeapon) {
      this.selfVisual.faceX = Math.cos(angle);
      this.selfVisual.faceY = Math.sin(angle);
    }
    this.updatePlayerPresentation(
      this.selfVisual,
      "self",
      now,
      airborne,
      body.zVel,
      conn.downed,
    );
    this.selfGhost.setFrame(this.selfVisual.sprite.frame.name);
    this.heldWeapon.setVisible(hasWeapon);
    if (hasWeapon && conn.weapon) {
      this.heldWeapon
        .setTexture(itemTextureKey(conn.weapon))
        .setPosition(
          this.selfVisual.sprite.x + Math.cos(angle) * 11,
          this.selfVisual.sprite.y + Math.sin(angle) * 11,
        )
        .setRotation(angle + Math.PI / 4)
        .setDepth(overWall ? WALL_TOP_ENTITY_DEPTH + 0.01 : entityDepth(y, z, 0.003));
    }
    const occluded = !overWall && terrainOccludes(world, x, y, z);
    this.selfGhost.setVisible(occluded);
    if (occluded) this.selfGhost.setPosition(this.selfVisual.sprite.x, this.selfVisual.sprite.y);

    if (this.selfVisual.wasAirborne !== undefined) {
      if (!this.selfVisual.wasAirborne && airborne) {
        this.particles.takeoff(sx, sy - elev.ground, entityDepth(y, terrain, 0.004));
      } else if (this.selfVisual.wasAirborne && !airborne) {
        this.selfVisual.landUntil = now + 140;
        this.particles.landing(sx, sy - elev.ground, entityDepth(y, terrain, 0.004));
      }
    }
    this.selfVisual.wasAirborne = airborne;
  }

  renderRemotes(conn: Connection): void {
    const world = conn.world!;
    const now = performance.now();
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
      const terrain = world.groundAt(x, y);
      const airborne = snap.air === true;
      const previousZ = visual.lastZ ?? z;
      const verticalVelocity = (z - previousZ) / Math.max(this.frameDt, 1 / 120);
      visual.lastZ = z;
      const elev = this.elevate(visual, z, terrain, airborne);
      visual.shadow.setPosition(px, py - elev.ground);
      visual.shadow.setScale(1 - Math.min(0.35, (elev.body - elev.ground) / 400));
      const bob = this.motionOffset(visual, x, y, now);
      visual.sprite.setPosition(px, py - elev.body + bob);
      if (visual.kind === "enemy") {
        visual.aimX = snap.aimX;
        visual.aimY = snap.aimY;
        const state = snap.anim ?? (visual.moving ? "walk" : "idle");
        if (visual.animationState !== state) {
          visual.animationState = state;
          visual.animationStartedAt = now;
          if (state === "spit" && visual.defId === "spitter") {
            this.spawnSpitMuzzle(visual.sprite.x, visual.sprite.y, visual.aimX, visual.aimY);
          }
        }
        const frame = enemyAnimationFrame(visual, now);
        visual.sprite.setTexture(enemyTextureKey(visual.defId ?? "slime", state, frame));
        this.applyEnemyPose(visual, state, now);
      }
      if (visual.kind === "player" || visual.kind === "enemy") {
        visual.faceX = snap.aimX ?? snap.faceX ?? visual.faceX;
        visual.faceY = snap.aimY ?? snap.faceY ?? visual.faceY;
      }
      if (visual.kind === "player") {
        if (snap.anim === "attack") visual.attackUntil = Math.max(visual.attackUntil ?? 0, now + 90);
        if (visual.wasAirborne && !airborne) visual.landUntil = now + 140;
        this.updatePlayerPresentation(visual, "peer", now, airborne, verticalVelocity, snap.downed ?? false);
        visual.wasAirborne = airborne;
      } else if (visual.kind === "enemy" && visual.faceX !== undefined) {
        visual.sprite.setFlipX(visual.faceX < 0);
      }
      if (visual.kind === "projectile") visual.sprite.setRotation(now / 100);
      visual.sprite.setTint(statusTint(snap.fx ?? []));
      visual.sprite.setAlpha(snap.downed ? 0.5 : 1);
      visual.label?.setPosition(px, py - elev.body + bob - visual.metrics.labelOffsetY);
      const overWall = world.tileAt(Math.floor(x), Math.floor(y)) === TILE.Wall;
      const spriteDepth = overWall ? WALL_TOP_ENTITY_DEPTH : entityDepth(y, z, 0.001);
      visual.sprite.setDepth(spriteDepth);
      visual.shadow.setDepth(overWall ? WALL_TOP_ENTITY_DEPTH - 0.01 : entityDepth(y, terrain, -0.002));

      if (snap.hp !== undefined && snap.maxHp !== undefined && snap.hp < snap.maxHp) {
        const frac = Math.max(0, snap.hp / snap.maxHp);
        const barY = py - elev.body - visual.metrics.healthOffsetY;
        this.barGfx.fillStyle(0x0d0a12, 0.8).fillRect(px - 20, barY, 40, 5);
        this.barGfx
          .fillStyle(frac > 0.35 ? 0x6fce62 : 0xd8574d, 1)
          .fillRect(px - 19, barY + 1, 38 * frac, 3);
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

  renderThrowPreview(conn: Connection, preview: ThrowPreview | null): void {
    const g = this.throwArc;
    g.clear();
    if (!preview || !conn.body || !conn.world) return;
    const from = conn.body;
    let dx = preview.targetX - from.x;
    let dy = preview.targetY - from.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return;
    const range = Math.min(distance, MAX_THROW_RANGE);
    dx = (dx / distance) * range;
    dy = (dy / distance) * range;
    const targetX = from.x + dx;
    const targetY = from.y + dy;
    const fromZ = from.z + 1;
    const targetZ = conn.world.groundAt(targetX, targetY);
    const duration = range / THROW_SPEED;
    const vx = dx / duration;
    const vy = dy / duration;
    const vz = (targetZ - fromZ + (GRAVITY / 2) * duration * duration) / duration;
    const steps = Math.max(10, Math.ceil(duration * 30));
    let previousX = from.x * TILE_PX;
    let previousY = from.y * TILE_PX - fromZ * Z_PX;
    g.lineStyle(2, 0xffe9b0, 0.9);
    for (let step = 1; step <= steps; step++) {
      const time = (duration * step) / steps;
      const x = from.x + vx * time;
      const y = from.y + vy * time;
      const z = fromZ + vz * time - (GRAVITY / 2) * time * time;
      const px = x * TILE_PX;
      const py = y * TILE_PX - z * Z_PX;
      g.lineBetween(previousX, previousY, px, py);
      previousX = px;
      previousY = py;
    }
    g.fillStyle(0xffe9b0, 0.22).fillCircle(targetX * TILE_PX, targetY * TILE_PX - targetZ * Z_PX, 13);
    g.lineStyle(2, 0xffe9b0, 0.95).strokeCircle(targetX * TILE_PX, targetY * TILE_PX - targetZ * Z_PX, 13);
  }

  /** Cosmetic melee swing arc — attacking must feel like something, hit or miss. */
  showSwing(conn: Connection, dx: number, dy: number): void {
    this.selfVisual.attackUntil = performance.now() + 170;
    const len = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy / len, dx / len);
    const px = this.selfVisual.sprite.x;
    const py = this.selfVisual.sprite.y;
    const stabbing = conn.weapon === "knife";
    const radius = MELEE_RANGE * TILE_PX * 0.9;
    if (conn.weapon) {
      const weapon = this.scene.add
        .image(
          px + Math.cos(angle) * (stabbing ? 2 : 16),
          py + Math.sin(angle) * (stabbing ? 2 : 16),
          itemTextureKey(conn.weapon),
        )
        .setOrigin(stabbing ? 0.18 : 0.3, 0.7)
        .setDisplaySize(68, 68)
        .setDepth(5)
        .setRotation(angle + Math.PI / 4);
      this.scene.tweens.add({
        targets: weapon,
        x: px + Math.cos(angle) * 76,
        y: py + Math.sin(angle) * 76,
        rotation: angle + Math.PI / 4 + (stabbing ? 0.08 : 0.45),
        alpha: 0,
        duration: stabbing ? 100 : 150,
        ease: stabbing ? "Expo.Out" : "Quad.Out",
        onComplete: () => weapon.destroy(),
      });
    }
    const g = this.scene.add.graphics().setDepth(4);
    if (stabbing) {
      g.lineStyle(4, 0xfff6d8, 0.95);
      g.lineBetween(
        px + Math.cos(angle) * 12,
        py + Math.sin(angle) * 12,
        px + Math.cos(angle) * radius,
        py + Math.sin(angle) * radius,
      );
      this.scene.tweens.add({ targets: g, alpha: 0, duration: 100, onComplete: () => g.destroy() });
      return;
    }
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
      const pos = entityScreenPos(conn, event.id);
      if (!pos) continue;
      if (event.t === "death") {
        this.particles.impact(pos.x, pos.y - 24, 0xffd36b, 16);
        this.spawnFeedbackText(pos.x, pos.y - 50, "DEFEATED", "#ffe9b0", 950);
        continue;
      }
      if (event.t === "status") {
        const statusName = content.statuses.get(event.status)?.name ?? event.status;
        const color = event.on ? "#ffcc70" : "#8fe08a";
        this.particles.status(pos.x, pos.y - 24, event.on ? 0xffcc70 : 0x8fe08a);
        this.spawnFeedbackText(pos.x, pos.y - 50, `${event.on ? "+" : "-"}${statusName}`, color, 700);
        continue;
      }
      this.particles.impact(pos.x, pos.y - 24, event.amount < 0 ? 0xff7a66 : 0x8fe08a, 11);
      this.spawnFeedbackText(
        pos.x,
        pos.y - 50,
        `${event.amount > 0 ? "+" : ""}${Math.round(event.amount)}`,
        event.amount < 0 ? "#ff7a66" : "#8fe08a",
        800,
      );
    }
  }

  private spawnFeedbackText(x: number, y: number, value: string, color: string, duration: number): void {
    const text = this.scene.add
      .text(x, y, value, {
        fontSize: "14px",
        color,
        fontStyle: "bold",
      })
      .setOrigin(0.5, 1)
      .setDepth(50);
    this.scene.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration,
      onComplete: () => text.destroy(),
    });
  }

  private createVisual(snap: EntitySnapshot): EntityVisual {
    let sprite: Phaser.GameObjects.Image;
    let label: Phaser.GameObjects.Text | null = null;
    let metrics: SpriteMetrics;
    switch (snap.kind) {
      case "player": {
        metrics = PLAYER_METRICS;
        sprite = this.scene.add
          .image(0, 0, "players", playerFrame("peer", "south", "idle"))
          .setOrigin(metrics.originX, metrics.originY)
          .setDisplaySize(metrics.width, metrics.height);
        label = this.scene.add
          .text(0, 0, snap.name ?? "?", { fontSize: "12px", color: "#c8ecf7" })
          .setOrigin(0.5, 1)
          .setDepth(4); // above the wall-cap layer
        break;
      }
      case "enemy": {
        metrics = enemyMetrics(snap.defId);
        sprite = this.scene.add
          .image(0, 0, enemyTextureKey(snap.defId ?? "slime", snap.anim ?? "idle", 0))
          .setOrigin(metrics.originX, metrics.originY)
          .setDisplaySize(metrics.width, metrics.height);
        break;
      }
      case "item": {
        metrics = ITEM_METRICS;
        sprite = this.scene.add
          .image(0, 0, itemTextureKey(snap.defId ?? ""))
          .setOrigin(metrics.originX, metrics.originY)
          .setDisplaySize(metrics.width, metrics.height);
        break;
      }
      case "projectile":
      default: {
        metrics = PROJECTILE_METRICS;
        sprite = snap.defId
          ? this.scene.add
              .image(0, 0, itemTextureKey(snap.defId))
              .setOrigin(metrics.originX, metrics.originY)
              .setDisplaySize(metrics.width, metrics.height)
          : this.scene.add
              .image(0, 0, "tiles", atlas.frames.areas.poison)
              .setOrigin(metrics.originX, metrics.originY)
              .setDisplaySize(metrics.width, metrics.height);
        break;
      }
    }
    sprite.setDepth(entityDepth(snap.y, snap.z, 0.001));
    const shadow = this.scene.add
      .ellipse(0, 0, metrics.shadowWidth, metrics.shadowHeight, 0x000000, 0.35)
      .setDepth(entityDepth(snap.y, snap.z, -0.002));
    return {
      sprite,
      shadow,
      label,
      kind: snap.kind,
      defId: snap.defId,
      metrics,
      phase: phaseFromId(snap.id),
      ...(snap.kind === "enemy"
        ? { animationState: snap.anim ?? "idle", animationStartedAt: performance.now() }
        : {}),
      ...(snap.kind === "player" ? { playerDirection: "south" as const, playerState: "idle" as const } : {}),
    };
  }

  private motionOffset(visual: EntityVisual, x: number, y: number, now: number): number {
    const dx = visual.lastX === undefined ? 0 : x - visual.lastX;
    const dy = visual.lastY === undefined ? 0 : y - visual.lastY;
    const moved = Math.hypot(dx, dy) > 0.001;
    if (moved) {
      const length = Math.hypot(dx, dy);
      visual.faceX = dx / length;
      visual.faceY = dy / length;
    }
    visual.lastX = x;
    visual.lastY = y;
    visual.moving = moved;
    if (visual.kind === "item") return Math.sin(now / 240 + visual.phase) * 1.5;
    return 0;
  }

  private applyEnemyPose(visual: EntityVisual, state: EnemyAnimationState, now: number): void {
    let scaleX = 1;
    let scaleY = 1;
    if (state === "attack") {
      const pulse = 0.1 + Math.sin(now / 55 + visual.phase) * 0.04;
      scaleX += pulse;
      scaleY -= pulse * 0.7;
    } else if (state === "windup") {
      scaleX = 0.92;
      scaleY = 1.08;
    }
    visual.sprite.setDisplaySize(visual.metrics.width * scaleX, visual.metrics.height * scaleY);
  }

  private updatePlayerPresentation(
    visual: EntityVisual,
    palette: PlayerPalette,
    now: number,
    airborne: boolean,
    verticalVelocity: number,
    downed: boolean,
  ): void {
    const direction = playerDirection(
      visual.faceX ?? 0,
      visual.faceY ?? 0,
      visual.playerDirection ?? "south",
    );
    visual.playerDirection = direction;
    let state: PlayerAnimationState;
    if (downed) state = "downed";
    else if ((visual.attackUntil ?? 0) > now) state = "attack";
    else if (airborne) state = verticalVelocity >= 0 ? "jump" : "fall";
    else if ((visual.landUntil ?? 0) > now) state = "land";
    else state = visual.moving ? "walk" : "idle";
    visual.playerState = state;
    visual.sprite.setFrame(playerFrame(palette, direction, state, now, visual.phase));
    visual.sprite.setRotation(0);
  }

  private spawnSpitMuzzle(x: number, y: number, aimX: number | undefined, aimY: number | undefined): void {
    const length = Math.hypot(aimX ?? 0, aimY ?? 0) || 1;
    const dx = (aimX ?? 0) / length;
    const dy = (aimY ?? 1) / length;
    const mouthX = x + dx * 12;
    const mouthY = y - 14 + dy * 8;
    this.particles.launch(mouthX, mouthY, dx, dy);
  }

}

function enemyAnimationFrame(visual: EntityVisual, now: number): number {
  const state = visual.animationState ?? "idle";
  const elapsed = now - (visual.animationStartedAt ?? now);
  if (state === "walk") return Math.floor(now / 105 + visual.phase);
  if (state === "idle") return Math.floor(now / 340 + visual.phase);
  if (state === "windup") return Math.min(1, Math.floor(elapsed / 110));
  if (state === "recover") return Math.min(1, Math.floor(elapsed / 85));
  if (state === "attack") return 2;
  return 0;
}

function phaseFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return (hash & 0xffff) / 0xffff * Math.PI * 2;
}

function terrainOccludes(world: NonNullable<Connection["world"]>, x: number, y: number, z: number): boolean {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  const southTile = world.tileAt(tileX, tileY + 1);
  const southHeight = world.heightAt(tileX, tileY + 1);
  return southTile === TILE.Wall || southHeight > z + 0.5;
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
