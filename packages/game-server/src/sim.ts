import {
  AOI_RADIUS,
  MAX_INPUTS_PER_TICK,
  MIN_SPAWN_DIST,
  NEUTRAL_INPUT,
  RECONNECT_GRACE_MS,
  Rng,
  SPAWN_CHUNK_RANGE,
  TICK_DT,
  TICK_RATE,
  chunkCenter,
  createBody,
  stepBody,
  type BodyState,
  type ClientInput,
  type PeerSnapshot,
  type ServerSnapshot,
  type World,
} from "@dc2d/engine";

/**
 * The authoritative floor simulation, deliberately transport-free:
 * the ws layer (server.ts) feeds it messages and ships out the
 * snapshots it returns, and tests drive it directly — an in-process
 * "headless server" exercising the exact code that runs in production.
 */

interface PlayerSlot {
  id: string;
  name: string;
  resumeToken: string;
  body: BodyState;
  lastSeq: number;
  pendingInputs: ClientInput[];
  connected: boolean;
  /** Tick at which a disconnected player is reaped. */
  reapAtTick: number;
  /** Peers this player's client currently knows about (for AOI leave lists). */
  known: Set<string>;
}

export interface JoinResult {
  playerId: string;
  resumeToken: string;
  spawn: { x: number; y: number; z: number };
  resumed: boolean;
}

const GRACE_TICKS = Math.ceil((RECONNECT_GRACE_MS / 1000) * TICK_RATE);

export class GameSim {
  private readonly players = new Map<string, PlayerSlot>();
  private readonly byToken = new Map<string, string>();
  private readonly rng: Rng;
  private tickCount = 0;
  private nextId = 1;

  constructor(
    readonly world: World,
    rngSeed = 1,
  ) {
    this.rng = new Rng(rngSeed);
  }

  get tick(): number {
    return this.tickCount;
  }

  get playerCount(): number {
    return this.players.size;
  }

  /** Join (or resume, if the token matches a player inside the grace window). */
  addPlayer(name: string, resumeToken?: string): JoinResult {
    if (resumeToken) {
      const existingId = this.byToken.get(resumeToken);
      const slot = existingId ? this.players.get(existingId) : undefined;
      if (slot && !slot.connected) {
        slot.connected = true;
        slot.pendingInputs.length = 0;
        return {
          playerId: slot.id,
          resumeToken: slot.resumeToken,
          spawn: { x: slot.body.x, y: slot.body.y, z: slot.body.z },
          resumed: true,
        };
      }
    }

    const id = `p${this.nextId++}`;
    const token = this.newToken();
    const spawn = this.findSpawn();
    const slot: PlayerSlot = {
      id,
      name,
      resumeToken: token,
      body: createBody(spawn.x, spawn.y, spawn.z),
      lastSeq: -1,
      pendingInputs: [],
      connected: true,
      reapAtTick: Number.MAX_SAFE_INTEGER,
      known: new Set(),
    };
    this.players.set(id, slot);
    this.byToken.set(token, id);
    return { playerId: id, resumeToken: token, spawn, resumed: false };
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
    if (input.seq <= slot.lastSeq) return; // stale or replayed
    slot.pendingInputs.push(input);
  }

  /** Advance one tick; returns a snapshot per connected player. */
  step(): Map<string, ServerSnapshot> {
    this.tickCount++;

    // Reap players whose reconnect grace expired.
    for (const [id, slot] of this.players) {
      if (!slot.connected && this.tickCount >= slot.reapAtTick) {
        this.players.delete(id);
        this.byToken.delete(slot.resumeToken);
      }
    }

    // Physics: apply buffered inputs (capped), or coast so gravity continues.
    for (const slot of this.players.values()) {
      const inputs = slot.pendingInputs.splice(0, MAX_INPUTS_PER_TICK);
      slot.pendingInputs.length = 0; // drop any excess beyond the cap
      if (inputs.length === 0) {
        stepBody(this.world, slot.body, NEUTRAL_INPUT, TICK_DT);
      } else {
        for (const input of inputs) {
          stepBody(this.world, slot.body, input, TICK_DT);
          slot.lastSeq = input.seq;
        }
      }
    }

    // AOI snapshots.
    const snapshots = new Map<string, ServerSnapshot>();
    for (const slot of this.players.values()) {
      if (!slot.connected) continue;
      const others: PeerSnapshot[] = [];
      const visible = new Set<string>();
      for (const other of this.players.values()) {
        if (other.id === slot.id) continue;
        const dx = other.body.x - slot.body.x;
        const dy = other.body.y - slot.body.y;
        if (dx * dx + dy * dy > AOI_RADIUS * AOI_RADIUS) continue;
        visible.add(other.id);
        others.push({
          id: other.id,
          name: other.name,
          x: other.body.x,
          y: other.body.y,
          z: other.body.z,
        });
      }
      const left: string[] = [];
      for (const id of slot.known) {
        if (!visible.has(id)) left.push(id);
      }
      slot.known = visible;

      snapshots.set(slot.id, {
        type: "snapshot",
        tick: this.tickCount,
        lastSeq: slot.lastSeq,
        self: {
          x: slot.body.x,
          y: slot.body.y,
          z: slot.body.z,
          zVel: slot.body.zVel,
          grounded: slot.body.grounded,
        },
        others,
        left,
      });
    }
    return snapshots;
  }

  /** Test/diagnostic access to a player's authoritative body. */
  getBody(playerId: string): BodyState | undefined {
    return this.players.get(playerId)?.body;
  }

  /**
   * Random spawn far from everyone. Candidates are walkable tiles near
   * jittered chunk centers — centers are always on the corridor
   * network, so spawns are never in an isolated pocket. Among sampled
   * candidates, prefer the one maximizing distance to the nearest
   * player; there is no spawn shield — distance is the protection.
   */
  private findSpawn(): { x: number; y: number; z: number } {
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
        const d = Math.hypot(other.body.x - tile.x, other.body.y - tile.y);
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
