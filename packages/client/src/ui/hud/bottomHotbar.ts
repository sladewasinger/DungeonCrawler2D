/** Always-visible, larger 9-slot bottom hotbar (slots 0..8), droppable even when inventory is open. */
import { HOTBAR_SLOT_COUNT, type InventorySnapshot } from "@dc2d/engine";
import type { DragSource, SlotDragManager } from "./slotDragManager.js";
import { domNode, renderSlotContent, slotsFingerprint } from "./slotRenderer.js";

export class BottomHotbar {
  readonly el: HTMLDivElement;
  private readonly buttons: HTMLButtonElement[] = [];
  private lastFingerprint = "";

  constructor(host: HTMLElement, drag: SlotDragManager) {
    this.el = domNode("div", "ow-hotbar");
    this.el.setAttribute("role", "toolbar");
    this.el.setAttribute("aria-label", "Hotbar");
    for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) {
      const btn = domNode("button", "ow-slot");
      btn.type = "button";
      btn.setAttribute("aria-label", `Hotbar slot ${i + 1}`);
      drag.bindSlot(btn, { kind: "slot", index: i });
      this.buttons.push(btn);
      this.el.append(btn);
    }
    host.append(this.el);
  }

  sync(inv: InventorySnapshot, tapSource: DragSource | null): void {
    const tapIdx = tapSource?.kind === "slot" ? tapSource.index : -1;
    const fp = `${slotsFingerprint(inv.slots, 0, HOTBAR_SLOT_COUNT)}#${inv.selectedHotbar}#${tapIdx}`;
    if (fp === this.lastFingerprint) return;
    this.lastFingerprint = fp;

    for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) {
      const btn = this.buttons[i];
      if (!btn) continue;
      renderSlotContent(btn, {
        item: inv.slots[i] ?? null,
        keyLabel: String(i + 1),
        selected: inv.selectedHotbar === i,
        tapSource: tapIdx === i,
      });
    }
  }
}
