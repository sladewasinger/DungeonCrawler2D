import { content } from "@dc2d/content";
import {
  CHUNK_SIZE,
  MELEE_RANGE,
  PICKUP_RANGE,
  STEP_UP,
  TICK_RATE,
  TILE,
  ZONE,
  customArtAt,
  getCustomMap,
  hash2D,
  hashString,
  type EntitySnapshot,
  type MoveInput,
  type World,
} from "@dc2d/engine";
import Phaser from "phaser";
import type { Connection } from "../net/connection";
import atlas from "../render/atlas.json";
import { frameForTile } from "../render/tileframes";
import { Hud } from "../ui/hud";

/**
 * Renders the shared world from the baked atlas and everything the
 * server replicates: terrain (tilemap layers + tint height shading),
 * area effects, entities of every kind, HUD widgets, and the contextual
 * prompts/panels for doors, crafting, stash, and parties. Input maps
 * to intents — the server decides what actually happens.
 */

const TILE_PX = atlas.tileSize;
const CHUNK_PX = CHUNK_SIZE * TILE_PX;
const Z_PX = 48;
const RENDER_DELAY_MS = 120;
const CHUNK_VIEW_RADIUS = 1;

interface EntityVisual {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text | null;
}

export class DungeonScene extends Phaser.Scene {
  private chunkMaps = new Map<string, Phaser.Tilemaps.Tilemap>();
  private visuals = new Map<string, EntityVisual>();
  private areaImages = new Map<string, Phaser.GameObjects.Image>();
  private selfVisual!: EntityVisual;
  private hud!: Hud;
  private barGfx!: Phaser.GameObjects.Graphics;
  private borderGraphics!: Phaser.GameObjects.Graphics;
  private showBorders = false;
  private accumulatorMs = 0;
  /** Body position before the latest fixed step — render interpolation. */
  private prevStep: { x: number; y: number; z: number } | null = null;
  private camX = 0;
  private camY = 0;
  private camSnap = true;
  private craftPanelOpen = false;
  private stashPanelOpen = false;
  private keys!: Record<
    "W" | "A" | "S" | "D" | "SPACE" | "G" | "E" | "R" | "C" | "F" | "Q" | "ESC",
    Phaser.Input.Keyboard.Key
  >;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(private readonly conn: Connection) {
    super("dungeon");
  }

  preload(): void {
    this.load.spritesheet("tiles", "assets/tiles.png", { frameWidth: TILE_PX, frameHeight: TILE_PX });
    this.load.spritesheet("players", "assets/players.png", { frameWidth: TILE_PX, frameHeight: TILE_PX });
    this.load.spritesheet("enemies", "assets/enemies.png", { frameWidth: TILE_PX, frameHeight: TILE_PX });
    this.load.image("packsheet", `assets/${atlas.packSheet.image}`);
  }

  create(): void {
    const keyboard = this.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys("W,A,S,D,SPACE,G,E,R,C,F,Q,ESC") as DungeonScene["keys"];

    this.keys.G.on("down", () => {
      this.showBorders = !this.showBorders;
      this.borderGraphics.setVisible(this.showBorders);
    });
    this.keys.E.on("down", () => {
      if (this.stashNearby() && !this.stashPanelOpen) this.stashPanelOpen = true;
      this.conn.interact();
    });
    this.keys.R.on("down", () => this.conn.pickup());
    this.keys.C.on("down", () => {
      this.craftPanelOpen = !this.craftPanelOpen && this.tableNearby();
    });
    this.keys.Q.on("down", () => this.conn.drop(this.conn.selectedSlot));
    this.keys.F.on("down", () => {
      if (this.conn.pendingInvite) {
        this.conn.partyOp("accept");
        return;
      }
      const nearest = this.nearestPlayer(6);
      if (nearest) this.conn.partyOp("invite", nearest.id);
    });
    this.keys.ESC.on("down", () => {
      this.craftPanelOpen = false;
      this.stashPanelOpen = false;
      this.conn.stash = null;
    });
    for (let i = 1; i <= 9; i++) {
      keyboard.addKey(48 + i).on("down", () => this.onNumberKey(i));
    }

    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.conn.body) return;
      // Clicks on UI act on the UI — never swing through the hotbar.
      const uiHit = this.hud.hitTest(pointer.x, pointer.y);
      if (uiHit !== null) {
        if (uiHit.startsWith("slot:")) this.conn.selectSlot(Number(uiHit.slice(5)));
        return;
      }
      const wx = pointer.worldX / TILE_PX;
      const wy = pointer.worldY / TILE_PX;
      if (pointer.rightButtonDown()) {
        const slot = this.conn.inventory[this.conn.selectedSlot];
        const def = slot ? content.items.get(slot.item) : undefined;
        if (def?.throwable) this.conn.useSlot(this.conn.selectedSlot, wx, wy);
        else this.conn.useSlot(this.conn.selectedSlot);
      } else {
        const dx = wx - this.conn.body.x;
        const dy = wy - this.conn.body.y;
        this.conn.attack(dx, dy);
        this.showSwing(dx, dy);
      }
    });
    // Mouse wheel cycles the hotbar selection.
    this.input.on(
      "wheel",
      (_p: unknown, _o: unknown, _dx: number, dy: number) => {
        const dir = dy > 0 ? 1 : -1;
        this.conn.selectSlot((((this.conn.selectedSlot + dir) % 9) + 9) % 9);
      },
    );

    this.selfVisual = {
      shadow: this.add.ellipse(0, 0, 34, 16, 0x000000, 0.4).setDepth(1),
      sprite: this.add.image(0, 0, "players", atlas.players.self).setOrigin(0.5, 0.85).setDepth(2),
      label: null,
    };
    this.barGfx = this.add.graphics().setDepth(4);
    this.borderGraphics = this.add.graphics().setDepth(5).setVisible(false);
    this.hud = new Hud(this);
    this.cameras.main.setBackgroundColor("#0d0a12");
    this.cameras.main.setRoundPixels(true);
  }

  override update(_time: number, deltaMs: number): void {
    const { conn } = this;
    if (!conn.world || !conn.body || !conn.welcome) return;
    const world = conn.world;

    if (conn.teleported) {
      conn.teleported = false;
      for (const [key, map] of this.chunkMaps) {
        map.destroy();
        this.chunkMaps.delete(key);
      }
      this.prevStep = null;
      this.camSnap = true;
    }

    // Fixed-step input sampling; the pre-step position feeds render
    // interpolation so 20Hz prediction looks like 60fps motion.
    this.accumulatorMs += deltaMs;
    const stepMs = 1000 / TICK_RATE;
    while (this.accumulatorMs >= stepMs) {
      this.accumulatorMs -= stepMs;
      this.prevStep = { x: conn.body.x, y: conn.body.y, z: conn.body.z };
      conn.sampleInput(this.readInput());
    }

    // Range-gated panels close for real when you walk away — otherwise
    // the number keys stay hijacked by a dialog you can't see.
    if (this.craftPanelOpen && !this.tableNearby()) this.craftPanelOpen = false;
    if (this.stashPanelOpen && !this.stashNearby()) {
      this.stashPanelOpen = false;
      conn.stash = null;
    }

    const body = conn.body;
    const alpha = Math.min(1, this.accumulatorMs / stepMs);
    const prev = this.prevStep ?? body;
    const rx = prev.x + (body.x - prev.x) * alpha;
    const ry = prev.y + (body.y - prev.y) * alpha;
    const rz = prev.z + (body.z - prev.z) * alpha;

    this.ensureChunksAround(body.x, body.y);
    this.renderAreas();
    this.renderSelf(rx, ry, rz);
    this.renderEntities();
    this.spawnFloatingText();
    if (this.showBorders) this.drawChunkBorders(body.x, body.y);

    // Eased camera: snaps on teleport, otherwise glides after the player.
    const targetX = rx * TILE_PX;
    const targetY = ry * TILE_PX;
    if (this.camSnap) {
      this.camX = targetX;
      this.camY = targetY;
      this.camSnap = false;
    } else {
      const k = 1 - Math.exp((-deltaMs / 1000) * 10);
      this.camX += (targetX - this.camX) * k;
      this.camY += (targetY - this.camY) * k;
    }
    this.cameras.main.centerOn(this.camX, this.camY);
    this.hud.update(conn, this.contextPrompt(), this.panelContent(), this.debugContent());
  }

  // ── input helpers ────────────────────────────────────────────────

  private readInput(): MoveInput {
    const chatting = document.activeElement?.id === "chat-input";
    if (chatting || this.conn.downed) return { moveX: 0, moveY: 0, jump: false };
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up = this.cursors.up.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;
    return {
      moveX: (right ? 1 : 0) - (left ? 1 : 0),
      moveY: (down ? 1 : 0) - (up ? 1 : 0),
      jump: this.keys.SPACE.isDown || this.cursors.space.isDown,
    };
  }

  private onNumberKey(n: number): void {
    if (this.craftPanelOpen && this.tableNearby()) {
      const recipe = [...content.recipes.values()][n - 1];
      if (recipe) this.conn.craft(recipe.id);
      return;
    }
    if (this.stashPanelOpen && this.conn.stash && this.stashNearby()) {
      this.conn.stashOp("take", n - 1);
      return;
    }
    this.conn.selectSlot(n - 1);
  }

  private nearestPlayer(range: number): EntitySnapshot | null {
    const body = this.conn.body!;
    let best: EntitySnapshot | null = null;
    let bestDist = range;
    for (const { snap } of this.conn.entities.values()) {
      if (snap.kind !== "player") continue;
      const d = Math.hypot(snap.x - body.x, snap.y - body.y);
      if (d < bestDist) {
        bestDist = d;
        best = snap;
      }
    }
    return best;
  }

  // ── contextual UI ────────────────────────────────────────────────

  private tileUnderfoot(): number {
    const body = this.conn.body!;
    return this.conn.world!.tileAt(Math.floor(body.x), Math.floor(body.y));
  }

  private nearTile(tile: number): boolean {
    const body = this.conn.body!;
    const tx = Math.floor(body.x);
    const ty = Math.floor(body.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (this.conn.world!.tileAt(tx + dx, ty + dy) === tile) return true;
      }
    }
    return false;
  }

  private tableNearby(): boolean {
    return this.nearTile(TILE.CraftingTable);
  }

  private stashNearby(): boolean {
    return this.nearTile(TILE.Stash);
  }

  private itemNearby(): boolean {
    const body = this.conn.body!;
    for (const { snap } of this.conn.entities.values()) {
      if (snap.kind !== "item") continue;
      if (Math.hypot(snap.x - body.x, snap.y - body.y) <= PICKUP_RANGE) return true;
    }
    return false;
  }

  private downedAllyNearby(): boolean {
    const body = this.conn.body!;
    for (const { snap } of this.conn.entities.values()) {
      if (snap.kind === "player" && snap.downed) {
        if (Math.hypot(snap.x - body.x, snap.y - body.y) <= 1.6) return true;
      }
    }
    return false;
  }

  private contextPrompt(): string {
    if (this.conn.downed) return "You are downed — hold on for a revive…";
    const underfoot = this.tileUnderfoot();
    if (underfoot === TILE.DoorSafeRoom) return "[E] enter safe room";
    if (underfoot === TILE.DoorPersonal) return "[E] enter your room";
    if (underfoot === TILE.DoorParty) return "[E] enter party room";
    if (underfoot === TILE.DoorExit) return "[E] leave";
    if (this.downedAllyNearby()) return "[E] revive party member";
    const prompts: string[] = [];
    if (this.itemNearby()) prompts.push("[R] pick up");
    if (this.tableNearby()) prompts.push("[C] craft");
    if (this.stashNearby()) prompts.push("[E] stash");
    return prompts.join("   ");
  }

  private panelContent(): string | null {
    if (this.craftPanelOpen && this.tableNearby()) {
      const lines = ["CRAFTING — press a number, [Esc] closes"];
      let n = 1;
      for (const recipe of content.recipes.values()) {
        const inputs = recipe.inputs
          .map((i) => `${i.qty}× ${content.items.get(i.item)?.name ?? i.item}`)
          .join(" + ");
        const output = content.items.get(recipe.output.item)?.name ?? recipe.output.item;
        lines.push(`[${n}] ${output}   (${inputs})`);
        n++;
      }
      return lines.join("\n");
    }
    if (this.stashPanelOpen && this.conn.stash && this.stashNearby()) {
      const lines = ["STASH — number takes, [E] again refreshes, [Esc] closes"];
      this.conn.stash.forEach((entry, i) => {
        const name = content.items.get(entry.item)?.name ?? entry.item;
        lines.push(`[${i + 1}] ${name}${entry.qty > 1 ? ` ×${entry.qty}` : ""}`);
      });
      if (this.conn.stash.length === 0) lines.push("(empty)");
      lines.push("", "[P in hotbar → use Q to drop, or stash put via number+shift soon]");
      return lines.join("\n");
    }
    return null;
  }

  private debugContent(): string {
    const conn = this.conn;
    const body = conn.body!;
    return [
      `world ${conn.welcome!.worldSeed} floor ${conn.welcome!.floor}`,
      `pos ${body.x.toFixed(1)}, ${body.y.toFixed(1)}  z ${body.z.toFixed(2)}`,
      `ping ${conn.rttMs.toFixed(0)}ms  fps ${this.game.loop.actualFps.toFixed(0)}`,
      `[G] chunk grid  [F] fistbump/invite`,
    ].join("\n");
  }

  // ── rendering ────────────────────────────────────────────────────

  /** Cosmetic melee swing arc — attacking must feel like something, hit or miss. */
  private showSwing(dx: number, dy: number): void {
    const len = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy / len, dx / len);
    const px = this.selfVisual.sprite.x;
    const py = this.selfVisual.sprite.y;
    const radius = MELEE_RANGE * TILE_PX * 0.9;
    const g = this.add.graphics().setDepth(3);
    g.fillStyle(0xffe9b0, 0.35);
    g.slice(px, py, radius, angle - 0.55, angle + 0.55);
    g.fillPath();
    g.lineStyle(3, 0xfff6d8, 0.9);
    g.beginPath();
    g.arc(px, py, radius, angle - 0.55, angle + 0.55);
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 130, onComplete: () => g.destroy() });
  }

  private renderSelf(x: number, y: number, z: number): void {
    const conn = this.conn;
    const world = conn.world!;
    const sx = x * TILE_PX;
    const sy = y * TILE_PX;
    const lift = Math.max(0, z - world.heightAt(Math.floor(x), Math.floor(y))) * Z_PX;
    this.selfVisual.shadow.setPosition(sx, sy);
    this.selfVisual.shadow.setScale(1 - Math.min(0.35, lift / 400));
    this.selfVisual.sprite.setPosition(sx, sy - lift);
    this.selfVisual.sprite.setTint(statusTint(conn.fx));
    this.selfVisual.sprite.setAlpha(conn.downed ? 0.5 : 1);
  }

  private renderEntities(): void {
    const conn = this.conn;
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
      const lift = Math.max(0, z - world.heightAt(Math.floor(x), Math.floor(y))) * Z_PX;
      visual.shadow.setPosition(px, py);
      visual.sprite.setPosition(px, py - lift);
      visual.sprite.setTint(statusTint(snap.fx ?? []));
      visual.sprite.setAlpha(snap.downed ? 0.5 : 1);
      visual.label?.setPosition(px, py - lift - 44);

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

  private createVisual(snap: EntitySnapshot): EntityVisual {
    let sprite: Phaser.GameObjects.Image;
    let label: Phaser.GameObjects.Text | null = null;
    switch (snap.kind) {
      case "player": {
        sprite = this.add.image(0, 0, "players", atlas.players.peer).setOrigin(0.5, 0.85);
        label = this.add
          .text(0, 0, snap.name ?? "?", { fontSize: "12px", color: "#c8ecf7" })
          .setOrigin(0.5, 1)
          .setDepth(3);
        break;
      }
      case "enemy": {
        const spriteName = snap.defId ? content.enemies.get(snap.defId)?.sprite : undefined;
        const frame = spriteName
          ? ((atlas.enemies as Record<string, number>)[spriteName] ?? 0)
          : 0;
        sprite = this.add.image(0, 0, "enemies", frame).setOrigin(0.5, 0.85);
        break;
      }
      case "item": {
        sprite = this.add.image(0, 0, this.itemTexture(snap.defId ?? "?")).setOrigin(0.5, 0.7);
        break;
      }
      case "projectile":
      default: {
        sprite = this.add.image(0, 0, this.itemTexture(snap.defId ?? "spit")).setOrigin(0.5, 0.5).setScale(0.6);
        break;
      }
    }
    sprite.setDepth(2);
    const shadow = this.add
      .ellipse(0, 0, snap.kind === "item" || snap.kind === "projectile" ? 18 : 34, snap.kind === "item" || snap.kind === "projectile" ? 9 : 16, 0x000000, 0.35)
      .setDepth(1);
    return { sprite, shadow, label };
  }

  /** Item icons are generated (REPLACE-LATER art): tinted disc + initial. */
  private itemTexture(defId: string): string {
    const key = `item-${defId}`;
    if (this.textures.exists(key)) return key;
    const canvas = this.textures.createCanvas(key, 28, 28)!;
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

  private renderAreas(): void {
    const conn = this.conn;
    const live = conn.areaTiles;
    for (const [key, image] of this.areaImages) {
      if (!live.has(key)) {
        image.destroy();
        this.areaImages.delete(key);
      }
    }
    for (const [key, defId] of live) {
      const existing = this.areaImages.get(key);
      const spriteName = content.areas.get(defId)?.sprite ?? "steam";
      const frame = (atlas.frames.areas as Record<string, number>)[spriteName] ?? atlas.frames.areas.steam;
      if (existing) {
        if (existing.frame.name !== String(frame)) existing.setFrame(frame);
        continue;
      }
      const [x, y] = key.split(",").map(Number) as [number, number];
      const image = this.add
        .image(x * TILE_PX, y * TILE_PX, "tiles", frame)
        .setOrigin(0, 0)
        .setDepth(-5)
        .setAlpha(0.8);
      this.areaImages.set(key, image);
    }
  }

  private spawnFloatingText(): void {
    for (const event of this.conn.drainVisualEvents()) {
      if (event.t !== "hit") continue;
      const pos = this.entityScreenPos(event.id);
      if (!pos) continue;
      const text = this.add
        .text(pos.x, pos.y - 50, `${event.amount > 0 ? "+" : ""}${Math.round(event.amount)}`, {
          fontSize: "14px",
          color: event.amount < 0 ? "#ff7a66" : "#8fe08a",
          fontStyle: "bold",
        })
        .setOrigin(0.5, 1)
        .setDepth(50);
      this.tweens.add({
        targets: text,
        y: pos.y - 90,
        alpha: 0,
        duration: 800,
        onComplete: () => text.destroy(),
      });
    }
  }

  private entityScreenPos(id: string): { x: number; y: number } | null {
    if (id === this.conn.welcome?.playerId) {
      return { x: this.conn.body!.x * TILE_PX, y: this.conn.body!.y * TILE_PX };
    }
    const remote = this.conn.entities.get(id);
    if (!remote) return null;
    return { x: remote.snap.x * TILE_PX, y: remote.snap.y * TILE_PX };
  }

  // ── terrain (unchanged from Epic 1/2 apart from door/table tiles) ──

  private ensureChunksAround(x: number, y: number): void {
    const ccx = Math.floor(x / CHUNK_SIZE);
    const ccy = Math.floor(y / CHUNK_SIZE);
    for (let cy = ccy - CHUNK_VIEW_RADIUS; cy <= ccy + CHUNK_VIEW_RADIUS; cy++) {
      for (let cx = ccx - CHUNK_VIEW_RADIUS; cx <= ccx + CHUNK_VIEW_RADIUS; cx++) {
        const key = `${cx},${cy}`;
        if (this.chunkMaps.has(key)) continue;
        this.chunkMaps.set(key, this.buildChunkMap(cx, cy));
      }
    }
    for (const [key, map] of this.chunkMaps) {
      const [cx, cy] = key.split(",").map(Number) as [number, number];
      if (Math.max(Math.abs(cx - ccx), Math.abs(cy - ccy)) > CHUNK_VIEW_RADIUS + 1) {
        map.destroy();
        this.chunkMaps.delete(key);
      }
    }
  }

  private buildChunkMap(cx: number, cy: number): Phaser.Tilemaps.Tilemap {
    const world = this.conn.world!;
    const chunk = world.getChunk(cx, cy);
    const map = this.make.tilemap({
      tileWidth: TILE_PX,
      tileHeight: TILE_PX,
      width: CHUNK_SIZE,
      height: CHUNK_SIZE,
    });
    const tileset = map.addTilesetImage("tiles", "tiles", TILE_PX, TILE_PX, 0, 0)!;
    const ox = cx * CHUNK_PX;
    const oy = cy * CHUNK_PX;
    const base = map.createBlankLayer("base", tileset, ox, oy)!.setDepth(-10);
    const borders = map.createBlankLayer("borders", tileset, ox, oy)!.setDepth(-9.5);
    const overlay = map.createBlankLayer("overlay", tileset, ox, oy)!.setDepth(-9);
    // Tile Studio art overrides render verbatim above the autotiles.
    let custom: Phaser.Tilemaps.TilemapLayer | null = null;
    if (getCustomMap()?.art) {
      const packTileset = map.addTilesetImage("packsheet", "packsheet", TILE_PX, TILE_PX, 0, 0)!;
      custom = map.createBlankLayer("custom", packTileset, ox, oy)!.setDepth(-8.8);
    }

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wy = cy * CHUNK_SIZE + ly;
        const frames = frameForTile(world, wx, wy);

        const baseTile = base.putTileAt(frames.base, lx, ly);
        if (baseTile && frames.baseTintHeight !== null) {
          baseTile.tint = heightTint(frames.baseTintHeight);
        }
        if (frames.border >= 0) borders.putTileAt(frames.border, lx, ly);
        if (frames.overlay >= 0) {
          const overlayTile = overlay.putTileAt(frames.overlay, lx, ly);
          if (overlayTile && frames.overlayTintHeight !== null) {
            overlayTile.tint = heightTint(frames.overlayTintHeight);
          }
        }
        if (custom) {
          const art = customArtAt(wx, wy);
          if (art !== null) custom.putTileAt(art, lx, ly);
        }
      }
    }
    return map;
  }

  private drawChunkBorders(x: number, y: number): void {
    const g = this.borderGraphics;
    g.clear();
    g.lineStyle(2, 0x9fe8c9, 0.5);
    const ccx = Math.floor(x / CHUNK_SIZE);
    const ccy = Math.floor(y / CHUNK_SIZE);
    for (let cy = ccy - CHUNK_VIEW_RADIUS; cy <= ccy + CHUNK_VIEW_RADIUS; cy++) {
      for (let cx = ccx - CHUNK_VIEW_RADIUS; cx <= ccx + CHUNK_VIEW_RADIUS; cx++) {
        g.strokeRect(cx * CHUNK_PX, cy * CHUNK_PX, CHUNK_PX, CHUNK_PX);
      }
    }
  }
}

function heightTint(h: number): number {
  // Ground level renders at (near) full brightness so the white-brick
  // floor reads white; only depth darkens noticeably.
  const brightness = Math.max(0.5, Math.min(1, 0.95 + h * 0.035));
  const gray = Math.round(brightness * 255);
  return (gray << 16) | (gray << 8) | gray;
}

/** Status-driven sprite tint (first match wins). */
function statusTint(fx: readonly string[]): number {
  if (fx.includes("on-fire")) return 0xffa066;
  if (fx.includes("poisoned")) return 0xa8e08a;
  if (fx.includes("wet")) return 0x9ec4ff;
  if (fx.includes("slowed")) return 0xc0b8d8;
  return 0xffffff;
}
