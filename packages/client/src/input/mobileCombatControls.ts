/** Touch-only right-hand 2-row combat cluster: primary (BLOCK/ATK/JUMP) over secondary (SNEAK/ROLL). */
import { getItemDef, isBowItem, resolveBlockMode } from "@dc2d/content";

export interface MobileCombatState {
  readonly attack: boolean;
  readonly attackHold: boolean;
  readonly bowDraw: boolean;
  readonly bowRelease: boolean;
  readonly block: boolean;
  readonly dodge: boolean;
  readonly crouch: boolean;
  readonly aim: { readonly x: number; readonly y: number } | undefined;
}

export interface MobileCombatHandlers {
  readonly onMapTap?: () => void;
  readonly onJump?: () => void;
  readonly onRotateGhost?: () => void;
  readonly onDismantle?: () => void;
  readonly onPlaceGhost?: () => boolean;
}

const ITEM_ACTION_LABELS: Readonly<Record<string, string>> = {
  bow: "BOW",
  bandage: "HEAL",
  "healing-salve": "HEAL",
  "cooked-meat": "EAT",
  "raw-meat": "EAT",
  berry: "EAT",
  "herb-tea": "EAT",
  axe: "CHOP",
  pickaxe: "MINE",
  stone: "TOSS",
};

const HEAL_OR_EAT_ITEMS = new Set(["bandage", "healing-salve", "cooked-meat", "raw-meat", "berry", "herb-tea"]);

const ARCHETYPE_ACTION_LABELS: Readonly<Record<string, string>> = { axe: "CHOP", pickaxe: "MINE" };

function labelFromItemDef(def: NonNullable<ReturnType<typeof getItemDef>>): string {
  if (def.placeStructure) return "PLACE";
  if (def.weaponArchetype) return ARCHETYPE_ACTION_LABELS[def.weaponArchetype] ?? "ATK";
  return def.healHp || def.buffEffect || def.curesStatuses ? "USE" : "ATK";
}

function actionLabelForHeldItem(heldItem: string | null): string {
  if (!heldItem) return "ATK";
  if (isBowItem(heldItem)) return "BOW";
  const mapped = ITEM_ACTION_LABELS[heldItem];
  if (mapped) return mapped;
  const def = getItemDef(heldItem);
  return def ? labelFromItemDef(def) : "ATK";
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
  private readonly jumpBtn: HTMLButtonElement;
  private readonly rollBtn: HTMLButtonElement;
  private readonly sneakBtn: HTMLButtonElement;
  private readonly blockBtn: HTMLButtonElement;
  private readonly rotBtn: HTMLButtonElement;
  private readonly dismantleBtn: HTMLButtonElement;
  private readonly handlers: MobileCombatHandlers;
  private hasPlaceable = false;
  private isBowHeld = false;
  private atkPointerId: number | null = null;
  private atkOrigin = { x: 0, y: 0 };
  private atkDragAim: { x: number; y: number } | undefined;
  private attackQueued = false;
  private bowReleaseQueued = false;
  private dodgeQueued = false;
  private blockHeld = false;
  private crouching = false;

  constructor(host: HTMLElement, handlers: MobileCombatHandlers = {}) {
    this.handlers = handlers;
    const cluster = document.createElement("div");
    cluster.className = "ow-combat-cluster";
    this.atkBtn = makeCombatBtn("ow-atk-btn", "ATK", "Use held item or draw bow");
    this.jumpBtn = makeCombatBtn("ow-jump-btn", "JUMP", "Jump");
    this.rollBtn = makeCombatBtn("ow-roll-btn", "ROLL", "Dodge roll");
    this.sneakBtn = makeCombatBtn("ow-roll-btn ow-sneak-btn", "SNEAK", "Toggle crouch sneak");
    this.blockBtn = makeCombatBtn("ow-block-btn", "BLOCK", "Raise shield block");
    this.blockBtn.hidden = true;
    this.rotBtn = makeCombatBtn("ow-roll-btn ow-rot-btn", "ROT", "Rotate placement");
    this.rotBtn.hidden = true;
    this.dismantleBtn = makeCombatBtn("ow-roll-btn ow-dismantle-btn", "DISMANTLE", "Dismantle nearby structure");
    this.dismantleBtn.hidden = true;
    const primaryRow = document.createElement("div");
    primaryRow.className = "ow-combat-row ow-combat-row-primary";
    primaryRow.append(this.blockBtn, this.atkBtn, this.jumpBtn);
    const utilityRow = document.createElement("div");
    utilityRow.className = "ow-combat-row ow-combat-row-utility";
    utilityRow.append(this.rotBtn, this.dismantleBtn, this.sneakBtn, this.rollBtn);
    cluster.append(primaryRow, utilityRow);
    host.append(cluster);
    this.bindAtk();
    this.bindRollAndBlock();
  }

  setBuildContext(opts: { readonly hasPlaceable: boolean; readonly nearDismantle: boolean }): void {
    this.hasPlaceable = opts.hasPlaceable;
    this.rotBtn.hidden = !opts.hasPlaceable;
    this.dismantleBtn.hidden = !opts.nearDismantle;
  }

  setCrouching(next: boolean): void {
    this.crouching = next;
    this.sneakBtn.dataset.active = String(next);
  }

  resetHeldInputs(): void {
    this.atkPointerId = null;
    this.atkDragAim = undefined;
    this.atkBtn.dataset.active = "false";
    this.attackQueued = false;
    this.bowReleaseQueued = false;
    this.dodgeQueued = false;
    this.setBlockHeld(false);
  }

  setGear(gear: { readonly heldItem: string | null; readonly offhandItem?: string | null | undefined; readonly hasShield: boolean }): void {
    this.isBowHeld = isBowItem(gear.heldItem);
    this.atkBtn.textContent = actionLabelForHeldItem(gear.heldItem);
    this.atkBtn.dataset.role = gear.heldItem && HEAL_OR_EAT_ITEMS.has(gear.heldItem) ? "heal" : (gear.heldItem ?? "none");
    const offhand = gear.offhandItem !== undefined ? gear.offhandItem : (gear.hasShield ? "wooden-shield" : null);
    const blockMode = resolveBlockMode(gear.heldItem, offhand);
    this.blockBtn.hidden = blockMode === "none";
    this.blockBtn.textContent = blockMode === "twoHanded" ? "PARRY" : "BLOCK";
    if (blockMode === "none") this.setBlockHeld(false);
  }

  consumeState(): MobileCombatState {
    const attack = this.attackQueued;
    const bowRelease = this.bowReleaseQueued;
    const dodge = this.dodgeQueued;
    this.attackQueued = false; this.bowReleaseQueued = false; this.dodgeQueued = false;
    const held = this.atkPointerId !== null;
    return {
      attack, attackHold: !this.isBowHeld && held,
      bowDraw: this.isBowHeld && held, bowRelease,
      block: this.blockHeld, dodge, crouch: this.crouching,
      aim: this.isBowHeld && held ? this.atkDragAim : undefined,
    };
  }

  private bindAtk(): void {
    this.atkBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.atkBtn.setPointerCapture?.(e.pointerId);
      this.atkPointerId = e.pointerId;
      this.atkBtn.dataset.active = "true";
      if (this.hasPlaceable && this.handlers.onPlaceGhost?.()) {
        this.atkPointerId = null; this.atkBtn.dataset.active = "false"; return;
      }
      if (!this.isBowHeld) { this.attackQueued = true; return; }
      this.atkOrigin = { x: e.clientX, y: e.clientY };
      this.atkDragAim = undefined;
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
    if (!this.isBowHeld || e.pointerId !== this.atkPointerId) return;
    const dx = e.clientX - this.atkOrigin.x;
    const dy = e.clientY - this.atkOrigin.y;
    const mag = Math.hypot(dx, dy);
    if (mag > 8) this.atkDragAim = { x: dx / mag, y: dy / mag };
  }

  private bindRollAndBlock(): void {
    this.jumpBtn.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.handlers.onJump?.(); });
    this.rollBtn.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.dodgeQueued = true; });
    this.sneakBtn.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.setCrouching(!this.crouching); });
    this.rotBtn.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.handlers.onRotateGhost?.(); });
    this.dismantleBtn.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.handlers.onDismantle?.(); });
    this.blockBtn.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.blockBtn.setPointerCapture?.(e.pointerId); this.setBlockHeld(true); });
    const endBlock = (): void => this.setBlockHeld(false);
    this.blockBtn.addEventListener("pointerup", endBlock);
    this.blockBtn.addEventListener("pointercancel", endBlock);
  }

  private setBlockHeld(next: boolean): void { this.blockHeld = next; this.blockBtn.dataset.active = String(next); }
}