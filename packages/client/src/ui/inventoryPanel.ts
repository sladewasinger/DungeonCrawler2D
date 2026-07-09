import { content } from "@dc2d/content";
import type { Connection } from "../net/connection";
import { itemAssetPath } from "../render/itemSprites";

/**
 * The inventory panel — a DOM overlay (like the chat input) because a
 * searchable, filterable, keyboard-friendly list wants real form
 * controls, not Phaser text.
 *
 *   [I]      toggle          [Esc] close
 *   type     search by name
 *   tabs     All / Weapons / Usables / Materials
 *   click    select a row → press 1–9 to bind it to that hotbar slot
 *   Equip    weapons go to the character slot (melee swings use it)
 *   Drop     drops the whole stack where you stand
 *
 * The panel only sends intents; every mutation comes back through the
 * next server snapshot.
 */

type Filter = "all" | "weapons" | "usables" | "materials";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "weapons", label: "Weapons" },
  { id: "usables", label: "Usables" },
  { id: "materials", label: "Materials" },
];

function categoryOf(defId: string): Filter {
  const def = content.items.get(defId);
  if (!def) return "materials";
  if (def.weapon) return "weapons";
  if (def.consumable || def.throwable) return "usables";
  return "materials";
}

export class InventoryPanel {
  private readonly root: HTMLDivElement;
  private readonly search: HTMLInputElement;
  private readonly list: HTMLDivElement;
  private readonly equipLine: HTMLDivElement;
  private readonly hotbarLine: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private filter: Filter = "all";
  private selected: string | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly conn: Connection) {
    this.root = document.createElement("div");
    this.root.id = "inventory-panel";
    Object.assign(this.root.style, {
      position: "absolute",
      top: "60px",
      right: "16px",
      width: "360px",
      maxHeight: "70vh",
      display: "none",
      flexDirection: "column",
      gap: "6px",
      padding: "10px",
      background: "#0d0a12f0",
      border: "1px solid #9fe8c9",
      color: "#e8e4f0",
      fontFamily: "monospace",
      fontSize: "13px",
      zIndex: "20",
    });

    const title = document.createElement("div");
    title.textContent = "INVENTORY — [I] close · click item, press 1–9 to bind";
    title.style.color = "#9fe8c9";
    this.root.appendChild(title);

    this.equipLine = document.createElement("div");
    this.root.appendChild(this.equipLine);

    const tabs = document.createElement("div");
    tabs.style.display = "flex";
    tabs.style.gap = "6px";
    for (const f of FILTERS) {
      const b = document.createElement("button");
      b.textContent = f.label;
      b.dataset.filter = f.id;
      Object.assign(b.style, {
        background: "#1a1420",
        color: "#e8e4f0",
        border: "1px solid #5c5470",
        font: "inherit",
        padding: "2px 8px",
        cursor: "pointer",
      });
      b.addEventListener("click", () => {
        this.filter = f.id;
        this.refresh();
      });
      tabs.appendChild(b);
    }
    this.root.appendChild(tabs);

    this.search = document.createElement("input");
    this.search.placeholder = "search…";
    Object.assign(this.search.style, {
      background: "#1a1420",
      color: "#e8e4f0",
      border: "1px solid #5c5470",
      font: "inherit",
      padding: "4px 8px",
    });
    this.search.addEventListener("input", () => this.refresh());
    this.root.appendChild(this.search);

    this.list = document.createElement("div");
    Object.assign(this.list.style, { overflowY: "auto", flex: "1", minHeight: "0" });
    this.root.appendChild(this.list);

    this.hotbarLine = document.createElement("div");
    this.hotbarLine.style.color = "#c8ecf7";
    this.root.appendChild(this.hotbarLine);

    this.hint = document.createElement("div");
    this.hint.style.color = "#8f8898";
    this.root.appendChild(this.hint);

    document.body.appendChild(this.root);

    // Capture-phase so the game (Phaser listens on window) never sees
    // keys the panel consumes.
    window.addEventListener(
      "keydown",
      (event) => {
        const typingInSearch = document.activeElement === this.search;
        const typingElsewhere =
          !typingInSearch && document.activeElement instanceof HTMLInputElement;
        if ((event.key === "i" || event.key === "I") && !typingInSearch && !typingElsewhere) {
          this.toggle();
          event.stopImmediatePropagation();
          event.preventDefault();
          return;
        }
        if (!this.visible) return;
        if (event.key === "Escape") {
          this.hide();
          event.stopImmediatePropagation();
          return;
        }
        if (!typingInSearch && this.selected && /^[1-9]$/.test(event.key)) {
          this.conn.assignSlot(Number(event.key) - 1, this.selected);
          this.hint.textContent = `Bound ${nameOf(this.selected)} to slot ${event.key}`;
          event.stopImmediatePropagation();
          event.preventDefault();
        }
      },
      true,
    );
  }

  get visible(): boolean {
    return this.root.style.display !== "none";
  }

  toggle(): void {
    this.visible ? this.hide() : this.show();
  }

  show(): void {
    this.root.style.display = "flex";
    this.refresh();
    this.refreshTimer = setInterval(() => this.refresh(), 300);
  }

  hide(): void {
    this.root.style.display = "none";
    this.selected = null;
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
    this.search.blur();
  }

  private refresh(): void {
    const { conn } = this;
    const weaponName = conn.weapon ? nameOf(conn.weapon) : "none (fists)";
    this.equipLine.innerHTML = "";
    if (conn.weapon) this.equipLine.appendChild(itemIcon(conn.weapon, 28));
    this.equipLine.append(`⚔ Weapon: ${weaponName} `);
    if (conn.weapon) {
      const un = rowButton("Unequip");
      un.addEventListener("click", () => conn.equip(null));
      this.equipLine.appendChild(un);
    }

    const q = this.search.value.trim().toLowerCase();
    this.list.innerHTML = "";
    const stacks = conn.inventory
      .filter((s) => this.filter === "all" || categoryOf(s.item) === this.filter)
      .filter((s) => q === "" || nameOf(s.item).toLowerCase().includes(q))
      .sort((a, b) => nameOf(a.item).localeCompare(nameOf(b.item)));

    if (stacks.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "(nothing here)";
      empty.style.color = "#8f8898";
      this.list.appendChild(empty);
    }
    for (const stack of stacks) {
      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "3px 4px",
        cursor: "pointer",
        border: `1px solid ${this.selected === stack.item ? "#ffe9b0" : "transparent"}`,
      });
      row.appendChild(itemIcon(stack.item, 32));
      const label = document.createElement("span");
      label.textContent = `${nameOf(stack.item)} ×${stack.qty}`;
      label.style.flex = "1";
      row.appendChild(label);

      const bound = conn.hotbar.indexOf(stack.item);
      if (bound >= 0) {
        const tag = document.createElement("span");
        tag.textContent = `[${bound + 1}]`;
        tag.style.color = "#9fe8c9";
        row.appendChild(tag);
      }
      if (content.items.get(stack.item)?.weapon) {
        const eq = rowButton(conn.weapon === stack.item ? "Equipped" : "Equip");
        if (conn.weapon !== stack.item) {
          eq.addEventListener("click", (e) => {
            e.stopPropagation();
            conn.equip(stack.item);
          });
        }
        row.appendChild(eq);
      }
      const drop = rowButton("Drop");
      drop.addEventListener("click", (e) => {
        e.stopPropagation();
        conn.drop(stack.item);
      });
      row.appendChild(drop);

      row.addEventListener("click", () => {
        this.selected = this.selected === stack.item ? null : stack.item;
        this.hint.textContent = this.selected
          ? `Press 1–9 to bind ${nameOf(stack.item)} to a hotbar slot`
          : "";
        this.refresh();
      });
      this.list.appendChild(row);
    }

    this.hotbarLine.textContent =
      "Hotbar: " +
      conn.hotbar.map((d, i) => `${i + 1}:${d ? nameOf(d) : "·"}`).join("  ");
  }
}

function nameOf(defId: string): string {
  return content.items.get(defId)?.name ?? defId;
}

function rowButton(label: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  Object.assign(b.style, {
    background: "#1a1420",
    color: "#e8e4f0",
    border: "1px solid #5c5470",
    font: "inherit",
    fontSize: "11px",
    padding: "1px 6px",
    cursor: "pointer",
  });
  return b;
}

function itemIcon(defId: string, size: number): HTMLImageElement {
  const image = document.createElement("img");
  image.src = itemAssetPath(defId);
  image.alt = "";
  Object.assign(image.style, {
    width: `${size}px`,
    height: `${size}px`,
    objectFit: "contain",
    imageRendering: "pixelated",
    flex: "0 0 auto",
  });
  return image;
}
