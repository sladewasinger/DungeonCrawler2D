import { content } from "@dc2d/content";
import type { InvSlot } from "@dc2d/engine";
import Phaser from "phaser";
import type { Connection } from "../net/connection";

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
        const t = scene.add
          .text(i * SLOT_PX - 4.5 * SLOT_PX + 4, -SLOT_PX + 4, "", {
            fontSize: "10px",
            color: "#e8e4f0",
          })
          .setWordWrapWidth(SLOT_PX - 8);
        this.hotbarTexts.push(t);
        c.add(t);
      }
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

  // ── frame update ─────────────────────────────────────────────────

  update(conn: Connection, prompt: string, panel: string | null, debug: string): void {
    // Health.
    this.healthBar.clear();
    this.healthBar.fillStyle(0x1a1420, 1).fillRect(0, 0, 180, 18);
    const frac = conn.maxHp > 0 ? conn.hp / conn.maxHp : 0;
    this.healthBar
      .fillStyle(frac > 0.35 ? 0x6fce62 : 0xd8574d, 1)
      .fillRect(2, 2, 176 * Math.max(0, frac), 14);
    this.healthText.setText(
      conn.downed ? `DOWNED — a party member can revive you` : `${conn.hp} / ${conn.maxHp}`,
    );

    // Active statuses.
    this.statusText.setText(
      conn.fx.map((id) => content.statuses.get(id)?.name ?? id).join("  "),
    );

    // Hotbar.
    this.hotbarGfx.clear();
    for (let i = 0; i < 9; i++) {
      const x = i * SLOT_PX - 4.5 * SLOT_PX;
      const selected = i === conn.selectedSlot;
      this.hotbarGfx
        .fillStyle(0x0d0a12, 0.85)
        .fillRect(x, -SLOT_PX, SLOT_PX - 4, SLOT_PX - 4)
        .lineStyle(selected ? 2 : 1, selected ? 0xffe9b0 : 0x5c5470, 1)
        .strokeRect(x, -SLOT_PX, SLOT_PX - 4, SLOT_PX - 4);
      this.hotbarTexts[i]!.setText(this.slotLabel(conn.inventory[i] ?? null, i));
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

  private slotLabel(slot: InvSlot, index: number): string {
    const key = `${index + 1}`;
    if (!slot) return key;
    const name = content.items.get(slot.item)?.name ?? slot.item;
    return `${key} ${name}${slot.qty > 1 ? ` ×${slot.qty}` : ""}`;
  }
}
