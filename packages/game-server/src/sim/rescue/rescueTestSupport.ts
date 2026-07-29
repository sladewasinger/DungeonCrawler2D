import {
  LEVEL,
  TERRAIN,
  TILE,
  createBody,
  makeEntity,
  type TerrainType,
  type World,
} from "@dc2d/engine";
import { PlayerStore } from "../../store.js";
import { content } from "../integration/support.js";
import { createPlayerSlot } from "../players/joinSlot.js";
import { createSimState, type PlayerSlot, type SimState } from "../state/state.js";
import type { RescueWorld } from "./rescueWorld.js";

interface FloorCell {
  readonly height: number;
  blocked: boolean;
}

export class RescueTestWorld implements RescueWorld {
  readonly worldSeed = 1;
  readonly floor = 1;
  readonly level = LEVEL.Sandbox;
  private readonly floorCells = new Map<string, FloorCell>();

  addPlatform(centerX: number, centerY: number, height = 0): void {
    for (let y = centerY - 1; y <= centerY + 1; y++) {
      for (let x = centerX - 1; x <= centerX + 1; x++) {
        this.setFloor(x, y, height);
      }
    }
  }

  setFloor(x: number, y: number, height: number): void {
    this.floorCells.set(key(x, y), { height, blocked: false });
  }

  block(x: number, y: number): void {
    const cell = this.floorCells.get(key(x, y));
    if (cell) cell.blocked = true;
  }

  isWalkable(x: number, y: number): boolean {
    const cell = this.floorCells.get(key(x, y));
    return Boolean(cell && !cell.blocked);
  }

  terrainAt(x: number, y: number): TerrainType {
    return this.floorCells.has(key(x, y)) ? TERRAIN.Floor : TERRAIN.Void;
  }

  heightAt(x: number, y: number): number {
    return this.floorCells.get(key(x, y))?.height ?? Number.POSITIVE_INFINITY;
  }

  groundAt(x: number, y: number): number {
    return this.heightAt(Math.floor(x), Math.floor(y));
  }

  isSanctuary(): boolean {
    return false;
  }

  tileAt(x: number, y: number): number {
    return this.isWalkable(x, y) ? TILE.Floor : TILE.Void;
  }
}

export function createRescueFixture(
  world = new RescueTestWorld(),
): { readonly sim: SimState; readonly slot: PlayerSlot } {
  const store = new PlayerStore(null);
  const sim = createSimState({
    world: world as unknown as World,
    content,
    store,
    rngSeed: 1,
    opts: {},
  });
  const entity = makeEntity("player", createBody(0.25, 0.25, 0), {
    id: "rescue-player",
    name: "Tester",
    hp: 30,
    maxHp: 30,
  });
  const slot = createPlayerSlot({
    entity,
    clientId: "rescue-client",
    stored: store.get("rescue-client", "Tester"),
    resumeToken: "rescue-token",
    tick: sim.tickCount,
  });
  sim.players.set(entity.id, slot);
  sim.byToken.set(slot.resumeToken, entity.id);
  return { sim, slot };
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}
