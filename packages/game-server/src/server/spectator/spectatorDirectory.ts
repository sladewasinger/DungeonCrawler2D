import {
  PROTOCOL_VERSION,
  TICK_RATE,
  type InvStack,
  type SpectatorMode,
  type SpectatorPlayer,
  type SpectatorPresentation,
  type SpectatorWelcome,
} from "@dc2d/engine";
import type { SocketMap } from "../types.js";
import { WebSocket } from "ws";

export interface SpectatorDirectoryOptions {
  readonly sockets: SocketMap;
  readonly seedInputText: string;
  readonly worldSeed: number;
}

export class SpectatorDirectory {
  private readonly baselineRequests = new Map<string, number>();

  constructor(private readonly options: SpectatorDirectoryOptions) {}

  players(): SpectatorPlayer[] {
    const players = [...this.options.sockets].flatMap(([playerId, entry]) => {
      if (entry.ws.readyState !== WebSocket.OPEN) return [];
      if (!entry.sim.getPlayerEntity(playerId)) return [];
      return [spectatorPlayer(playerId, entry.sim)];
    });
    return players.sort(comparePlayers);
  }

  has(playerId: string): boolean {
    const entry = this.options.sockets.get(playerId);
    return entry?.ws.readyState === WebSocket.OPEN &&
      entry.sim.getPlayerEntity(playerId) !== undefined;
  }

  requestBaseline(playerId: string, now = Date.now()): boolean {
    const previous = this.baselineRequests.get(playerId) ?? 0;
    if (now - previous < 500) return false;
    this.baselineRequests.set(playerId, now);
    this.options.sockets.get(playerId)?.sim.requestSnapshotBaseline(playerId);
    return true;
  }

  worldIdentity(playerId: string): string | null {
    const sim = this.options.sockets.get(playerId)?.sim;
    return sim ? `${sim.world.level}:${sim.world.floor}` : null;
  }

  visibleLoadout(playerId: string): SpectatorLoadout {
    const sim = this.options.sockets.get(playerId)?.sim;
    if (!sim) return { inventory: [], hotbar: [] };
    const hotbar = [...(sim.getHotbar(playerId) ?? [])];
    const visibleItems = new Set(hotbar.filter((item): item is string => item !== null));
    const weapon = sim.getWeapon(playerId);
    if (weapon) visibleItems.add(weapon);
    const inventory = (sim.getInventory(playerId) ?? [])
      .filter(({ item }) => visibleItems.has(item))
      .map((stack) => ({ ...stack }));
    return { inventory, hotbar };
  }

  presentation(playerId: string): SpectatorPresentation | null {
    const sim = this.options.sockets.get(playerId)?.sim;
    const worldIdentity = this.worldIdentity(playerId);
    if (!sim || !worldIdentity) return null;
    return {
      type: "spectatorPresentation",
      worldIdentity,
      tick: sim.tick,
      deaths: sim.visibleDeathPresentations(playerId),
    };
  }

  welcome(playerId: string, mode: SpectatorMode): SpectatorWelcome | null {
    const entry = this.options.sockets.get(playerId);
    const entity = entry?.sim.getPlayerEntity(playerId);
    if (!entry || !entity) return null;
    const { body } = entity;
    return {
      type: "spectatorWelcome",
      protocol: PROTOCOL_VERSION,
      seedInputText: this.options.seedInputText,
      worldSeed: this.options.worldSeed,
      worldFeatures: entry.sim.world.features,
      tickRate: TICK_RATE,
      target: spectatorPlayer(playerId, entry.sim),
      mode,
      spawn: { x: body.x, y: body.y, z: body.z },
    };
  }
}

export interface SpectatorLoadout {
  readonly inventory: InvStack[];
  readonly hotbar: Array<string | null>;
}

function spectatorPlayer(
  playerId: string,
  sim: import("../../sim/core/index.js").GameSim,
): SpectatorPlayer {
  const entity = sim.getPlayerEntity(playerId)!;
  return {
    playerId,
    name: entity.name ?? "Crawler",
    skin: entity.skin ?? "knight_f",
    level: sim.world.level,
    floor: sim.world.floor,
  };
}

function comparePlayers(left: SpectatorPlayer, right: SpectatorPlayer): number {
  return left.name.localeCompare(right.name) || left.playerId.localeCompare(right.playerId);
}
