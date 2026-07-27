import { LEVEL, World, type ServerSnapshot } from "@dc2d/engine";
import { Connection } from "../connection/connection.js";

export const WORLD_SEED = 12345;

export function freshConnection(floor: number): Connection {
  const conn = new Connection("wss://example.test", "Tester", "client-1");
  conn.world = new World(WORLD_SEED, floor, LEVEL.Dungeon);
  conn.body = { x: 0, y: 0, z: 0, zVel: 0, grounded: true, coyoteTime: 0, jumpBuffer: 0, jumpHeld: false, fallStart: 0, kx: 0, ky: 0 };
  return conn;
}

export function snapshotAtFloor(floor: number, hp = 10, respawnAtTick: number | null = null): ServerSnapshot {
  return {
    type: "snapshot", tick: 1, lastSeq: 0, lastProjectedServerTick: 0,
    self: { x: 0, y: 0, z: 0, zVel: 0, grounded: true, coyoteTime: 0, jumpBuffer: 0, jumpHeld: false, kx: 0, ky: 0, hp, maxHp: 10, fx: [], floor, respawnAtTick },
    inventory: [], hotbar: [], weapon: null, party: null, entities: [], left: [], events: [], areas: [],
  };
}
