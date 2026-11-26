/** Dev/admin cheat actions for live combat, web, and item testing. */
import { getItemDef, maxStackForItem } from "@dc2d/content";
import { WorldChunkCache, insertIntoSlots, type WorldEvent } from "@dc2d/engine";
import type { CombatPlayerRef } from "../combatActions.js";
import type { WorldWebNetwork } from "../webs/webNetwork.js";

export interface AdminActionRequest {
  readonly action: "godMode" | "heal" | "give" | "clearWebs" | "teleport";
  readonly enabled?: boolean | undefined;
  readonly itemId?: string | undefined;
  readonly count?: number | undefined;
  readonly x?: number | undefined;
  readonly y?: number | undefined;
}

function clearPlayerStatusAndVitals(p: CombatPlayerRef): void {
  const c = p.combat;
  c.hp = c.maxHp; c.stamina = c.maxStamina; c.respawnTimer = 0;
  c.hitTimer = 0; c.staggerTimer = 0;
  c.bleedTimer = 0; c.burnTimer = 0; c.burnTickAcc = 0;
  c.poisonTimer = 0; c.poisonTickAcc = 0; c.poisonLocked = false;
  c.webSlowTimer = 0; c.webStick = 0; c.webStuckSec = 0;
  c.cocoonProgress = 0; c.cocoonHp = 0; c.cocoonBurning = false;
}

function clearPlayerWebsOnly(p: CombatPlayerRef, webs: WorldWebNetwork): void {
  const c = p.combat;
  c.webSlowTimer = 0; c.webStick = 0; c.webStuckSec = 0;
  c.cocoonProgress = 0; c.cocoonHp = 0; c.cocoonBurning = false; c.poisonLocked = false;
  webs.clearAround(p.x, p.y, 14);
}

function applyGodToggle(p: CombatPlayerRef, enabled?: boolean): false {
  const on = enabled ?? !p.combat.godMode;
  p.combat.godMode = on;
  if (on) { p.combat.hp = p.combat.maxHp; p.combat.stamina = p.combat.maxStamina; p.combat.respawnTimer = 0; }
  return false;
}

function applyGiveItem(p: CombatPlayerRef, itemId?: string, count = 1): boolean {
  if (!itemId || !getItemDef(itemId)) return false;
  return insertIntoSlots(p.inventory.slots, { itemId, count }, maxStackForItem) > 0;
}

function applyTeleport(p: CombatPlayerRef, cache: WorldChunkCache, req: AdminActionRequest): boolean {
  if (req.x === undefined || req.y === undefined || !Number.isFinite(req.x) || !Number.isFinite(req.y)) return false;
  p.x = req.x;
  p.y = req.y;
  p.elevation = cache.tileAt(Math.floor(req.x), Math.floor(req.y)).elevation;
  return true;
}

export function applyAdminAction(opts: {
  readonly player: CombatPlayerRef; readonly cache: WorldChunkCache; readonly webs: WorldWebNetwork; readonly events: WorldEvent[]; readonly req: AdminActionRequest;
}): boolean {
  const { player, cache, webs, events, req } = opts;
  if (req.action === "godMode") return applyGodToggle(player, req.enabled);
  if (req.action === "heal") {
    clearPlayerStatusAndVitals(player);
    events.push({ kind: "heal", x: player.x, y: player.y, value: player.combat.maxHp, actorId: player.id });
    return false;
  }
  if (req.action === "clearWebs") { clearPlayerWebsOnly(player, webs); return false; }
  if (req.action === "teleport") return applyTeleport(player, cache, req);
  return req.action === "give" && applyGiveItem(player, req.itemId, req.count);
}
