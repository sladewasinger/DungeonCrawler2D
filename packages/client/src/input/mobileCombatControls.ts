/** Touch-only right-hand combat action cluster: dynamic primary action, SNEAK, ROLL, and BLOCK. */

export interface MobileCombatState {
  readonly attack: boolean;
  readonly bowDraw: boolean;
  readonly bowRelease: boolean;
  readonly block: boolean;
  readonly dodge: boolean;
  readonly crouch: boolean;
  readonly aim: { readonly x: number; readonly y: number } | undefined;
}

const ITEM_ACTION_LABELS: Readonly<Record<string, string>> = {
  bow: "BOW",
  bandage: "HEAL",
  "cooked-meat": "EAT",
  "raw-meat": "EAT",
  axe: "CHOP",
  pickaxe: "MINE",
  map: "MAP",
  stone: "TOSS",
};

export function actionLabelForHeldItem(heldItem: string | null): string {
  return (heldItem && ITEM_ACTION_LABELS[heldItem]) || "ATK";
}

function makeCombatBtn(cls: string, label: string, aria: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ow-touch-btn ${cls}`;
  btn.textContent = label;
  btn.setAttribute("aria-label", aria);
  return btn;
}

export class MobileCombatControls {
  private readonly atkBtn: HTMLButtonElement;
  private readonly rollBtn: HTMLButtonElement;
  private readonly sneakBtn: HTMLButtonElement;
  private readonly blockBtn: HTMLButtonElement;
  private heldItem: string | null = null;
  private isBowHeld = false;
  private atkPointerId: number | null = null;
  private atkOrigin = { x: 0, y: 0 };
  private atkDragAim: { x: number; y: number } | undefined;
  private attackQueued = false;
  private bowReleaseQueued = false;
  private dodgeQueued = false;
  private blockHeld = false;
  private crouching = false;

  constructor(host: HTMLElement, private readonly onMapTap?: () => void) {
    const cluster = document.createElement("div");
    cluster.className = "ow-combat-cluster";
    this.atkBtn = makeCombatBtn("ow-atk-btn", "ATK", "Use held item or draw bow");
    this.rollBtn = makeCombatBtn("ow-roll-btn", "ROLL", "Dodge roll");
    this.sneakBtn = makeCombatBtn("ow-roll-btn ow-sneak-btn", "SNEAK", "Toggle crouch sneak");
    this.blockBtn = makeCombatBtn("ow-block-btn", "BLOCK", "Raise shield block");
    this.blockBtn.hidden = true;
    cluster.append(this.blockBtn, this.sneakBtn, this.rollBtn, this.atkBtn);
    host.append(cluster);
    this.bindAtk();
    this.bindRollAndBlock();
  }

  setCrouching(next: boolean): void {
    this.crouching = next;
    this.sneakBtn.dataset.active = String(next);
  }

  setGear(gear: { readonly heldItem: string | null; readonly hasShield: boolean }): void {
    this.heldItem = gear.heldItem;
    this.isBowHeld = gear.heldItem === "bow";
    this.atkBtn.textContent = actionLabelForHeldItem(gear.heldItem);
    this.atkBtn.dataset.role = gear.heldItem === "bandage" || gear.heldItem?.endsWith("-meat") ? "heal" : (gear.heldItem ?? "none");
    this.blockBtn.hidden = !gear.hasShield;
    if (!gear.hasShield) this.setBlockHeld(false);
  }

  consumeState(): MobileCombatState {
    const attack = this.attackQueued;
    const bowRelease = this.bowReleaseQueued;
    const dodge = this.dodgeQueued;
    this.attackQueued = false; this.bowReleaseQueued = false; this.dodgeQueued = false;
    return {
      attack, bowDraw: this.isBowHeld && this.atkPointerId !== null, bowRelease,
      block: this.blockHeld, dodge, crouch: this.crouching,
      aim: this.atkPointerId !== null ? this.atkDragAim : undefined,
    };
  }

  private bindAtk(): void {
    this.atkBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.atkBtn.setPointerCapture?.(e.pointerId);
      if (this.heldItem === "map" && this.onMapTap) { this.onMapTap(); return; }
      if (!this.isBowHeld) { this.attackQueued = true; return; }
      this.atkPointerId = e.pointerId;
      this.atkOrigin = { x: e.clientX, y: e.clientY };
      this.atkDragAim = undefined;
      this.atkBtn.dataset.active = "true";
    });
    this.atkBtn.addEventListener("pointermove", (e) => this.updateBowDrag(e));
    const finishAtk = (e: PointerEvent): void => {
      if (e.pointerId !== this.atkPointerId) return;
      this.atkPointerId = null; this.atkBtn.dataset.active = "false";
      if (this.isBowHeld) this.bowReleaseQueued = true;
    };
    this.atkBtn.addEventListener("pointerup", finishAtk);
    this.atkBtn.addEventListener("pointercancel", finishAtk);
  }

  private updateBowDrag(e: PointerEvent): void {
    if (e.pointerId !== this.atkPointerId) return;
    const dx = e.clientX - this.atkOrigin.x;
    const dy = e.clientY - this.atkOrigin.y;
    const mag = Math.hypot(dx, dy);
    if (mag > 8) this.atkDragAim = { x: dx / mag, y: dy / mag };
  }

  private bindRollAndBlock(): void {
    this.rollBtn.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.dodgeQueued = true; });
    this.sneakBtn.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.setCrouching(!this.crouching); });
    this.blockBtn.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.blockBtn.setPointerCapture?.(e.pointerId); this.setBlockHeld(true); });
    const endBlock = (): void => this.setBlockHeld(false);
    this.blockBtn.addEventListener("pointerup", endBlock);
    this.blockBtn.addEventListener("pointercancel", endBlock);
  }

  private setBlockHeld(next: boolean): void { this.blockHeld = next; this.blockBtn.dataset.active = String(next); }
}