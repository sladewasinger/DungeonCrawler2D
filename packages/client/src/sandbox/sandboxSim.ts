/** Self-contained local client-side sandbox world simulation (chests, combat, player, lineup). */
import { STARTER_LOADOUT, getItemDef, maxStackForItem } from "@dc2d/content";
import {
  CHEST_SLOT_COUNT, DEFAULT_APPEARANCE, MAX_PLAYER_HP, MAX_PLAYER_STAMINA,
  createEmptyChestSlots, createEmptyInventoryState, equipArmorFromSlot,
  moveOrSwapSlot, quickTransferChestSlot, takeAllFromChest, transferChestSlot, unequipArmorToSlot,
  type ArmorSlotKey, type InventorySlot, type InventorySnapshot,
  type PlayerInventoryState, type PlayerSnapshot, type ProjectileSnapshot,
  type WorldChestSnapshot, type WorldEntitySnapshot, type WorldEvent,
} from "@dc2d/engine";
import { SandboxChunkCache } from "./sandboxTerrain.js";
import {
  createLineupActors, createWolfPackActors, isDummyKind, stepSandboxActors,
  type SandboxActor, type SandboxFacing, type SandboxPose,
} from "./sandboxAi.js";
import {
  advanceSandboxBow, advanceSandboxMelee, advanceSandboxPlayer, applySandboxPlayerHit,
  stepSandboxProjectiles, type PlayerMoveTimers, type SandboxProjectile,
} from "./sandboxCombat.js";

export interface SandboxStepInput {
  readonly dt: number;
  readonly timeSec: number;
  readonly move: { readonly x: number; readonly y: number };
  readonly aim: { readonly x: number; readonly y: number };
  readonly attack: boolean;
  readonly block: boolean;
  readonly dodge: boolean;
  readonly jump: boolean;
  readonly bowDraw: boolean;
  readonly bowRelease: boolean;
}

export interface SandboxChestTransferReq {
  readonly chestId: string;
  readonly from: "chest" | "inv";
  readonly fromSlot: number;
  readonly to: "chest" | "inv";
  readonly toSlot: number;
  readonly quick?: boolean | undefined;
}

const POI_CAMP = "bandit-camp" as const;
const POI_RUINS = "ancient-ruins" as const;

const SANDBOX_CHEST_SPECS: readonly { readonly id: string; readonly poiKind: "bandit-camp" | "ancient-ruins"; readonly x: number; readonly y: number; readonly elev?: number; readonly opened: boolean }[] = [
  { id: "sbx-chest-wood-closed", poiKind: POI_CAMP, x: 24, y: 13.4, opened: false },
  { id: "sbx-chest-wood-open", poiKind: POI_CAMP, x: 27, y: 13.4, opened: true },
  { id: "sbx-chest-stone-closed", poiKind: POI_RUINS, x: 30, y: 13.4, opened: false },
  { id: "sbx-chest-stone-open", poiKind: POI_RUINS, x: 33, y: 13.4, opened: true },
  { id: "sbx-chest-cliff", poiKind: POI_RUINS, x: 89.5, y: 11.5, elev: 1, opened: false },
];

function createStarterInv(): PlayerInventoryState {
  const base = createEmptyInventoryState();
  for (const item of STARTER_LOADOUT) base.slots[item.slot] = { itemId: item.itemId, count: item.count };
  return { slots: base.slots, armor: { ...base.armor, offhand: "wooden-shield" } };
}

function createSandboxChests(): WorldChestSnapshot[] {
  return SANDBOX_CHEST_SPECS.map((c) => {
    const slots = createEmptyChestSlots();
    if (!c.opened) {
      slots[0] = { itemId: "potion", count: 3 };
      slots[1] = { itemId: "arrow", count: 16 };
      slots[2] = { itemId: "coin", count: 25 };
      slots[3] = { itemId: c.poiKind === POI_RUINS ? "iron-helm" : "cooked-meat", count: 2 };
    } else {
      slots[0] = { itemId: "coin", count: 5 };
    }
    return { id: c.id, poiKind: c.poiKind, x: c.x, y: c.y, elevation: c.elev ?? 0, opened: c.opened, slots };
  });
}

function cloneSlots(slots: readonly InventorySlot[]): InventorySlot[] {
  return slots.map((s) => (s ? { ...s } : null));
}

export class SandboxSim {
  readonly cache = new SandboxChunkCache();
  private inv: PlayerInventoryState = createStarterInv();
  private selectedHotbar = 0;
  private chests: WorldChestSnapshot[] = createSandboxChests();
  private actors: SandboxActor[] = createLineupActors();
  private projectiles: SandboxProjectile[] = [];
  private packSeq = 0;
  private projSeq = 0;
  private pose: SandboxPose = "idle";
  private facing: SandboxFacing = "auto";
  private aiLive = false;
  private player: PlayerSnapshot;
  private readonly timers: PlayerMoveTimers = { dodgeTimer: 0, swingTimer: 0, comboResetTimer: 0, bowChargeSec: 0 };

  constructor() {
    this.player = this.initialPlayer();
  }

  private initialPlayer(): PlayerSnapshot {
    return {
      id: "sandbox-hero", name: "Adventurer", x: 21, y: 26.2, elevation: 0,
      jumpZ: 0, jumpVz: 0, facingX: 0, facingY: -1, aimX: 0, aimY: -1,
      moving: false, torchLit: false, inWater: false, lastAckSeq: 0,
      heldItem: this.inv.slots[this.selectedHotbar]?.itemId ?? null,
      appearance: DEFAULT_APPEARANCE, armor: this.inv.armor,
      hp: MAX_PLAYER_HP, maxHp: MAX_PLAYER_HP, stamina: MAX_PLAYER_STAMINA, maxStamina: MAX_PLAYER_STAMINA,
      blocking: false, dodging: false, comboStep: 0, swingProgress: 0, bowCharge: 0,
    };
  }

  getPose(): SandboxPose { return this.pose; }
  getFacing(): SandboxFacing { return this.facing; }
  localPose(): { readonly x: number; readonly y: number; readonly elevation: number } {
    return { x: this.player.x, y: this.player.y, elevation: this.player.elevation };
  }
  isAiLive(): boolean { return this.aiLive; }
  setPose(pose: SandboxPose): void { this.pose = pose; this.aiLive = false; }
  setFacing(facing: SandboxFacing): void { this.facing = facing; this.aiLive = false; }
  setAiLive(live: boolean): void { this.aiLive = live; for (const a of this.actors) if (live && !isDummyKind(a.snap.kind)) a.awake = true; }

  wakeNearest(): void {
    let best: SandboxActor | null = null; let bestD = 999;
    for (const a of this.actors) {
      if (isDummyKind(a.snap.kind) || a.awake || a.snap.hp <= 0) continue;
      const d = Math.hypot(a.snap.x - this.player.x, a.snap.y - this.player.y);
      if (d < bestD) { bestD = d; best = a; }
    }
    if (best) best.awake = true;
  }

  spawnWolfPack(): void {
    this.actors.push(...createWolfPackActors(this.player.x, Math.max(4, this.player.y - 1.5), ++this.packSeq));
  }

  teleportTo(x: number, y: number): void {
    const elev = this.cache.tileAt(Math.floor(x), Math.floor(y)).elevation;
    this.player = { ...this.player, x, y, elevation: elev, jumpZ: 0, jumpVz: 0, moving: false };
  }

  resetArena(): void {
    this.actors = createLineupActors();
    this.projectiles = [];
    this.chests = createSandboxChests();
    this.aiLive = false;
    this.pose = "idle";
    this.facing = "auto";
    this.player = this.initialPlayer();
  }

  selectHotbar(slot: number): void {
    if (slot < 0 || slot >= 9) return;
    this.selectedHotbar = slot;
    this.player = { ...this.player, heldItem: this.inv.slots[slot]?.itemId ?? null };
  }

  toggleTorch(): void { this.player = { ...this.player, torchLit: !this.player.torchLit }; }

  moveSlot(move: { readonly from: number; readonly to: number }): void {
    const nextSlots = cloneSlots(this.inv.slots);
    moveOrSwapSlot(nextSlots, move, maxStackForItem);
    this.inv = { ...this.inv, slots: nextSlots };
    this.selectHotbar(this.selectedHotbar);
  }

  equipArmor(req: { readonly slotIndex: number; readonly targetArmor?: ArmorSlotKey | undefined }): void {
    const next = equipArmorFromSlot(this.inv, req, getItemDef);
    if (!next) return;
    this.inv = next;
    this.player = { ...this.player, armor: next.armor };
  }

  unequipArmor(req: { readonly armorSlot: ArmorSlotKey; readonly targetSlot?: number | undefined }): void {
    const next = unequipArmorToSlot(this.inv, req, { maxStackFor: maxStackForItem, lookup: getItemDef });
    if (!next) return;
    this.inv = next;
    this.player = { ...this.player, armor: next.armor };
  }

  openChest(chestId: string): void {
    this.chests = this.chests.map((c) => (c.id === chestId ? { ...c, opened: true } : c));
  }

  chestTransfer(req: SandboxChestTransferReq): void {
    const chest = this.chests.find((c) => c.id === req.chestId);
    if (!chest) return;
    const chestSlots = cloneSlots(chest.slots ?? createEmptyChestSlots());
    const invSlots = cloneSlots(this.inv.slots);
    const ok = req.quick
      ? quickTransferChestSlot({ chestSlots, invSlots, from: req.from, slotIndex: req.fromSlot, maxStackFor: maxStackForItem })
      : transferChestSlot({ chestSlots, invSlots, from: req.from, fromSlot: req.fromSlot, to: req.to, toSlot: req.toSlot, maxStackFor: maxStackForItem });
    if (!ok) return;
    this.inv = { ...this.inv, slots: invSlots };
    this.chests = this.chests.map((c) => (c.id === req.chestId ? { ...c, opened: true, slots: chestSlots } : c));
  }

  chestTakeAll(chestId: string): void {
    const chest = this.chests.find((c) => c.id === chestId);
    if (!chest) return;
    const chestSlots = cloneSlots(chest.slots ?? createEmptyChestSlots());
    const invSlots = cloneSlots(this.inv.slots);
    takeAllFromChest({ chestSlots, invSlots, maxStackFor: maxStackForItem });
    this.inv = { ...this.inv, slots: invSlots };
    this.chests = this.chests.map((c) => (c.id === chestId ? { ...c, opened: true, slots: chestSlots.slice(0, CHEST_SLOT_COUNT) } : c));
  }

  nearestChest(): WorldChestSnapshot | null {
    let best: WorldChestSnapshot | null = null; let bestD = 2.2;
    for (const c of this.chests) {
      const d = Math.hypot(c.x - this.player.x, c.y - this.player.y);
      if (d <= bestD) { bestD = d; best = c; }
    }
    return best;
  }

  step(input: SandboxStepInput): {
    readonly player: PlayerSnapshot;
    readonly inventory: InventorySnapshot;
    readonly entities: readonly WorldEntitySnapshot[];
    readonly chests: readonly WorldChestSnapshot[];
    readonly projectiles: readonly ProjectileSnapshot[];
    readonly events: readonly WorldEvent[];
  } {
    const events: WorldEvent[] = [];
    this.player = advanceSandboxPlayer({ player: this.player, cache: this.cache, timers: this.timers, input });
    this.player = advanceSandboxBow({
      player: this.player, timers: this.timers, input,
      nextProjId: () => `sbx-arr-${++this.projSeq}`, projectiles: this.projectiles, events,
    });
    this.player = advanceSandboxMelee({ player: this.player, timers: this.timers, input, actors: this.actors, events });
    const projRes = stepSandboxProjectiles(this.projectiles, this.actors, input.dt);
    this.projectiles = projRes.nextProjectiles;
    events.push(...projRes.events);
    events.push(...stepSandboxActors({
      actors: this.actors, player: this.player, pose: this.pose, facing: this.facing, aiLive: this.aiLive,
      dt: input.dt, timeSec: input.timeSec,
      onHitPlayer: () => { const h = applySandboxPlayerHit(this.player, 8); this.player = h.nextPlayer; return h.event; },
    }));
    return {
      player: this.player,
      inventory: { slots: this.inv.slots, selectedHotbar: this.selectedHotbar, armor: this.inv.armor, nearCampfire: true },
      entities: this.actors.map((a) => a.snap),
      chests: this.chests,
      projectiles: this.projectiles.map((pr) => pr.snap),
      events,
    };
  }
}
