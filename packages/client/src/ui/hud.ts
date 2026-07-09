import { content } from "@dc2d/content";
import Phaser from "phaser";
import type { Connection } from "../net/connection";
import { itemTextureKey } from "../render/itemSprites";

/**
 * The HUD widget foundation (GAME_DESIGN.md § Editable HUD): every
 * element is a registered widget positioned by a layout config. The
 * drag/resize editor arrives in v0.8 — but because everything already
 * renders from this registry, that editor will be UI over config, not
 * a rewrite. No fixed-position UI outside this file, ever.
 */

type Anchor = "tl" | "tr" | "bl" | "br" | "bc" | "tc";

interface WidgetLayout {
  anchor: Anchor;
  x: number;
  y: number;
  visible: boolean;
}

/** Default layout — per-user persistence lands with accounts (v0.8). */
const DEFAULT_LAYOUT: Record<string, WidgetLayout> = {
  health: { anchor: "tl", x: 12, y: 12, visible: true },
  status: { anchor: "tl", x: 12, y: 40, visible: true },
  hotbar: { anchor: "bc", x: 0, y: -14, visible: true },
  toasts: { anchor: "bl", x: 12, y: -64, visible: true },
  chat: { anchor: "bl", x: 12, y: -150, visible: true },
  party: { anchor: "tr", x: -12, y: 12, visible: true },
  prompt: { anchor: "bc", x: 0, y: -86, visible: true },
  panel: { anchor: "tc", x: 0, y: 90, visible: true },
  debug: { anchor: "tr", x: -12, y: 90, visible: true },
};

const SLOT_PX = 46;

export class Hud {
  private readonly widgets = new Map<string, Phaser.GameObjects.Container>();

  private healthBar!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private hotbarGfx!: Phaser.GameObjects.Graphics;
  private hotbarTexts: Phaser.GameObjects.Text[] = [];
  private hotbarIcons: Phaser.GameObjects.Image[] = [];
  private hotbarTip!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private chatText!: Phaser.GameObjects.Text;
  private partyText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private panelBg!: Phaser.GameObjects.Rectangle;
  private panelText!: Phaser.GameObjects.Text;
  private debugText!: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    this.register("health", (c) => {
      this.healthBar = scene.add.graphics();
      this.healthText = scene.add.text(4, 3, "", { fontSize: "12px", color: "#fff" });
      c.add([this.healthBar, this.healthText]);
    });
    this.register("status", (c) => {
      this.statusText = scene.add.text(0, 0, "", { fontSize: "12px", color: "#ffb997" });
      c.add(this.statusText);
    });
    this.register("hotbar", (c) => {
      this.hotbarGfx = scene.add.graphics();
      c.add(this.hotbarGfx);
      for (let i = 0; i < 9; i++) {
        const icon = scene.add
          .image(i * SLOT_PX - 4.5 * SLOT_PX + 21, -SLOT_PX + 20, "item-rag")
          .setDisplaySize(28, 28)
          .setVisible(false);
        const t = scene.add
          .text(i * SLOT_PX - 4.5 * SLOT_PX + 3, -SLOT_PX + 29, "", {
            fontSize: "8px",
            color: "#e8e4f0",
            align: "center",
          })
          .setWordWrapWidth(SLOT_PX - 8);
        t.setFixedSize(SLOT_PX - 8, SLOT_PX - 31);
        this.hotbarIcons.push(icon);
        this.hotbarTexts.push(t);
        c.add([icon, t]);
      }
      this.hotbarTip = scene.add
        .text(0, -SLOT_PX - 8, "", {
          fontSize: "11px",
          color: "#ffe9b0",
          backgroundColor: "#0d0a12e8",
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5, 1)
        .setVisible(false);
      c.add(this.hotbarTip);
    });
    this.register("toasts", (c) => {
      this.toastText = scene.add
        .text(0, 0, "", { fontSize: "12px", color: "#ffe9b0" })
        .setOrigin(0, 1);
      c.add(this.toastText);
    });
    this.register("chat", (c) => {
      this.chatText = scene.add
        .text(0, 0, "", { fontSize: "12px", color: "#c8ecf7" })
        .setOrigin(0, 1);
      c.add(this.chatText);
    });
    this.register("party", (c) => {
      this.partyText = scene.add
        .text(0, 0, "", { fontSize: "12px", color: "#9fe8c9", align: "right" })
        .setOrigin(1, 0);
      c.add(this.partyText);
    });
    this.register("prompt", (c) => {
      this.promptText = scene.add
        .text(0, 0, "", {
          fontSize: "13px",
          color: "#ffe9b0",
          backgroundColor: "#0d0a12d0",
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5, 1);
      c.add(this.promptText);
    });
    this.register("panel", (c) => {
      this.panelBg = scene.add
        .rectangle(0, 0, 380, 200, 0x0d0a12, 0.92)
        .setStrokeStyle(1, 0x9fe8c9, 0.6)
        .setOrigin(0.5, 0);
      this.panelText = scene.add
        .text(-176, 10, "", { fontSize: "13px", color: "#e8e4f0", lineSpacing: 4 })
        .setOrigin(0, 0);
      c.add([this.panelBg, this.panelText]);
      c.setVisible(false);
    });
    this.register("debug", (c) => {
      this.debugText = scene.add
        .text(0, 0, "", { fontSize: "11px", color: "#9fe8c9", align: "right" })
        .setOrigin(1, 0);
      c.add(this.debugText);
    });
  }

  private register(id: string, build: (c: Phaser.GameObjects.Container) => void): void {
    const layout = DEFAULT_LAYOUT[id]!;
    const container = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(100);
    build(container);
    container.setVisible(layout.visible);
    this.widgets.set(id, container);
    this.position(id, layout);
  }

  private position(id: string, layout: WidgetLayout): void {
    const { width, height } = this.scene.scale;
    const container = this.widgets.get(id)!;
    const x =
      layout.anchor === "tr" || layout.anchor === "br"
        ? width + layout.x
        : layout.anchor === "bc" || layout.anchor === "tc"
          ? width / 2 + layout.x
          : layout.x;
    const y = layout.anchor.startsWith("b") ? height + layout.y : layout.y;
    container.setPosition(x, y);
  }

  /**
   * What UI element is under this screen point? "slot:N" for hotbar
   * slots, "panel" for the modal panel, null for the game world —
   * clicks on UI must not swing weapons.
   */
  hitTest(screenX: number, screenY: number): string | null {
    const { width, height } = this.scene.scale;
    const hotbar = DEFAULT_LAYOUT.hotbar!;
    const hx = width / 2 + hotbar.x;
    const hy = height + hotbar.y;
    if (screenY >= hy - SLOT_PX && screenY <= hy - 4) {
      for (let i = 0; i < 9; i++) {
        const x0 = hx + i * SLOT_PX - 4.5 * SLOT_PX;
        if (screenX >= x0 && screenX <= x0 + SLOT_PX - 4) return `slot:${i}`;
      }
    }
    const panelContainer = this.widgets.get("panel")!;
    if (panelContainer.visible) {
      const px = width / 2 + DEFAULT_LAYOUT.panel!.x;
      const py = DEFAULT_LAYOUT.panel!.y;
      if (
        screenX >= px - 190 &&
        screenX <= px + 190 &&
        screenY >= py &&
        screenY <= py + this.panelBg.height
      ) {
        return "panel";
      }
    }
    return null;
  }

  // ── frame update ─────────────────────────────────────────────────

  update(
    conn: Connection,
    prompt: string,
    panel: string | null,
    debug: string,
    selectedThrowable: number | null,
  ): void {
    // Health.
    this.healthBar.clear();
    this.healthBar.fillStyle(0x1a1420, 1).fillRect(0, 0, 180, 18);
    const frac = conn.maxHp > 0 ? conn.hp / conn.maxHp : 0;
    this.healthBar
      .fillStyle(frac > 0.35 ? 0x6fce62 : 0xd8574d, 1)
      .fillRect(2, 2, 176 * Math.max(0, frac), 14);
    const weaponName = conn.weapon ? (content.items.get(conn.weapon)?.name ?? conn.weapon) : "Fists";
    this.healthText.setText(
      conn.downed
        ? `DOWNED — a party member can revive you`
        : `${Math.ceil(conn.hp)} / ${conn.maxHp}   ⚔ ${weaponName}`,
    );

    // Active statuses.
    this.statusText.setText(
      conn.fx.map((id) => content.statuses.get(id)?.name ?? id).join("  "),
    );

    // Hotbar: each slot shows its BINDING; the stack count lives in the
    // (unlimited) inventory. Empty stacks stay bound but dim.
    this.hotbarGfx.clear();
    for (let i = 0; i < 9; i++) {
      const x = i * SLOT_PX - 4.5 * SLOT_PX;
      const defId = conn.hotbar[i] ?? null;
      const qty = defId ? (conn.inventory.find((s) => s.item === defId)?.qty ?? 0) : 0;
      const armed = defId !== null && qty > 0;
      const selected = selectedThrowable === i;
      this.hotbarGfx
        .fillStyle(selected ? 0x4d3b12 : 0x0d0a12, selected ? 1 : 0.85)
        .fillRect(x, -SLOT_PX, SLOT_PX - 4, SLOT_PX - 4)
        .lineStyle(selected ? 3 : 1, selected ? 0xffe9b0 : armed ? 0x9fe8c9 : 0x5c5470, 1)
        .strokeRect(x, -SLOT_PX, SLOT_PX - 4, SLOT_PX - 4);
      this.hotbarTexts[i]!
        .setText(selected ? `THROW\n${this.slotLabel(defId, qty, i)}` : this.slotLabel(defId, qty, i))
        .setAlpha(defId !== null && qty === 0 ? 0.45 : 1);
      this.hotbarIcons[i]!
        .setTexture(itemTextureKey(defId ?? "rag"))
        .setVisible(defId !== null)
        .setAlpha(armed ? 1 : 0.35);
    }
    const hotbarHit = this.hitTest(this.scene.input.activePointer.x, this.scene.input.activePointer.y);
    const hoveredSlot = hotbarHit?.startsWith("slot:") ? Number(hotbarHit.slice(5)) : null;
    const hoveredDef = hoveredSlot === null ? null : conn.hotbar[hoveredSlot];
    this.hotbarTip.setVisible(hoveredDef !== null && hoveredDef !== undefined);
    if (hoveredDef) {
      this.hotbarTip
        .setText(content.items.get(hoveredDef)?.name ?? hoveredDef)
        .setX(hoveredSlot! * SLOT_PX - 4.5 * SLOT_PX + (SLOT_PX - 4) / 2);
    }

    // Toasts / chat / party.
    const now = performance.now();
    conn.toasts = conn.toasts.filter((t) => t.until > now);
    this.toastText.setText(conn.toasts.map((t) => t.msg).join("\n"));
    this.chatText.setText(
      conn.chatLog.map((l) => `[${l.channel}] ${l.name}: ${l.text}`).join("\n"),
    );
    const partyLines = conn.party
      ? ["PARTY", ...conn.party.members.map((m) => `${m.name}  (${Math.round(m.x)}, ${Math.round(m.y)})`)]
      : [];
    if (conn.pendingInvite) partyLines.push(`${conn.pendingInvite.name} invites you — [F] accept`);
    this.partyText.setText(partyLines.join("\n"));

    // Context prompt + modal panel.
    this.promptText.setText(prompt);
    this.promptText.setVisible(prompt.length > 0);
    const panelContainer = this.widgets.get("panel")!;
    panelContainer.setVisible(panel !== null);
    if (panel !== null) {
      this.panelText.setText(panel);
      this.panelBg.setSize(380, Math.max(120, this.panelText.height + 24));
    }

    this.debugText.setText(debug);
  }

  private slotLabel(defId: string | null, qty: number, index: number): string {
    const key = `${index + 1}`;
    if (!defId) return key;
    return `${key}${qty !== 1 ? ` x${qty}` : ""}`;
  }
}
