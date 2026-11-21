import { LEVEL, World, type GeneratedFloor, type ServerSnapshot, type WorldFeatures } from "@dc2d/engine";
import { Connection } from "../connection/connection.js";

export const WORLD_SEED = 12345;
type GenerationIdentity = NonNullable<ServerSnapshot["self"]["generation"]>;

export function freshConnection(floor: number): Connection {
  const conn = new Connection("wss://example.test", "Tester", "client-1");
  conn.status = "connected";
  conn.world = new World(WORLD_SEED, floor, LEVEL.Dungeon);
  conn.worldReady = true;
  conn.body = { x: 0, y: 0, z: 0, zVel: 0, grounded: true, coyoteTime: 0, jumpBuffer: 0, jumpHeld: false, fallStart: 0, kx: 0, ky: 0 };
  return conn;
}

export class FakeFiniteWorldWorker {
  static instance: FakeFiniteWorldWorker | undefined;
  static instances: FakeFiniteWorldWorker[] = [];
  static responseFloor: GeneratedFloor | undefined;
  static lastRequest: { readonly finiteFloorArtifact?: string } | undefined;
  private listener: ((event: MessageEvent) => void) | undefined;
  terminated = false;

  constructor(url: URL, options: WorkerOptions) {
    void url;
    void options;
    FakeFiniteWorldWorker.instance = this;
    FakeFiniteWorldWorker.instances.push(this);
  }

  addEventListener(_type: string, listener: (event: MessageEvent) => void): void { this.listener = listener; }
  postMessage(message: unknown): void {
    const request = (message as { request?: { finiteFloorArtifact?: string } }).request;
    FakeFiniteWorldWorker.lastRequest = request;
  }
  terminate(): void { this.terminated = true; }

  respond(): void {
    if (!FakeFiniteWorldWorker.responseFloor) return;
    this.listener?.({ data: { id: 0, floor: FakeFiniteWorldWorker.responseFloor } } as MessageEvent);
  }

  reject(message = "worker rejected"): void {
    this.listener?.({ data: { id: 0, error: message } } as MessageEvent);
  }
}

export function snapshotAtFloor(
  floor: number,
  hp = 10,
  respawnAtTick: number | null = null,
): ServerSnapshot {
  const generation = generationIdentity(new World(WORLD_SEED, floor, LEVEL.Dungeon));
  return snapshotData({ floor, hp, respawnAtTick, generation });
}

export function snapshotAtFloorWithArtifact(floor: number, artifact: string): ServerSnapshot {
  const generation = generationIdentity(new World(WORLD_SEED, floor, LEVEL.Dungeon));
  return snapshotData({ floor, hp: 10, respawnAtTick: null, generation, finiteFloorArtifact: artifact });
}

export function snapshotAtFloorWithFeatures(floor: number, features: WorldFeatures): ServerSnapshot {
  const generation = generationIdentity(new World(WORLD_SEED, floor, { level: LEVEL.Dungeon, features }));
  return snapshotData({ floor, hp: 10, respawnAtTick: null, generation });
}

export function snapshotAtFloorWithGeneration(
  floor: number,
  generation: GenerationIdentity,
): ServerSnapshot {
  return snapshotData({ floor, hp: 10, respawnAtTick: null, generation });
}

function generationIdentity(world: World): GenerationIdentity {
  const generation = world.floorIdentity;
  if (!generation) throw new Error("Expected generated floor identity in test fixture.");
  return generation;
}

function snapshotData(input: { readonly floor: number; readonly hp: number; readonly respawnAtTick: number | null; readonly generation: GenerationIdentity; readonly finiteFloorArtifact?: string }): ServerSnapshot {
  return {
    type: "snapshot", tick: 1, lastSeq: 0, lastProjectedServerTick: 0,
    self: { x: 0, y: 0, z: 0, zVel: 0, grounded: true, coyoteTime: 0, jumpBuffer: 0, jumpHeld: false, kx: 0, ky: 0, hp: input.hp, maxHp: 10, fx: [], floor: input.floor, respawnAtTick: input.respawnAtTick, generation: input.generation, ...(input.finiteFloorArtifact ? { finiteFloorArtifact: input.finiteFloorArtifact } : {}) },
    inventory: [], hotbar: [], weapon: null, party: null, entities: [], left: [], events: [], areas: [],
  };
}
