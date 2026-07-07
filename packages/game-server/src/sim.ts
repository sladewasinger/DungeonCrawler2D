import {
  AOI_RADIUS,
  AreaSystem,
  CHUNK_SIZE,
  DOWNED_DURATION,
  EffectsEngine,
  ENEMY_ACTIVE_RADIUS,
  FALL_DAMAGE_PER_UNIT,
  FIST_DAMAGE,
  INTERACT_RANGE,
  INVENTORY_SLOTS,
  KNOCKBACK_FORCE,
  MAX_INPUTS_PER_TICK,
  MAX_THROW_RANGE,
  MIN_SPAWN_DIST,
  NEUTRAL_INPUT,
  PICKUP_RANGE,
  PLAYER_MAX_HP,
  RECONNECT_GRACE_MS,
  RESPAWN_DELAY_TICKS,
  REVIVE_HP_FRACTION,
  Rng,
  SAFE_FALL_HEIGHT,
  SPAWN_CHUNK_RANGE,
  TEST_SPAWN,
  THROW_SPEED,
  TICK_DT,
  TICK_RATE,
  TILE,
  applyKnockback,
  chunkCenter,
  createBody,
  enemyThink,
  isRoomChunk,
  launchVelocity,
  makeEntity,
  newBrain,
  newEntityId,
  personalRoomSpawn,
  partyRoomSpawn,
  safeRoomSpawn,
  pickMeleeTarget,
  stepBody,
  stepProjectile,
  type ClientInput,
  type ClientMessage,
  type ContentRegistry,
  type EffectEvent,
  type EnemyBrain,
  type EnemyDef,
  type Entity,
  type EntitySnapshot,
  type GameEvent,
  type InvSlot,
  type ServerSnapshot,
  type World,
} from "@dc2d/engine";
import { PlayerStore, type StoredPlayer } from "./store";

/**
 * The authoritative floor simulation — Epics 3–7 integrated. Still
 * transport-free: server.ts feeds it validated messages and ships out
 * the snapshots; integration tests drive it directly.
 */

interface PlayerSlot {
  entity: Entity;
  clientId: string;
  stored: StoredPlayer;
  resumeToken: string;
  lastSeq: number;
  pendingInputs: ClientInput[];
  pendingActions: Exclude<ClientMessage, ClientInput | { type: "hello" } | { type: "ping" }>[];
  connected: boolean;
  reapAtTick: number;
  known: Set<string>;
  inventory: InvSlot[];
  selectedSlot: number;
  /** Private per-player events (toasts, stash contents, invites…). */
  outbox: GameEvent[];
  /** Where DoorExit leads, innermost last — portals nest (world → safe room → personal). */
  returnStack: Array<{ x: number; y: number; z: number }>;
  partyId: string | null;
  respawnAtTick: number | null;
  /** Send the full area set on next snapshot (join/teleport). */
  needsFullAreas: boolean;
  downedAtTick: number | null;
}

interface EnemySlot {
  entity: Entity;
  brain: EnemyBrain;
  def: EnemyDef;
}

interface Party {
  id: string;
  members: Set<string>;
  roomSlot: number | null;
}

export interface JoinResult {
  playerId: string;
  resumeToken: string;
  spawn: { x: number; y: number; z: number };
  resumed: boolean;
}

const GRACE_TICKS = Math.ceil((RECONNECT_GRACE_MS / 1000) * TICK_RATE);
const INVITE_TTL_TICKS = 30 * TICK_RATE;
const ITEM_CHAR_SECONDS = 3;

/**
 * Deterministic dev-test-zone fixtures: one example of everything the
 * Epic 3–7 systems introduced, findable right at spawn (28.5, 28.5) so
 * every mechanic is testable without hunting (see ROADMAP per-epic
 * "in-game examples" bullets). Also e2e fixtures — keep positions stable.
 */
// The slime pit at (20..24, 42) is the e2e combat arena — the other
// enemy examples live in the west/north corners, outside aggro range
// of both the arena and the walking routes.
const TEST_ZONE_ENEMIES: Array<{ def: string; x: number; y: number }> = [
  { def: "slime", x: 20.5, y: 42.5 },
  { def: "slime", x: 23.5, y: 42.5 },
  { def: "plant-creeper", x: 8.5, y: 36.5 },
  { def: "skeleton", x: 8.5, y: 14.5 },
  { def: "spitter", x: 12.5, y: 20.5 },
];

/** Weapons, ingredients, throwables, and consumables on the ground at spawn. */
const TEST_ZONE_ITEMS: Array<{ def: string; x: number; y: number; qty?: number }> = [
  { def: "sword", x: 30.5, y: 27.5 },
  { def: "hammer", x: 31.5, y: 28.5 },
  { def: "knife", x: 30.5, y: 29.5 },
  { def: "torch", x: 27.5, y: 26.5 },
  { def: "vodka-bottle", x: 28.5, y: 26.5 },
  { def: "water-flask", x: 29.5, y: 26.5 },
  { def: "bandage", x: 26.5, y: 28.5, qty: 2 },
  { def: "rag", x: 26.5, y: 29.5, qty: 2 },
  { def: "stick", x: 27.5, y: 30.5 },
  { def: "raw-meat", x: 28.5, y: 30.5 },
];

/** Standing hazards near spawn; reseeded when they burn/decay away. */
const TEST_ZONE_HAZARDS: Array<{ def: string; x: number; y: number; radius: number }> = [
  { def: "area-fire", x: 34, y: 24, radius: 1 },
  { def: "area-poison", x: 18, y: 33, radius: 1 },
  { def: "area-oil", x: 36, y: 31, radius: 1 },
  { def: "area-wet", x: 31, y: 32, radius: 1 },
];
const HAZARD_RESEED_TICKS = 5 * TICK_RATE;

export class GameSim {
  private readonly players = new Map<string, PlayerSlot>();
  private readonly byToken = new Map<string, string>();
  private readonly enemies = new Map<string, EnemySlot>();
  private readonly items = new Map<string, Entity>();
  private readonly projectiles = new Map<string, Entity>();
  private readonly parties = new Map<string, Party>();
  private readonly invites = new Map<string, { from: string; expiresAt: number }>();
  private readonly activatedChunks = new Set<string>();
  private readonly exposure = new Map<string, number>();
  /** Positional events delivered to anyone whose AOI covers (x, y). */
  private worldEvents: Array<{ ev: GameEvent; x: number; y: number }> = [];
  private readonly rng: Rng;
  readonly effects: EffectsEngine;
  readonly areas: AreaSystem;
  private tickCount = 0;
  private nextPartyId = 1;
  private nextPartyRoom = 0;
  /** True once the test-zone chunk activated — keeps hazard fixtures seeded. */
  private hazardsActive = false;

  constructor(
    readonly world: World,
    private readonly content: ContentRegistry,
    private readonly store: PlayerStore = new PlayerStore(null),
    rngSeed = 1,
    private readonly opts: {
      /** e2e scaffolding: spawn players together at the proving ground. */
      clusterSpawns?: boolean;
    } = {},
  ) {
    this.rng = new Rng(rngSeed);
    this.effects = new EffectsEngine(content, (x, y) => world.isSanctuary(x, y));
    this.areas = new AreaSystem(content, world);
  }

  get tick(): number {
    return this.tickCount;
  }

  get playerCount(): number {
    return this.players.size;
  }

  get enemyCount(): number {
    return this.enemies.size;
  }

  // ── join / leave ─────────────────────────────────────────────────

  addPlayer(name: string, clientId: string, resumeToken?: string): JoinResult {
    if (resumeToken) {
      const existingId = this.byToken.get(resumeToken);
      const slot = existingId ? this.players.get(existingId) : undefined;
      if (slot && !slot.connected && slot.clientId === clientId) {
        slot.connected = true;
        slot.pendingInputs.length = 0;
        slot.pendingActions.length = 0;
        slot.lastSeq = -1;
        slot.needsFullAreas = true;
        return {
          playerId: slot.entity.id,
          resumeToken: slot.resumeToken,
          spawn: { x: slot.entity.body.x, y: slot.entity.body.y, z: slot.entity.body.z },
          resumed: true,
        };
      }
    }

    const stored = this.store.get(clientId, name);
    const spawn = this.findSpawn();
    const entity = makeEntity("player", createBody(spawn.x, spawn.y, spawn.z), {
      id: newEntityId("p"),
      name,
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      baseSpeed: 8,
      tags: new Set(["player", "organic"]),
    });
    const token = this.newToken();
    const slot: PlayerSlot = {
      entity,
      clientId,
      stored,
      resumeToken: token,
      lastSeq: -1,
      pendingInputs: [],
      pendingActions: [],
      connected: true,
      reapAtTick: Number.MAX_SAFE_INTEGER,
      known: new Set(),
      inventory: Array(INVENTORY_SLOTS).fill(null),
      selectedSlot: 0,
      outbox: [],
      returnStack: [],
      partyId: null,
      respawnAtTick: null,
      needsFullAreas: true,
      downedAtTick: null,
    };
    this.players.set(entity.id, slot);
    this.byToken.set(token, entity.id);
    return { playerId: entity.id, resumeToken: token, spawn, resumed: false };
  }

  markDisconnected(playerId: string): void {
    const slot = this.players.get(playerId);
    if (!slot) return;
    slot.connected = false;
    slot.reapAtTick = this.tickCount + GRACE_TICKS;
  }

  handleInput(playerId: string, input: ClientInput): void {
    const slot = this.players.get(playerId);
    if (!slot || !slot.connected) return;
    if (input.seq <= slot.lastSeq) return;
    slot.pendingInputs.push(input);
  }

  queueAction(playerId: string, msg: PlayerSlot["pendingActions"][number]): void {
    const slot = this.players.get(playerId);
    if (!slot || !slot.connected) return;
    if (slot.pendingActions.length < 16) slot.pendingActions.push(msg);
  }

  getPlayerEntity(playerId: string): Entity | undefined {
    return this.players.get(playerId)?.entity;
  }

  getInventory(playerId: string): InvSlot[] | undefined {
    return this.players.get(playerId)?.inventory;
  }

  /** Test access: spawn an item entity on the ground. */
  spawnItem(defId: string, x: number, y: number, qty = 1): Entity {
    const item = makeEntity("item", createBody(x, y, this.world.heightAt(Math.floor(x), Math.floor(y))), {
      id: newEntityId("i"),
      defId,
      qty,
      tags: new Set(this.content.items.get(defId)?.tags ?? []),
    });
    this.items.set(item.id, item);
    return item;
  }

  /** Test access: spawn an enemy. */
  spawnEnemy(defId: string, x: number, y: number): Entity {
    const def = this.content.enemies.get(defId);
    if (!def) throw new Error(`unknown enemy ${defId}`);
    const entity = makeEntity("enemy", createBody(x, y, this.world.heightAt(Math.floor(x), Math.floor(y))), {
      id: newEntityId("e"),
      defId,
      name: def.name,
      hp: def.hp,
      maxHp: def.hp,
      baseSpeed: def.speed,
      tags: new Set(def.tags),
    });
    this.enemies.set(entity.id, { entity, brain: newBrain(), def });
    return entity;
  }

  // ── main tick ────────────────────────────────────────────────────

  step(): Map<string, ServerSnapshot> {
    this.tickCount++;
    const effectEvents: EffectEvent[] = [];

    this.reapAndRespawn();
    this.stepPlayers(effectEvents);
    this.processActions(effectEvents);
    this.activateChunksNearPlayers();
    if (this.hazardsActive && this.tickCount % HAZARD_RESEED_TICKS === 0) {
      this.seedTestZoneHazards();
    }
    this.stepEnemies(effectEvents);
    this.stepProjectiles(effectEvents);
    this.areas.tick(TICK_DT, () => this.rng.next());
    this.applyAreaContact(effectEvents);
    this.tickStatuses(effectEvents);
    this.realizeEffectEvents(effectEvents);
    this.resolveDeaths();

    return this.buildSnapshots();
  }

  // ── players ──────────────────────────────────────────────────────

  private reapAndRespawn(): void {
    for (const [id, slot] of this.players) {
      if (!slot.connected && this.tickCount >= slot.reapAtTick) {
        this.dropAllInventory(slot);
        this.leaveParty(slot);
        this.players.delete(id);
        this.byToken.delete(slot.resumeToken);
        continue;
      }
      if (slot.respawnAtTick !== null && this.tickCount >= slot.respawnAtTick) {
        slot.respawnAtTick = null;
        const spawn = this.findSpawn();
        slot.entity.body = createBody(spawn.x, spawn.y, spawn.z);
        slot.entity.hp = PLAYER_MAX_HP;
        slot.entity.statuses = [];
        slot.downedAtTick = null;
        delete slot.entity.downedUntil;
        slot.returnStack = [];
        slot.needsFullAreas = true;
        slot.outbox.push({ t: "teleported" }, { t: "toast", msg: "You wake up somewhere else…" });
      }
    }
  }

  private stepPlayers(effectEvents: EffectEvent[]): void {
    for (const slot of this.players.values()) {
      const entity = slot.entity;
      if (entity.hp <= 0 || slot.downedAtTick !== null) {
        slot.pendingInputs.length = 0;
        continue;
      }
      const tags = this.effects.tagsOf(entity);
      const opts = {
        speed: entity.baseSpeed * this.effects.speedMult(entity),
        stickyFeet: tags.has("sticky-feet"),
      };
      const inputs = slot.pendingInputs.splice(0, MAX_INPUTS_PER_TICK);
      slot.pendingInputs.length = 0;
      if (inputs.length === 0) {
        const result = stepBody(this.world, entity.body, NEUTRAL_INPUT, TICK_DT, opts);
        if (result.landed) this.handleLanding(entity, result.landed.fallHeight, tags, effectEvents);
      } else {
        for (const input of inputs) {
          const result = stepBody(this.world, entity.body, input, TICK_DT, opts);
          slot.lastSeq = input.seq;
          if (result.landed) this.handleLanding(entity, result.landed.fallHeight, tags, effectEvents);
        }
      }
    }
  }

  private handleLanding(
    entity: Entity,
    fallHeight: number,
    tags: Set<string>,
    effectEvents: EffectEvent[],
  ): void {
    if (fallHeight <= SAFE_FALL_HEIGHT) return;
    if (tags.has("feather-fall")) return;
    // Landing in liquid (wet/oil pools) breaks the fall.
    if (this.areas.hasTagAt(Math.floor(entity.body.x), Math.floor(entity.body.y), "liquid")) return;
    const damage = -(fallHeight - SAFE_FALL_HEIGHT) * FALL_DAMAGE_PER_UNIT;
    this.effects.modifyHealth(entity, damage, effectEvents, { sourceTags: ["fall"] });
  }

  // ── player actions ───────────────────────────────────────────────

  private processActions(effectEvents: EffectEvent[]): void {
    for (const slot of this.players.values()) {
      const actions = slot.pendingActions.splice(0);
      if (slot.entity.hp <= 0) continue;
      for (const action of actions) {
        switch (action.type) {
          case "attack":
            if (slot.downedAtTick === null) this.doAttack(slot, action.dirX, action.dirY, effectEvents);
            break;
          case "useSlot":
            if (slot.downedAtTick === null)
              this.doUseSlot(slot, action.slot, action.targetX, action.targetY, effectEvents);
            break;
          case "pickup":
            if (slot.downedAtTick === null) this.doPickup(slot);
            break;
          case "drop":
            if (slot.downedAtTick === null) this.doDrop(slot, action.slot);
            break;
          case "selectSlot":
            slot.selectedSlot = action.slot;
            break;
          case "interact":
            this.doInteract(slot, effectEvents);
            break;
          case "craft":
            if (slot.downedAtTick === null) this.doCraft(slot, action.recipe);
            break;
          case "stash":
            if (slot.downedAtTick === null) this.doStash(slot, action.op, action.index);
            break;
          case "party":
            this.doParty(slot, action.op, action.target);
            break;
          case "chat":
            this.doChat(slot, action.channel, action.text);
            break;
        }
      }
    }
  }

  private combatants(): Entity[] {
    const out: Entity[] = [];
    for (const slot of this.players.values()) out.push(slot.entity);
    for (const enemy of this.enemies.values()) out.push(enemy.entity);
    return out;
  }

  private doAttack(slot: PlayerSlot, dirX: number, dirY: number, effectEvents: EffectEvent[]): void {
    const attacker = slot.entity;
    if (this.effects.inSanctuary(attacker)) return; // no fighting in safe rooms
    const weaponSlot = slot.inventory[slot.selectedSlot];
    const weapon = weaponSlot ? this.content.items.get(weaponSlot.item)?.weapon : undefined;
    const weaponTags = weaponSlot ? (this.content.items.get(weaponSlot.item)?.tags ?? []) : [];

    const victim = pickMeleeTarget(attacker, dirX, dirY, this.combatants(), (target) =>
      target.kind === "player" &&
      slot.partyId !== null &&
      this.players.get(target.id)?.partyId === slot.partyId,
    );
    if (!victim) return;

    const damage = weapon?.damage ?? FIST_DAMAGE;
    const target = this.effectTargetFor(victim);
    this.effects.modifyHealth(victim, -damage, effectEvents, { sourceTags: weaponTags }, target);
    for (const apply of weapon?.applies ?? []) {
      if (this.rng.next() < apply.chance) {
        this.effects.applyStatus(victim, apply.status, effectEvents, target);
      }
    }
    applyKnockback(
      victim.body,
      victim.body.x - attacker.body.x,
      victim.body.y - attacker.body.y,
      KNOCKBACK_FORCE,
    );
    if (victim.kind === "player" && this.players.get(victim.id)?.downedAtTick !== null) {
      // Striking a downed player finishes them.
      const vSlot = this.players.get(victim.id);
      if (vSlot && vSlot.downedAtTick !== null) victim.hp = 0;
      if (victim.hp <= 0) effectEvents.push({ t: "death", id: victim.id });
    }
  }

  private doUseSlot(
    slot: PlayerSlot,
    index: number,
    targetX: number | undefined,
    targetY: number | undefined,
    effectEvents: EffectEvent[],
  ): void {
    const inv = slot.inventory[index];
    if (!inv) return;
    const def = this.content.items.get(inv.item);
    if (!def) return;

    if (targetX !== undefined && targetY !== undefined && def.throwable) {
      const from = slot.entity.body;
      let dx = targetX - from.x;
      let dy = targetY - from.y;
      const dist = Math.hypot(dx, dy);
      if (dist > MAX_THROW_RANGE) {
        dx *= MAX_THROW_RANGE / dist;
        dy *= MAX_THROW_RANGE / dist;
      }
      const to = {
        x: from.x + dx,
        y: from.y + dy,
        z: this.world.heightAt(Math.floor(from.x + dx), Math.floor(from.y + dy)),
      };
      const projectile = makeEntity("projectile", createBody(from.x, from.y, from.z + 1), {
        id: newEntityId("j"),
        defId: inv.item,
        ownerId: slot.entity.id,
        tags: new Set(def.tags),
        vel: launchVelocity({ x: from.x, y: from.y, z: from.z + 1 }, to, THROW_SPEED),
      });
      this.projectiles.set(projectile.id, projectile);
      this.consumeFromSlot(slot, index);
      return;
    }

    if (def.consumable) {
      this.effects.runPrimitives(
        slot.entity,
        def.consumable.effects,
        effectEvents,
        {},
        () => this.rng.next(),
      );
      this.consumeFromSlot(slot, index);
    }
  }

  private consumeFromSlot(slot: PlayerSlot, index: number): void {
    const inv = slot.inventory[index];
    if (!inv) return;
    inv.qty--;
    if (inv.qty <= 0) slot.inventory[index] = null;
  }

  private doPickup(slot: PlayerSlot): void {
    const body = slot.entity.body;
    let best: Entity | null = null;
    let bestDist = PICKUP_RANGE;
    for (const item of this.items.values()) {
      const d = Math.hypot(item.body.x - body.x, item.body.y - body.y);
      if (d <= bestDist) {
        bestDist = d;
        best = item;
      }
    }
    if (!best?.defId) return;
    const leftover = this.addToInventory(slot, best.defId, best.qty);
    if (leftover === 0) {
      this.items.delete(best.id);
      this.exposure.delete(best.id);
    } else if (leftover < best.qty) {
      best.qty = leftover;
    } else {
      slot.outbox.push({ t: "toast", msg: "Inventory full" });
    }
  }

  /** Returns leftover quantity that didn't fit. */
  private addToInventory(slot: PlayerSlot, defId: string, qty: number): number {
    const def = this.content.items.get(defId);
    if (!def) return qty;
    let remaining = qty;
    for (let i = 0; i < slot.inventory.length && remaining > 0; i++) {
      const s = slot.inventory[i];
      if (s && s.item === defId && s.qty < def.maxStack) {
        const take = Math.min(def.maxStack - s.qty, remaining);
        s.qty += take;
        remaining -= take;
      }
    }
    for (let i = 0; i < slot.inventory.length && remaining > 0; i++) {
      if (slot.inventory[i] === null) {
        const take = Math.min(def.maxStack, remaining);
        slot.inventory[i] = { item: defId, qty: take };
        remaining -= take;
      }
    }
    return remaining;
  }

  private doDrop(slot: PlayerSlot, index: number): void {
    const inv = slot.inventory[index];
    if (!inv) return;
    slot.inventory[index] = null;
    this.spawnItem(inv.item, slot.entity.body.x, slot.entity.body.y, inv.qty);
  }

  private dropAllInventory(slot: PlayerSlot): void {
    for (let i = 0; i < slot.inventory.length; i++) {
      const inv = slot.inventory[i];
      if (!inv) continue;
      slot.inventory[i] = null;
      // Scatter a little so stacks are visible/lootable.
      const jx = (this.rng.next() - 0.5) * 1.5;
      const jy = (this.rng.next() - 0.5) * 1.5;
      this.spawnItem(inv.item, slot.entity.body.x + jx, slot.entity.body.y + jy, inv.qty);
    }
  }

  private doInteract(slot: PlayerSlot, effectEvents: EffectEvent[]): void {
    const body = slot.entity.body;

    // 1. Revive a downed party member.
    if (slot.partyId) {
      for (const other of this.players.values()) {
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
    const tile = this.world.tileAt(tileX, tileY);
    if (tile === TILE.DoorSafeRoom) {
      const doorCx = Math.floor(tileX / CHUNK_SIZE);
      const doorCy = Math.floor(tileY / CHUNK_SIZE);
      this.teleport(slot, safeRoomSpawn(doorCx, doorCy), { remember: true });
      slot.outbox.push({ t: "toast", msg: "The safe room. No fighting in here." });
      return;
    }
    if (tile === TILE.DoorPersonal) {
      this.teleport(slot, personalRoomSpawn(slot.stored.slot), { remember: true });
      slot.outbox.push({ t: "toast", msg: "Your room. Stash and crafting table inside." });
      return;
    }
    if (tile === TILE.DoorParty) {
      if (!slot.partyId) {
        slot.outbox.push({ t: "toast", msg: "You're not in a party" });
        return;
      }
      const party = this.parties.get(slot.partyId)!;
      party.roomSlot ??= this.nextPartyRoom++;
      this.teleport(slot, partyRoomSpawn(party.roomSlot), { remember: true });
      slot.outbox.push({ t: "toast", msg: "The party room" });
      return;
    }
    if (tile === TILE.DoorExit) {
      const back = slot.returnStack.pop() ?? this.findSpawn();
      this.teleport(slot, back, { remember: false });
      return;
    }

    // 3. Stash chest adjacent → send contents (opens the panel).
    if (this.adjacentToTile(tileX, tileY, TILE.Stash)) {
      slot.outbox.push({ t: "stash", slots: slot.stored.stash.map((s) => ({ ...s })) });
      return;
    }
  }

  private adjacentToTile(tileX: number, tileY: number, tile: number): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (this.world.tileAt(tileX + dx, tileY + dy) === tile) return true;
      }
    }
    return false;
  }

  private teleport(
    slot: PlayerSlot,
    to: { x: number; y: number; z?: number },
    opts: { remember: boolean },
  ): void {
    if (opts.remember) {
      slot.returnStack.push({ x: slot.entity.body.x, y: slot.entity.body.y, z: slot.entity.body.z });
      if (slot.returnStack.length > 4) slot.returnStack.shift();
    }
    const z = to.z ?? this.world.heightAt(Math.floor(to.x), Math.floor(to.y));
    slot.entity.body = createBody(to.x, to.y, z);
    slot.needsFullAreas = true;
    slot.known.clear();
    slot.outbox.push({ t: "teleported" });
  }

  private doCraft(slot: PlayerSlot, recipeId: string): void {
    const recipe = this.content.recipes.get(recipeId);
    if (!recipe) return;
    const tileX = Math.floor(slot.entity.body.x);
    const tileY = Math.floor(slot.entity.body.y);
    if (!this.adjacentToTile(tileX, tileY, TILE.CraftingTable)) {
      slot.outbox.push({ t: "toast", msg: "You need a crafting table" });
      return;
    }
    // Verify inputs.
    for (const input of recipe.inputs) {
      let have = 0;
      for (const s of slot.inventory) if (s?.item === input.item) have += s.qty;
      if (have < input.qty) {
        slot.outbox.push({ t: "toast", msg: `Missing ${input.item}` });
        return;
      }
    }
    // Consume.
    for (const input of recipe.inputs) {
      let need = input.qty;
      for (let i = 0; i < slot.inventory.length && need > 0; i++) {
        const s = slot.inventory[i];
        if (!s || s.item !== input.item) continue;
        const take = Math.min(s.qty, need);
        s.qty -= take;
        need -= take;
        if (s.qty <= 0) slot.inventory[i] = null;
      }
    }
    const leftover = this.addToInventory(slot, recipe.output.item, recipe.output.qty);
    if (leftover > 0) this.spawnItem(recipe.output.item, slot.entity.body.x, slot.entity.body.y, leftover);
    slot.outbox.push({ t: "toast", msg: `Crafted ${recipe.output.item}` });
  }

  private doStash(slot: PlayerSlot, op: "put" | "take", index: number): void {
    const tileX = Math.floor(slot.entity.body.x);
    const tileY = Math.floor(slot.entity.body.y);
    if (!this.adjacentToTile(tileX, tileY, TILE.Stash)) return;
    if (op === "put") {
      const inv = slot.inventory[index];
      if (!inv) return;
      const def = this.content.items.get(inv.item);
      if (!def) return;
      if (this.store.stashAdd(slot.stored, inv.item, inv.qty, def.maxStack)) {
        slot.inventory[index] = null;
      } else {
        slot.outbox.push({ t: "toast", msg: "Stash full" });
      }
    } else {
      const entry = this.store.stashTake(slot.stored, index);
      if (!entry) return;
      const leftover = this.addToInventory(slot, entry.item, entry.qty);
      if (leftover > 0) {
        const def = this.content.items.get(entry.item);
        this.store.stashAdd(slot.stored, entry.item, leftover, def?.maxStack ?? 1);
        if (leftover === entry.qty) slot.outbox.push({ t: "toast", msg: "Inventory full" });
      }
    }
    slot.outbox.push({ t: "stash", slots: slot.stored.stash.map((s) => ({ ...s })) });
  }

  private doParty(slot: PlayerSlot, op: "invite" | "accept" | "leave", target?: string): void {
    const id = slot.entity.id;
    if (op === "invite" && target) {
      const other = this.players.get(target);
      if (!other || !other.connected) return;
      const d = Math.hypot(
        other.entity.body.x - slot.entity.body.x,
        other.entity.body.y - slot.entity.body.y,
      );
      if (d > 6) return; // fistbump range-ish: you invite people you can see
      this.invites.set(target, { from: id, expiresAt: this.tickCount + INVITE_TTL_TICKS });
      other.outbox.push({ t: "invite", from: id, name: slot.entity.name ?? "?" });
      slot.outbox.push({ t: "toast", msg: `Invited ${other.entity.name} to party` });
      return;
    }
    if (op === "accept") {
      const invite = this.invites.get(id);
      if (!invite || invite.expiresAt < this.tickCount) return;
      this.invites.delete(id);
      const inviter = this.players.get(invite.from);
      if (!inviter) return;
      let partyId = inviter.partyId;
      if (!partyId) {
        partyId = `party${this.nextPartyId++}`;
        this.parties.set(partyId, { id: partyId, members: new Set([invite.from]), roomSlot: null });
        inviter.partyId = partyId;
        inviter.entity.partyId = partyId;
      }
      const party = this.parties.get(partyId)!;
      party.members.add(id);
      slot.partyId = partyId;
      slot.entity.partyId = partyId;
      for (const memberId of party.members) {
        this.players.get(memberId)?.outbox.push({
          t: "toast",
          msg: `${slot.entity.name} joined the party`,
        });
      }
      return;
    }
    if (op === "leave") this.leaveParty(slot);
  }

  private leaveParty(slot: PlayerSlot): void {
    if (!slot.partyId) return;
    const party = this.parties.get(slot.partyId);
    slot.partyId = null;
    delete slot.entity.partyId;
    if (!party) return;
    party.members.delete(slot.entity.id);
    for (const memberId of party.members) {
      this.players.get(memberId)?.outbox.push({
        t: "toast",
        msg: `${slot.entity.name} left the party`,
      });
    }
    if (party.members.size <= 1) {
      for (const memberId of party.members) {
        const member = this.players.get(memberId);
        if (member) {
          member.partyId = null;
          delete member.entity.partyId;
          member.outbox.push({ t: "toast", msg: "Party disbanded" });
        }
      }
      this.parties.delete(party.id);
    }
  }

  private doChat(slot: PlayerSlot, channel: "party" | "local", text: string): void {
    const event: GameEvent = {
      t: "chat",
      channel,
      from: slot.entity.id,
      name: slot.entity.name ?? "?",
      text,
    };
    if (channel === "party") {
      if (!slot.partyId) return;
      const party = this.parties.get(slot.partyId);
      if (!party) return;
      for (const memberId of party.members) this.players.get(memberId)?.outbox.push(event);
    } else {
      this.worldEvents.push({ ev: event, x: slot.entity.body.x, y: slot.entity.body.y });
    }
  }

  // ── enemies ──────────────────────────────────────────────────────

  private activateChunksNearPlayers(): void {
    for (const slot of this.players.values()) {
      const ccx = Math.floor(slot.entity.body.x / CHUNK_SIZE);
      const ccy = Math.floor(slot.entity.body.y / CHUNK_SIZE);
      for (let cy = ccy - 1; cy <= ccy + 1; cy++) {
        for (let cx = ccx - 1; cx <= ccx + 1; cx++) {
          const chunkKey = `${cx},${cy}`;
          if (this.activatedChunks.has(chunkKey)) continue;
          this.activatedChunks.add(chunkKey);
          this.populateChunk(cx, cy);
        }
      }
    }
  }

  /** Keep the dev hazard patches alive — areas decay, examples shouldn't. */
  private seedTestZoneHazards(): void {
    for (const hazard of TEST_ZONE_HAZARDS) {
      if (this.areas.defAt(hazard.x, hazard.y) === null) {
        this.areas.spawn(hazard.def, hazard.x, hazard.y, hazard.radius);
      }
    }
  }

  private populateChunk(cx: number, cy: number): void {
    if (isRoomChunk(cy)) return;
    // Dev test zone: fixed fixtures instead of random spawns.
    if (cx >= 0 && cx <= 1 && cy >= 0 && cy <= 1) {
      const inChunk = (f: { x: number; y: number }) =>
        Math.floor(f.x / CHUNK_SIZE) === cx && Math.floor(f.y / CHUNK_SIZE) === cy;
      for (const f of TEST_ZONE_ENEMIES) if (inChunk(f)) this.spawnEnemy(f.def, f.x, f.y);
      for (const f of TEST_ZONE_ITEMS) if (inChunk(f)) this.spawnItem(f.def, f.x, f.y, f.qty ?? 1);
      if (cx === 0 && cy === 0) {
        this.hazardsActive = true;
        this.seedTestZoneHazards();
      }
      return;
    }
    if (this.enemies.size > 150) return;
    const table: Array<[string, number]> = [
      ["slime", 0.4],
      ["plant-creeper", 0.25],
      ["skeleton", 0.2],
      ["spitter", 0.15],
    ];
    const count = 1 + Math.floor(this.rng.next() * 3);
    for (let n = 0; n < count; n++) {
      const wx = cx * CHUNK_SIZE + Math.floor(this.rng.next() * CHUNK_SIZE);
      const wy = cy * CHUNK_SIZE + Math.floor(this.rng.next() * CHUNK_SIZE);
      if (!this.world.isWalkable(wx, wy) || this.world.isSanctuary(wx, wy)) continue;
      let tooClose = false;
      for (const slot of this.players.values()) {
        if (Math.hypot(slot.entity.body.x - wx, slot.entity.body.y - wy) < 12) tooClose = true;
      }
      if (tooClose) continue;
      let roll = this.rng.next();
      let pick = table[0]![0];
      for (const [defId, weight] of table) {
        if (roll < weight) {
          pick = defId;
          break;
        }
        roll -= weight;
      }
      this.spawnEnemy(pick, wx + 0.5, wy + 0.5);
    }
  }

  private stepEnemies(effectEvents: EffectEvent[]): void {
    const players = [...this.players.values()]
      .filter((s) => s.entity.hp > 0)
      .map((s) => s.entity);
    for (const enemy of this.enemies.values()) {
      const entity = enemy.entity;
      if (entity.hp <= 0) continue; // corpses don't bite
      // Freeze enemies far from everyone.
      let near = false;
      for (const p of players) {
        if (
          Math.abs(p.body.x - entity.body.x) < ENEMY_ACTIVE_RADIUS &&
          Math.abs(p.body.y - entity.body.y) < ENEMY_ACTIVE_RADIUS
        ) {
          near = true;
          break;
        }
      }
      if (!near) continue;

      const decision = enemyThink(
        enemy.brain,
        entity,
        enemy.def,
        players,
        (e) => this.effects.inSanctuary(e),
        TICK_DT,
        () => this.rng.next(),
      );
      stepBody(this.world, entity.body, decision.move, TICK_DT, {
        speed: entity.baseSpeed * this.effects.speedMult(entity),
        // Enemies never set foot on sanctuary ground.
        blocked: (x, y) => this.world.isSanctuary(x, y),
      });
      if (decision.strike) {
        const victim = this.players.get(decision.strike.targetId)?.entity;
        if (victim && victim.hp > 0) {
          const d = Math.hypot(victim.body.x - entity.body.x, victim.body.y - entity.body.y);
          if (d <= enemy.def.attack.range + 0.3) {
            this.effects.modifyHealth(victim, -enemy.def.attack.damage, effectEvents, {
              sourceTags: enemy.def.tags,
            });
            for (const apply of enemy.def.attack.applies ?? []) {
              if (this.rng.next() < apply.chance) {
                this.effects.applyStatus(victim, apply.status, effectEvents);
              }
            }
            applyKnockback(
              victim.body,
              victim.body.x - entity.body.x,
              victim.body.y - entity.body.y,
              KNOCKBACK_FORCE * 0.6,
            );
          }
        }
      }
      if (decision.shoot) {
        const projectile = makeEntity(
          "projectile",
          createBody(entity.body.x, entity.body.y, entity.body.z + 0.5),
          {
            id: newEntityId("j"),
            ownerId: entity.id,
            tags: new Set(["spit", ...enemy.def.tags]),
            vel: launchVelocity(
              { x: entity.body.x, y: entity.body.y, z: entity.body.z + 0.5 },
              decision.shoot,
              THROW_SPEED,
            ),
          },
        );
        this.projectiles.set(projectile.id, projectile);
      }
    }
  }

  // ── projectiles ──────────────────────────────────────────────────

  private stepProjectiles(effectEvents: EffectEvent[]): void {
    for (const [id, projectile] of this.projectiles) {
      const result = stepProjectile(this.world, projectile, TICK_DT);

      // Direct hits mid-flight (skip the thrower).
      let directHit: Entity | null = null;
      for (const candidate of this.combatants()) {
        if (candidate.id === projectile.ownerId || candidate.hp <= 0) continue;
        const d = Math.hypot(
          candidate.body.x - projectile.body.x,
          candidate.body.y - projectile.body.y,
        );
        if (d < 0.7 && Math.abs(candidate.body.z + 0.8 - projectile.body.z) < 1.2) {
          directHit = candidate;
          break;
        }
      }

      if (directHit || result.impact) {
        this.projectiles.delete(id);
        const x = directHit?.body.x ?? result.impact!.x;
        const y = directHit?.body.y ?? result.impact!.y;
        this.resolveImpact(projectile, x, y, directHit, effectEvents);
      }
    }
  }

  private resolveImpact(
    projectile: Entity,
    x: number,
    y: number,
    directHit: Entity | null,
    effectEvents: EffectEvent[],
  ): void {
    // Enemy spit: plain damage + statuses.
    if (!projectile.defId) {
      if (directHit) {
        const owner = this.enemies.get(projectile.ownerId ?? "");
        const damage = owner?.def.attack.damage ?? 2;
        const target = this.effectTargetFor(directHit);
        this.effects.modifyHealth(directHit, -damage, effectEvents, { sourceTags: ["spit"] }, target);
        for (const apply of owner?.def.attack.applies ?? []) {
          if (this.rng.next() < apply.chance) {
            this.effects.applyStatus(directHit, apply.status, effectEvents, target);
          }
        }
      }
      return;
    }

    const def = this.content.items.get(projectile.defId);
    if (!def?.throwable) return;
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    for (const primitive of def.throwable.onImpact) {
      if (primitive.primitive === "spawn_area") {
        this.areas.spawn(primitive.area, tileX, tileY, primitive.radius);
        continue;
      }
      // Entity-targeted primitives hit everything within a tile.
      for (const victim of this.combatants()) {
        if (victim.hp <= 0) continue;
        const d = Math.hypot(victim.body.x - x, victim.body.y - y);
        if (d <= 1.2) {
          this.effects.runPrimitives(
            victim,
            [primitive],
            effectEvents,
            this.effectTargetFor(victim),
            () => this.rng.next(),
            [...projectile.tags],
          );
        }
      }
    }
    if (this.rng.next() >= def.throwable.breakChance) {
      this.spawnItem(projectile.defId, x, y, 1);
    }
  }

  // ── areas & statuses ─────────────────────────────────────────────

  private applyAreaContact(effectEvents: EffectEvent[]): void {
    for (const entity of this.combatants()) {
      if (entity.hp <= 0 || !entity.body.grounded) continue; // fly over ground effects
      const tileX = Math.floor(entity.body.x);
      const tileY = Math.floor(entity.body.y);
      const defId = this.areas.defAt(tileX, tileY);
      if (!defId) continue;
      const area = this.content.areas.get(defId);
      if (!area?.onEnterStatus) continue;
      this.effects.applyStatus(entity, area.onEnterStatus, effectEvents, this.effectTargetFor(entity));
    }
    // Items exposed to fire char, then are destroyed.
    for (const [id, item] of this.items) {
      const burning = this.areas.hasTagAt(Math.floor(item.body.x), Math.floor(item.body.y), "fire");
      if (!burning) {
        this.exposure.delete(id);
        continue;
      }
      const total = (this.exposure.get(id) ?? 0) + TICK_DT;
      if (total >= ITEM_CHAR_SECONDS) {
        this.items.delete(id);
        this.exposure.delete(id);
      } else {
        this.exposure.set(id, total);
      }
    }
  }

  private effectTargetFor(entity: Entity) {
    if (entity.kind === "enemy") {
      const def = this.enemies.get(entity.id)?.def;
      return {
        ...(def?.immunities ? { immunities: def.immunities } : {}),
        ...(def?.damageScale ? { damageScale: def.damageScale } : {}),
      };
    }
    return {};
  }

  private tickStatuses(effectEvents: EffectEvent[]): void {
    for (const entity of this.combatants()) {
      if (entity.hp <= 0) continue;
      this.effects.tick(entity, TICK_DT, effectEvents, this.effectTargetFor(entity), () =>
        this.rng.next(),
      );
      this.effects.runInteractionRules(entity, effectEvents);
    }
  }

  private realizeEffectEvents(effectEvents: EffectEvent[]): void {
    for (const event of effectEvents) {
      switch (event.t) {
        case "spawnArea":
          this.areas.spawn(event.area, event.x, event.y, event.radius);
          break;
        case "destroy":
          this.items.delete(event.id);
          this.projectiles.delete(event.id);
          break;
        case "hp":
          this.worldEvents.push({
            ev: { t: "hit", id: event.id, amount: event.delta },
            ...this.positionOf(event.id),
          });
          break;
        case "status":
          this.worldEvents.push({
            ev: { t: "status", id: event.id, status: event.status, on: event.on },
            ...this.positionOf(event.id),
          });
          break;
        case "death":
          // handled in resolveDeaths (entity still present here)
          break;
      }
    }
  }

  private positionOf(id: string): { x: number; y: number } {
    const entity =
      this.players.get(id)?.entity ??
      this.enemies.get(id)?.entity ??
      this.items.get(id) ??
      this.projectiles.get(id);
    return entity ? { x: entity.body.x, y: entity.body.y } : { x: 0, y: 0 };
  }

  // ── deaths ───────────────────────────────────────────────────────

  private resolveDeaths(): void {
    for (const [id, enemy] of this.enemies) {
      if (enemy.entity.hp > 0) continue;
      this.enemies.delete(id);
      this.worldEvents.push({
        ev: { t: "death", id },
        x: enemy.entity.body.x,
        y: enemy.entity.body.y,
      });
      for (const drop of enemy.def.drops) {
        if (this.rng.next() < drop.chance) {
          const jx = (this.rng.next() - 0.5) * 1.2;
          const jy = (this.rng.next() - 0.5) * 1.2;
          this.spawnItem(drop.item, enemy.entity.body.x + jx, enemy.entity.body.y + jy, 1);
        }
      }
    }

    for (const slot of this.players.values()) {
      const entity = slot.entity;
      // Bleed-out for downed players.
      if (
        slot.downedAtTick !== null &&
        this.tickCount - slot.downedAtTick >= DOWNED_DURATION * TICK_RATE
      ) {
        entity.hp = 0;
        slot.downedAtTick = null;
      }
      if (entity.hp > 0 || slot.respawnAtTick !== null) continue;

      const party = slot.partyId ? this.parties.get(slot.partyId) : undefined;
      const conscious = party
        ? [...party.members].some((m) => {
            const member = this.players.get(m);
            return m !== entity.id && member && member.entity.hp > 0 && member.downedAtTick === null;
          })
        : false;
      if (party && conscious && slot.downedAtTick === null) {
        // Downed, not dead: a party member can still get you up.
        slot.downedAtTick = this.tickCount;
        entity.hp = 1;
        entity.downedUntil = this.tickCount + DOWNED_DURATION * TICK_RATE;
        entity.statuses = [];
        slot.outbox.push({ t: "toast", msg: "You're down! A party member can revive you." });
        continue;
      }

      // Real death: full loot drop, distant respawn, stash untouched.
      this.worldEvents.push({ ev: { t: "death", id: entity.id }, x: entity.body.x, y: entity.body.y });
      this.dropAllInventory(slot);
      entity.statuses = [];
      slot.downedAtTick = null;
      delete entity.downedUntil;
      slot.respawnAtTick = this.tickCount + RESPAWN_DELAY_TICKS;
    }

    // Expire stale invites.
    for (const [invitee, invite] of this.invites) {
      if (invite.expiresAt < this.tickCount) this.invites.delete(invitee);
    }
  }

  // ── snapshots ────────────────────────────────────────────────────

  private buildSnapshots(): Map<string, ServerSnapshot> {
    const snapshots = new Map<string, ServerSnapshot>();
    const areaDirty = this.areas.drainDirty();
    const worldEvents = this.worldEvents;
    this.worldEvents = [];

    for (const slot of this.players.values()) {
      if (!slot.connected) {
        slot.outbox.length = 0;
        continue;
      }
      const self = slot.entity;
      const inAoi = (x: number, y: number) =>
        (x - self.body.x) ** 2 + (y - self.body.y) ** 2 <= AOI_RADIUS * AOI_RADIUS;

      const entities: EntitySnapshot[] = [];
      const visible = new Set<string>();
      const consider = (entity: Entity) => {
        if (entity.id === self.id) return;
        if (!inAoi(entity.body.x, entity.body.y)) return;
        visible.add(entity.id);
        entities.push({
          id: entity.id,
          kind: entity.kind,
          ...(entity.defId !== undefined ? { defId: entity.defId } : {}),
          ...(entity.name !== undefined ? { name: entity.name } : {}),
          x: entity.body.x,
          y: entity.body.y,
          z: entity.body.z,
          ...(entity.kind === "player" || entity.kind === "enemy"
            ? {
                hp: entity.hp,
                maxHp: entity.maxHp,
                fx: entity.statuses.map((s) => s.defId),
              }
            : {}),
          ...(entity.kind === "item" && entity.qty > 1 ? { qty: entity.qty } : {}),
          ...(entity.kind === "player" && this.players.get(entity.id)?.downedAtTick !== null
            ? { downed: true }
            : {}),
        });
      };
      for (const other of this.players.values()) if (other.entity.hp >= 0) consider(other.entity);
      for (const enemy of this.enemies.values()) consider(enemy.entity);
      for (const item of this.items.values()) consider(item);
      for (const projectile of this.projectiles.values()) consider(projectile);

      const left: string[] = [];
      for (const id of slot.known) if (!visible.has(id)) left.push(id);
      slot.known = visible;

      const events: GameEvent[] = [...slot.outbox];
      slot.outbox.length = 0;
      for (const we of worldEvents) if (inAoi(we.x, we.y)) events.push(we.ev);

      let areas = areaDirty.filter((a) => inAoi(a.x, a.y));
      if (slot.needsFullAreas) {
        slot.needsFullAreas = false;
        areas = this.areas.allTiles().filter((a) => inAoi(a.x, a.y));
      }

      const party = slot.partyId ? this.parties.get(slot.partyId) : undefined;

      snapshots.set(self.id, {
        type: "snapshot",
        tick: this.tickCount,
        lastSeq: slot.lastSeq,
        self: {
          x: self.body.x,
          y: self.body.y,
          z: self.body.z,
          zVel: self.body.zVel,
          grounded: self.body.grounded,
          kx: self.body.kx,
          ky: self.body.ky,
          hp: self.hp,
          maxHp: self.maxHp,
          fx: self.statuses.map((s) => s.defId),
          ...(slot.downedAtTick !== null ? { downed: true } : {}),
        },
        inventory: slot.inventory.map((s) => (s ? { ...s } : null)),
        selectedSlot: slot.selectedSlot,
        party: party
          ? {
              id: party.id,
              members: [...party.members]
                .filter((m) => m !== self.id)
                .map((m) => {
                  const member = this.players.get(m)!;
                  return {
                    id: m,
                    name: member.entity.name ?? "?",
                    x: member.entity.body.x,
                    y: member.entity.body.y,
                  };
                }),
            }
          : null,
        entities,
        left,
        events,
        areas,
      });
    }
    return snapshots;
  }

  // ── spawning ─────────────────────────────────────────────────────

  private findSpawn(): { x: number; y: number; z: number } {
    // e2e scaffolding: everyone spawns side by side at the proving
    // ground (real spawns keep MIN_SPAWN_DIST — distance is the
    // protection; browser tests can't walk 80 tiles to meet).
    if (this.opts.clusterSpawns) {
      const x = TEST_SPAWN.x + this.players.size * 2;
      const y = TEST_SPAWN.y;
      return { x, y, z: this.world.heightAt(Math.floor(x), Math.floor(y)) };
    }

    // Dev scaffolding: first player to fit lands at the proving ground.
    const test = { x: Math.floor(TEST_SPAWN.x), y: Math.floor(TEST_SPAWN.y) };
    if (this.world.isWalkable(test.x, test.y)) {
      let nearest = Infinity;
      for (const other of this.players.values()) {
        const d = Math.hypot(other.entity.body.x - TEST_SPAWN.x, other.entity.body.y - TEST_SPAWN.y);
        if (d < nearest) nearest = d;
      }
      if (nearest >= MIN_SPAWN_DIST) {
        return { x: TEST_SPAWN.x, y: TEST_SPAWN.y, z: this.world.heightAt(test.x, test.y) };
      }
    }

    let best: { x: number; y: number } | null = null;
    let bestDist = -1;
    for (let attempt = 0; attempt < 40; attempt++) {
      const cx = this.rng.int(-SPAWN_CHUNK_RANGE, SPAWN_CHUNK_RANGE);
      const cy = this.rng.int(-SPAWN_CHUNK_RANGE, SPAWN_CHUNK_RANGE);
      const center = chunkCenter(this.world.worldSeed, this.world.floor, cx, cy);
      const tile = this.findWalkableNear(center.x, center.y);
      if (!tile) continue;
      let nearest = Infinity;
      for (const other of this.players.values()) {
        const d = Math.hypot(other.entity.body.x - tile.x, other.entity.body.y - tile.y);
        if (d < nearest) nearest = d;
      }
      if (nearest >= MIN_SPAWN_DIST) {
        best = tile;
        break;
      }
      if (nearest > bestDist) {
        bestDist = nearest;
        best = tile;
      }
    }
    const spot = best ?? { x: 0.5, y: 0.5 };
    const x = spot.x + 0.5;
    const y = spot.y + 0.5;
    return { x, y, z: this.world.heightAt(Math.floor(x), Math.floor(y)) };
  }

  private findWalkableNear(wx: number, wy: number): { x: number; y: number } | null {
    for (let r = 0; r < 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = Math.round(wx) + dx;
          const y = Math.round(wy) + dy;
          if (this.world.isWalkable(x, y)) return { x, y };
        }
      }
    }
    return null;
  }

  private newToken(): string {
    let token = "";
    for (let i = 0; i < 4; i++) {
      token += this.rng.next().toString(36).slice(2, 10);
    }
    return token + Date.now().toString(36);
  }
}
