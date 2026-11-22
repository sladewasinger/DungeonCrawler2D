/** Touch-only right-hand combat action cluster: ATK (tap or 360-deg bow drag), ROLL, and BLOCK. */

export interface MobileCombatState {
  readonly attack: boolean;
  readonly bowDraw: boolean;
  readonly bowRelease: boolean;
  readonly block: boolean;
  readonly dodge: boolean;
  readonly aim: { readonly x: number; readonly y: number } | undefined;
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
  private readonly blockBtn: HTMLButtonElement;
  private isBowHeld = false;
  private atkPointerId: number | null = null;
  private atkOrigin = { x: 0, y: 0 };
  private atkDragAim: { x: number; y: number } | undefined;
  private attackQueued = false;
  private bowReleaseQueued = false;
  private dodgeQueued = false;
  private blockHeld = false;

  constructor(host: HTMLElement) {
    const cluster = document.createElement("div");
    cluster.className = "ow-combat-cluster";
    this.atkBtn = makeCombatBtn("ow-atk-btn", "ATK", "Attack or draw bow");
    this.rollBtn = makeCombatBtn("ow-roll-btn", "ROLL", "Dodge roll");
    this.blockBtn = makeCombatBtn("ow-block-btn", "BLOCK", "Raise shield block");
    this.blockBtn.hidden = true;
    cluster.append(this.blockBtn, this.rollBtn, this.atkBtn);
    host.append(cluster);
    this.bindAtk();
    this.bindRollAndBlock();
  }

  setGear(gear: { readonly isBowHeld: boolean; readonly hasShield: boolean }): void {
    this.isBowHeld = gear.isBowHeld;
    this.atkBtn.textContent = gear.isBowHeld ? "BOW" : "ATK";
    this.blockBtn.hidden = !gear.hasShield;
    if (!gear.hasShield) this.setBlockHeld(false);
  }

  consumeState(): MobileCombatState {
    const attack = this.attackQueued;
    const bowRelease = this.bowReleaseQueued;
    const dodge = this.dodgeQueued;
    this.attackQueued = false;
    this.bowReleaseQueued = false;
    this.dodgeQueued = false;
    return {
      attack,
      bowDraw: this.isBowHeld && this.atkPointerId !== null,
      bowRelease,
      block: this.blockHeld,
      dodge,
      aim: this.atkPointerId !== null ? this.atkDragAim : undefined,
    };
  }

  private bindAtk(): void {
    this.atkBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.atkBtn.setPointerCapture?.(e.pointerId);
      if (!this.isBowHeld) { this.attackQueued = true; return; }
      this.atkPointerId = e.pointerId;
      this.atkOrigin = { x: e.clientX, y: e.clientY };
      this.atkDragAim = undefined;
      this.atkBtn.dataset.active = "true";
    });
    this.atkBtn.addEventListener("pointermove", (e) => this.updateBowDrag(e));
    const finishAtk = (e: PointerEvent): void => {
      if (e.pointerId !== this.atkPointerId) return;
      this.atkPointerId = null;
      this.atkBtn.dataset.active = "false";
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
    this.rollBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.dodgeQueued = true;
    });
    this.blockBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.blockBtn.setPointerCapture?.(e.pointerId);
      this.setBlockHeld(true);
    });
    const endBlock = (): void => this.setBlockHeld(false);
    this.blockBtn.addEventListener("pointerup", endBlock);
    this.blockBtn.addEventListener("pointercancel", endBlock);
  }

  private setBlockHeld(next: boolean): void {
    this.blockHeld = next;
    this.blockBtn.dataset.active = String(next);
  }
}
