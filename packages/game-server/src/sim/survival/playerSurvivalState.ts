/** Player survival buff progression (Well-Fed & hearth-warmed Rested), stealth/snapshot helpers, and persistence hydration. */
import { COMBAT_TUNING, SURVIVAL_BUFF_TUNING, clamp, computeSurvivalRegen, cloneInventoryState, sanitizeCharacterAppearance, type PlayerBubble, type PlayerSnapshot } from "@dc2d/engine";
import { resolvePlayerGear } from "../combat/gearEffects.js";
import type { CombatPlayerRef } from "../combatActions.js";
import { playerCombatExtras } from "../combatSim.js";
import type { PersistedPlayerRecord, PersistedWorldFile } from "./persistenceStore.js";

export function isSprintingMove(o: { readonly mag: number; readonly mult: number; readonly inWater: boolean; readonly dodging: boolean }): boolean {
  return o.mag > 0.82 && o.mult >= 0.99 && !o.inWater && !o.dodging;
}

export function computeDesiredPlayerDir(p: {
  readonly moveX: number; readonly moveY: number;
  readonly combat: { readonly staggerTimer: number; readonly respawnTimer: number; readonly dodgeTimer: number; readonly dodgeDirX: number; readonly dodgeDirY: number; readonly bowCharge: number };
}): { readonly ux: number; readonly uy: number; readonly nx: number; readonly ny: number; readonly mag: number } | null {
  if (p.combat.staggerTimer > 0 || p.combat.respawnTimer > 0) return null;
  const dodging = p.combat.dodgeTimer > 0;
  const rawX = dodging ? p.combat.dodgeDirX : p.moveX;
  const rawY = dodging ? p.combat.dodgeDirY : p.moveY;
  const rawMag = Math.hypot(rawX, rawY);
  if (rawMag < 0.05) return null;
  const ux = rawX / rawMag; const uy = rawY / rawMag;
  const mag = Math.min(rawMag, !dodging && p.combat.bowCharge > 0 ? COMBAT_TUNING.movement.walkSpeedRatio : 1);
  return { ux, uy, nx: ux * mag, ny: uy * mag, mag };
}

function updateHearthWarmth(c: CombatPlayerRef["combat"], nearCampfire: boolean, dt: number): void {
  if (!nearCampfire || c.hitTimer > 0) { c.hearthWarmSec = Math.max(0, c.hearthWarmSec - dt * 2); return; }
  c.hearthWarmSec += dt;
  if (c.hearthWarmSec >= SURVIVAL_BUFF_TUNING.restedChargeSec) {
    c.restedTimer = Math.max(c.restedTimer, SURVIVAL_BUFF_TUNING.restedDurationSec);
  }
}

export function stepPlayerSurvivalBuffs(opts: {
  readonly p: CombatPlayerRef; readonly nearCampfire: boolean; readonly dt: number;
}): void {
  const c = opts.p.combat;
  c.wellFedTimer = Math.max(0, c.wellFedTimer - opts.dt);
  c.restedTimer = Math.max(0, c.restedTimer - opts.dt);
  updateHearthWarmth(c, opts.nearCampfire, opts.dt);
  if (c.respawnTimer > 0) return;
  const regen = computeSurvivalRegen({ wellFedTimer: c.wellFedTimer, restedTimer: c.restedTimer, hitTimer: c.hitTimer });
  if (regen.hpPerSec > 0) c.hp = Math.min(c.maxHp, c.hp + regen.hpPerSec * opts.dt);
  if (regen.staminaBonusPerSec > 0 && c.swingTimer <= 0 && c.dodgeTimer <= 0) {
    c.stamina = Math.min(c.maxStamina, c.stamina + regen.staminaBonusPerSec * opts.dt);
  }
}

export function applySavedPlayerRecord(p: CombatPlayerRef & { x: number; y: number; elevation: number; appearance: PersistedPlayerRecord["appearance"] }, rec: PersistedPlayerRecord): void {
  p.x = rec.x;
  p.y = rec.y;
  p.elevation = rec.elevation;
  p.appearance = sanitizeCharacterAppearance(rec.appearance);
  p.inventory = cloneInventoryState(rec.inventory);
  p.combat.wellFedTimer = rec.wellFedTimer ?? 0;
  p.combat.restedTimer = rec.restedTimer ?? 0;
}

export function buildPersistedPlayerList(opts: {
  readonly activePlayers: Iterable<{ readonly id: string; readonly name: string; readonly x: number; readonly y: number; readonly elevation: number; readonly appearance: PersistedPlayerRecord["appearance"]; readonly inventory: PersistedPlayerRecord["inventory"]; readonly combat: CombatPlayerRef["combat"] }>;
  readonly savedProfiles: Map<string, PersistedPlayerRecord>;
  readonly normalizeName: (name: string) => string;
  readonly discoveryFor?: ((playerId: string) => PersistedPlayerRecord["discovery"]) | undefined;
}): readonly PersistedPlayerRecord[] {
  for (const p of opts.activePlayers) {
    const key = opts.normalizeName(p.name);
    const discovery = opts.discoveryFor?.(p.id);
    opts.savedProfiles.set(key, {
      ownerKey: key, x: p.x, y: p.y, elevation: p.elevation,
      appearance: p.appearance, inventory: cloneInventoryState(p.inventory),
      wellFedTimer: p.combat.wellFedTimer, restedTimer: p.combat.restedTimer,
      ...(discovery ? { discovery } : {}),
    });
  }
  return Array.from(opts.savedProfiles.values());
}

export function indexSavedPlayers(file: PersistedWorldFile): Map<string, PersistedPlayerRecord> {
  const map = new Map<string, PersistedPlayerRecord>();
  for (const p of file.players) map.set(p.ownerKey, p);
  return map;
}

export function computeEffectiveStealthVis(p: CombatPlayerRef, baseVisibility: number): number {
  const shadowBuff = p.combat.buffKind === "shadow" && p.combat.buffTimer > 0 ? -0.35 : 0;
  const shift = resolvePlayerGear(p).stealthVisMult + shadowBuff;
  return clamp(baseVisibility * clamp(1 + shift, 0.35, 1.35), 0.05, 1);
}

export function setPlayerAimVec(p: { aimX: number; aimY: number; facingX: number; facingY: number }, ax: number, ay: number): void {
  p.aimX = ax; p.aimY = ay; p.facingX = ax; p.facingY = ay;
}

export function applyPlayerAimInput(
  p: { aimX: number; aimY: number; facingX: number; facingY: number; hasExplicitAim: boolean },
  input: { readonly aimX?: number | undefined; readonly aimY?: number | undefined },
): void {
  if (input.aimX === undefined || input.aimY === undefined) { p.hasExplicitAim = false; return; }
  const mag = Math.hypot(input.aimX, input.aimY);
  if (mag <= 0.05) { p.hasExplicitAim = false; return; }
  setPlayerAimVec(p, input.aimX / mag, input.aimY / mag);
  p.hasExplicitAim = true;
}

export function buildPlayerSnapshotRecord(
  p: CombatPlayerRef & {
    readonly name: string; readonly appearance: PersistedPlayerRecord["appearance"];
    readonly jumpZ: number; readonly jumpVz: number; readonly moving: boolean; readonly sprinting: boolean;
    readonly crouching: boolean; readonly stealthVis: number; readonly inCover: boolean;
    readonly attackFlashTimer: number; readonly torchLit: boolean; readonly inWater: boolean;
    readonly inDeepWater: boolean; readonly lastAckSeq: number;
  },
  extra: { readonly hasBedRespawn: boolean; readonly bubble: PlayerBubble | undefined },
): PlayerSnapshot {
  return {
    id: p.id, name: p.name, x: p.x, y: p.y, elevation: p.elevation, facingX: p.facingX, facingY: p.facingY, aimX: p.aimX, aimY: p.aimY,
    jumpZ: p.jumpZ, jumpVz: p.jumpVz, moving: p.moving, sprinting: p.sprinting, crouching: p.crouching,
    stealthVis: p.stealthVis, inCover: p.inCover, attackFlash: p.attackFlashTimer > 0, torchLit: p.torchLit,
    inWater: p.inWater, inDeepWater: p.inDeepWater, lastAckSeq: p.lastAckSeq, heldItem: p.inventory.slots[p.selectedHotbar]?.itemId ?? null,
    appearance: p.appearance, armor: { ...p.inventory.armor }, hasBedRespawn: extra.hasBedRespawn,
    ...(extra.bubble ? { activeBubble: extra.bubble } : {}), ...playerCombatExtras(p),
  };
}
