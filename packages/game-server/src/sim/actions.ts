import {
  ATTACK_COOLDOWN_MS,
  CHUNK_SIZE,
  FIST_DAMAGE,
  INTERACT_RANGE,
  KNOCKBACK_FORCE,
  MAX_THROW_RANGE,
  REVIVE_HP_FRACTION,
  THROW_SPEED,
  TICK_RATE,
  TILE,
  applyKnockback,
  createBody,
  faceEntity,
  launchVelocity,
  makeEntity,
  newEntityId,
  partyRoomSpawn,
  personalRoomSpawn,
  pickMeleeTarget,
  safeRoomSpawn,
  type EffectEvent,
} from "@dc2d/engine";
import { adjacentToTile, combatants, effectTargetFor } from "./helpers";
import { doCraft, doDrop, doPickup, doStash, invIndex, invQty, invRemove } from "./inventory";
import { doChat, doParty } from "./social";
import { findSpawn } from "./spawn";
import type { PlayerSlot, SimState } from "./state";

/** Queued player actions: combat, item use, doors, and delegation to
 * inventory/social modules. Downed players can only interact (revive
 * flows) and manage party/chat. */

export function processActions(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const slot of sim.players.values()) {
    const actions = slot.pendingActions.splice(0);
    if (slot.entity.hp <= 0) continue;
    for (const action of actions) {
      switch (action.type) {
        case "attack":
          if (slot.downedAtTick === null) doAttack(sim, slot, action.dirX, action.dirY, effectEvents);
          break;
        case "useSlot":
          if (slot.downedAtTick === null)
            doUseSlot(sim, slot, action.slot, action.targetX, action.targetY, effectEvents);
          break;
        case "pickup":
          if (slot.downedAtTick === null) doPickup(sim, slot);
          break;
        case "drop":
          if (slot.downedAtTick === null) doDrop(sim, slot, action.item);
          break;
        case "assign":
          // Bind an owned def (or clear) — the hotbar holds references.
          if (action.item === null || invIndex(slot, action.item) >= 0) {
            slot.hotbar[action.slot] = action.item;
          }
          break;
        case "equip":
          if (action.item === null) {
            slot.weapon = null;
          } else if (
            invIndex(slot, action.item) >= 0 &&
            sim.content.items.get(action.item)?.weapon
          ) {
            slot.weapon = action.item;
          }
          break;
        case "interact":
          doInteract(sim, slot, effectEvents);
          break;
        case "craft":
          if (slot.downedAtTick === null) doCraft(sim, slot, action.recipe);
          break;
        case "stash":
          if (slot.downedAtTick === null) doStash(sim, slot, action.op, action.index);
          break;
        case "party":
          doParty(sim, slot, action.op, action.target);
          break;
        case "chat":
          doChat(sim, slot, action.channel, action.text);
          break;
        case "debug":
          // Dev harness only — a production shard drops these outright.
          if (!sim.opts.debugCommands) break;
          if (action.op === "god") {
            slot.god = action.on ?? true;
            slot.outbox.push({ t: "toast", msg: slot.god ? "God mode ON" : "God mode off" });
          } else if (
            action.op === "teleport" &&
            Number.isFinite(action.x) &&
            Number.isFinite(action.y)
          ) {
            teleport(sim, slot, { x: action.x!, y: action.y! }, { remember: false });
          }
          break;
      }
    }
  }
}

const ATTACK_COOLDOWN_TICKS = Math.round((ATTACK_COOLDOWN_MS / 1000) * TICK_RATE);

function doAttack(
  sim: SimState,
  slot: PlayerSlot,
  dirX: number,
  dirY: number,
  effectEvents: EffectEvent[],
): void {
  const attacker = slot.entity;
  faceEntity(attacker, dirX, dirY);
  if (sim.effects.inSanctuary(attacker)) return; // no fighting in safe rooms
  if (sim.tickCount < slot.attackReadyAtTick) return; // swing still recovering
  slot.attackReadyAtTick = sim.tickCount + ATTACK_COOLDOWN_TICKS;
  // Melee swings use the EQUIPPED weapon (character slot, not hotbar).
  const weaponDef = slot.weapon ? sim.content.items.get(slot.weapon) : undefined;
  const weapon = weaponDef?.weapon;
  const weaponTags = weaponDef?.tags ?? [];

  const victim = pickMeleeTarget(attacker, dirX, dirY, combatants(sim), (target) =>
    target.kind === "player" &&
    slot.partyId !== null &&
    sim.players.get(target.id)?.partyId === slot.partyId,
  );
  if (!victim) return;

  const damage = weapon?.damage ?? FIST_DAMAGE;
  const target = effectTargetFor(sim, victim);
  sim.effects.modifyHealth(victim, -damage, effectEvents, { sourceTags: weaponTags }, target);
  for (const apply of weapon?.applies ?? []) {
    if (sim.rng.next() < apply.chance) {
      sim.effects.applyStatus(victim, apply.status, effectEvents, target);
    }
  }
  applyKnockback(
    victim.body,
    victim.body.x - attacker.body.x,
    victim.body.y - attacker.body.y,
    KNOCKBACK_FORCE,
  );
  if (victim.kind === "player" && sim.players.get(victim.id)?.downedAtTick !== null) {
    // Striking a downed player finishes them.
    const vSlot = sim.players.get(victim.id);
    if (vSlot && vSlot.downedAtTick !== null) victim.hp = 0;
    if (victim.hp <= 0) effectEvents.push({ t: "death", id: victim.id });
  }
}

/** Use whatever def is bound to a hotbar slot, consuming from inventory. */
function doUseSlot(
  sim: SimState,
  slot: PlayerSlot,
  index: number,
  targetX: number | undefined,
  targetY: number | undefined,
  effectEvents: EffectEvent[],
): void {
  const defId = slot.hotbar[index];
  if (!defId) return;
  const def = sim.content.items.get(defId);
  if (!def || invQty(slot, defId) < 1) return;

  if (targetX !== undefined && targetY !== undefined && def.throwable) {
    const from = slot.entity.body;
    let dx = targetX - from.x;
    let dy = targetY - from.y;
    const dist = Math.hypot(dx, dy);
    faceEntity(slot.entity, dx, dy);
    if (dist > MAX_THROW_RANGE) {
      dx *= MAX_THROW_RANGE / dist;
      dy *= MAX_THROW_RANGE / dist;
    }
    const to = {
      x: from.x + dx,
      y: from.y + dy,
      z: sim.world.groundAt(from.x + dx, from.y + dy),
    };
    const projectile = makeEntity("projectile", createBody(from.x, from.y, from.z + 1), {
      id: newEntityId("j"),
      defId,
      ownerId: slot.entity.id,
      tags: new Set(def.tags),
      vel: launchVelocity({ x: from.x, y: from.y, z: from.z + 1 }, to, THROW_SPEED),
    });
    sim.projectiles.set(projectile.id, projectile);
    invRemove(slot, defId, 1);
    return;
  }

  if (def.consumable) {
    sim.effects.runPrimitives(
      slot.entity,
      def.consumable.effects,
      effectEvents,
      {},
      () => sim.rng.next(),
    );
    invRemove(slot, defId, 1);
  }
}

function doInteract(sim: SimState, slot: PlayerSlot, effectEvents: EffectEvent[]): void {
  const body = slot.entity.body;

  // 1. Revive a downed party member.
  if (slot.partyId) {
    for (const other of sim.players.values()) {
      if (other === slot || other.partyId !== slot.partyId || other.downedAtTick === null) continue;
      const d = Math.hypot(other.entity.body.x - body.x, other.entity.body.y - body.y);
      if (d <= INTERACT_RANGE) {
        other.downedAtTick = null;
        delete other.entity.downedUntil;
        other.entity.hp = Math.max(1, Math.round(other.entity.maxHp * REVIVE_HP_FRACTION));
        other.outbox.push({ t: "toast", msg: `${slot.entity.name} got you back up!` });
        slot.outbox.push({ t: "toast", msg: `You revived ${other.entity.name}` });
        effectEvents.push({ t: "hp", id: other.entity.id, delta: other.entity.hp, hp: other.entity.hp });
        return;
      }
    }
  }
  if (slot.downedAtTick !== null) return;

  // 2. Doors (standing on) and interactables (adjacent).
  const tileX = Math.floor(body.x);
  const tileY = Math.floor(body.y);
  const tile = sim.world.tileAt(tileX, tileY);
  if (tile === TILE.DoorSafeRoom) {
    const doorCx = Math.floor(tileX / CHUNK_SIZE);
    const doorCy = Math.floor(tileY / CHUNK_SIZE);
    teleport(sim, slot, safeRoomSpawn(doorCx, doorCy), { remember: true });
    slot.outbox.push({ t: "toast", msg: "The safe room. No fighting in here." });
    return;
  }
  if (tile === TILE.DoorPersonal) {
    teleport(sim, slot, personalRoomSpawn(slot.stored.slot), { remember: true });
    slot.outbox.push({ t: "toast", msg: "Your room. Stash and crafting table inside." });
    return;
  }
  if (tile === TILE.DoorParty) {
    if (!slot.partyId) {
      slot.outbox.push({ t: "toast", msg: "You're not in a party" });
      return;
    }
    const party = sim.parties.get(slot.partyId)!;
    party.roomSlot ??= sim.nextPartyRoom++;
    teleport(sim, slot, partyRoomSpawn(party.roomSlot), { remember: true });
    slot.outbox.push({ t: "toast", msg: "The party room" });
    return;
  }
  if (tile === TILE.DoorExit) {
    const back = slot.returnStack.pop() ?? findSpawn(sim);
    teleport(sim, slot, back, { remember: false });
    return;
  }

  // 3. Stash chest adjacent → send contents (opens the panel).
  if (adjacentToTile(sim, tileX, tileY, TILE.Stash)) {
    slot.outbox.push({ t: "stash", slots: slot.stored.stash.map((s) => ({ ...s })) });
    return;
  }
}

function teleport(
  sim: SimState,
  slot: PlayerSlot,
  to: { x: number; y: number; z?: number },
  opts: { remember: boolean },
): void {
  if (opts.remember) {
    slot.returnStack.push({ x: slot.entity.body.x, y: slot.entity.body.y, z: slot.entity.body.z });
    if (slot.returnStack.length > 4) slot.returnStack.shift();
  }
  const z = to.z ?? sim.world.groundAt(to.x, to.y);
  slot.entity.body = createBody(to.x, to.y, z);
  slot.needsFullAreas = true;
  slot.known.clear();
  slot.outbox.push({ t: "teleported" });
}
