/** Authoritative 20 Hz overworld simulation state. */
import {
  DAY_DURATION_SECONDS,
  WorldChunkCache,
  resolveMovement,
  wrapDayPhase,
  type PlayerSnapshot,
} from "@dc2d/engine";

export const TICK_RATE = 20;
export const PLAYER_SPEED_TILES_PER_SEC = 5.4;
export const PLAYER_RADIUS = 0.28;
export const INITIAL_DAY_PHASE = 0.62;

interface SimPlayer {
  readonly id: string;
  readonly name: string;
  x: number;
  y: number;
  elevation: number;
  facingX: number;
  facingY: number;
  moveX: number;
  moveY: number;
  moving: boolean;
  torchLit: boolean;
  inWater: boolean;
  lastAckSeq: number;
}

export class WorldSim {
  readonly cache: WorldChunkCache;
  private readonly players = new Map<string, SimPlayer>();
  private nextPlayerNum = 1;
  tick = 0;
  dayPhase = INITIAL_DAY_PHASE;
  dayPaused = false;

  constructor(readonly worldSeed = 1337) {
    this.cache = new WorldChunkCache(worldSeed);
    this.cache.getChunk(0, 0);
  }

  addPlayer(name: string): string {
    const id = `p${this.nextPlayerNum++}`;
    const offset = ((this.players.size % 4) - 1.5) * 0.6;
    this.players.set(id, {
      id,
      name,
      x: 0.5 + offset,
      y: 0.5,
      elevation: 0,
      facingX: 0,
      facingY: 1,
      moveX: 0,
      moveY: 0,
      moving: false,
      torchLit: true,
      inWater: false,
      lastAckSeq: 0,
    });
    return id;
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
  }

  queueInput(playerId: string, input: { readonly seq: number; readonly moveX: number; readonly moveY: number }): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.moveX = input.moveX;
    player.moveY = input.moveY;
    player.lastAckSeq = input.seq;
  }

  toggleTorch(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) player.torchLit = !player.torchLit;
  }

  setDayPhase(dayPhase: number, paused?: boolean): void {
    this.dayPhase = wrapDayPhase(dayPhase);
    if (paused !== undefined) this.dayPaused = paused;
  }

  step(dtSeconds = 1 / TICK_RATE): void {
    this.tick += 1;
    if (!this.dayPaused) {
      this.dayPhase = wrapDayPhase(this.dayPhase + dtSeconds / DAY_DURATION_SECONDS);
    }
    for (const player of this.players.values()) {
      this.stepPlayer(player, dtSeconds);
    }
  }

  private stepPlayer(player: SimPlayer, dtSeconds: number): void {
    const mag = Math.hypot(player.moveX, player.moveY);
    if (mag < 0.05) {
      player.moving = false;
      return;
    }
    const nx = player.moveX / Math.max(1, mag);
    const ny = player.moveY / Math.max(1, mag);
    player.facingX = nx;
    player.facingY = ny;
    player.moving = true;
    const step = PLAYER_SPEED_TILES_PER_SEC * dtSeconds;
    const result = resolveMovement({
      cache: this.cache,
      x: player.x,
      y: player.y,
      dx: nx * step,
      dy: ny * step,
      radius: PLAYER_RADIUS,
      elevation: player.elevation,
    });
    player.x = result.x;
    player.y = result.y;
    player.elevation = result.elevation;
    player.inWater = result.inWater;
  }

  snapshots(): PlayerSnapshot[] {
    return Array.from(this.players.values(), (p) => ({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      elevation: p.elevation,
      facingX: p.facingX,
      facingY: p.facingY,
      moving: p.moving,
      torchLit: p.torchLit,
      inWater: p.inWater,
      lastAckSeq: p.lastAckSeq,
    }));
  }
}
