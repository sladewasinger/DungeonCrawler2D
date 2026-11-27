/** Per-zone authoritative state container encapsulating chunk cache, combat world, and zone players. */
import { WorldChunkCache } from "@dc2d/engine";
import { CombatWorld } from "../combatSim.js";
import type { SimPlayer } from "../survival/worldPersistenceSync.js";
import { stepPlayerTick } from "../survival/playerStepHelper.js";

export type ZoneKind = "overworld" | "safe-room" | "dungeon-floor";

export interface ZoneDescriptor {
  readonly zoneId: string;
  readonly kind: ZoneKind;
  readonly floor: number;
  readonly seed: number;
  readonly maxCachedChunks?: number | undefined;
}

export class ZoneInstance {
  readonly zoneId: string;
  readonly kind: ZoneKind;
  readonly floor: number;
  readonly seed: number;
  readonly cache: WorldChunkCache;
  readonly combat: CombatWorld;
  readonly players = new Map<string, SimPlayer>();

  constructor(desc: ZoneDescriptor) {
    this.zoneId = desc.zoneId;
    this.kind = desc.kind;
    this.floor = desc.floor;
    this.seed = desc.seed;
    this.cache = new WorldChunkCache(desc.seed, { maxCachedChunks: desc.maxCachedChunks });
    this.cache.getChunk(0, 0);
    this.combat = new CombatWorld(this.cache);
  }

  attachPlayer(p: SimPlayer): void {
    this.players.set(p.id, p);
  }

  detachPlayer(playerId: string): void {
    this.players.delete(playerId);
    this.combat.removePlayer(playerId);
  }

  step(opts: { readonly dtSeconds: number; readonly dayPhase: number; readonly worldClockSec: number }): boolean {
    for (const p of this.players.values()) {
      stepPlayerTick({ p, players: this.players, cache: this.cache, combat: this.combat, dayPhase: opts.dayPhase, dtSeconds: opts.dtSeconds });
    }
    return this.combat.stepWorld({ players: this.players, dt: opts.dtSeconds, dayPhase: opts.dayPhase, timeSec: opts.worldClockSec });
  }
}
