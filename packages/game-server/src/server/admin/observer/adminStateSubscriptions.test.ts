import {
  LEVEL,
  World,
  decodeServerMessage,
  spawnRoomSpawn,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { FloorRegistry } from "../../../floors/floorRegistry.js";
import { GameSim } from "../../../sim/core/index.js";
import { content } from "../../../sim/integration/support.js";
import { PET_DEFINITIONS } from "../../../sim/pets/index.js";
import { PlayerStore } from "../../../store.js";
import { createAdminSession } from "../access/authorization.js";
import { AdminSessionRegistry } from "../access/sessionRegistry.js";
import { MemoryAdminAuditSink } from "../audit.js";
import { AdminController } from "../controller.js";
import {
  newSpectatorSession,
  setFreeSpectator,
  trackSpectator,
} from "../spectator/spectatorSession.js";
import { authenticatedAdminStateSubscriptions, ObserverSocket } from "./adminStateSubscriptionTestSupport.js";
import type { ConnState } from "../../types.js";

describe("admin state subscriptions", () => {
  it("includes a connected crawler still inside the reserved spawn room", () => {
    const runtime = adminRuntime();
    const joined = runtime.floors.base.addPlayer({ name: "New crawler", clientId: "spawn-room-client" });
    const expected = spawnRoomSpawn(0);
    const socket = new ObserverSocket();
    const sessions = new AdminSessionRegistry();
    const conn = connection();
    const subscriptions = authenticatedAdminStateSubscriptions({
      sessions,
      socket: socket as unknown as WebSocket,
      conn,
    });

    subscriptions.broadcast(runtime.controller, undefined, 250);

    const state = observerState(socket);
    expect(state).not.toHaveProperty("map");
    expect(state).not.toHaveProperty("palette");
    expect(state.players).toContainEqual(expect.objectContaining({
      playerId: joined.playerId,
      x: expected.x,
      y: expected.y,
      level: "dungeon",
    }));
  });

  it("encodes a tracked spectator map in the spawn room beyond 100,000 tiles", () => {
    const runtime = adminRuntime();
    const joined = runtime.floors.base.addPlayer({ name: "Spawn crawler", clientId: "spawn-map-client" });
    const spectator = newSpectatorSession();
    trackSpectator(spectator, joined.playerId);

    const state = runtime.controller.observerState(spectator);
    const encoded = decodeServerMessage(JSON.stringify(state));

    expect(state.spectatorMap?.center.y).toBeGreaterThan(100_000);
    expect(encoded).toEqual(state);
  });

  it("keeps a live map available when spectating in free-camera mode", () => {
    const runtime = adminRuntime();
    const spectator = newSpectatorSession();
    setFreeSpectator(spectator);

    const state = runtime.controller.observerState(spectator);

    expect(state.spectator.mode).toBe("free");
    expect(state.spectatorMap).not.toBeNull();
  });

  it("includes a spawn-room pet in inspector and tracked spectator maps", () => {
    const runtime = adminRuntime();
    const joined = runtime.floors.base.addPlayer({ name: "Pet owner", clientId: "pet-owner-client" });
    const petDefinition = PET_DEFINITIONS.find((definition) => definition.id === "pet-dino-tard")!;
    const pet = runtime.floors.base.spawnPet(
      petDefinition,
      joined.spawn.x + 1,
      joined.spawn.y,
    );
    const spectator = newSpectatorSession();
    const inspectorState = runtime.controller.state(spectator, createAdminSession());

    expect(inspectorState.map.entities).toContainEqual(expect.objectContaining({
      id: pet.id,
      kind: "pet",
      defId: petDefinition.id,
      name: petDefinition.name,
    }));

    trackSpectator(spectator, joined.playerId);
    const trackedState = runtime.controller.observerState(spectator);
    expect(trackedState.spectatorMap?.entities).toContainEqual(expect.objectContaining({
      id: pet.id,
      kind: "pet",
      defId: petDefinition.id,
      name: petDefinition.name,
    }));
    expect(decodeServerMessage(JSON.stringify(trackedState))).toEqual(trackedState);
  });
});

function adminRuntime(): { readonly floors: FloorRegistry; readonly controller: AdminController } {
  const store = new PlayerStore(null);
  const floors = new FloorRegistry({
    worldSeed: 123,
    content,
    store,
    rngSeedBase: 11,
    opts: { testFixtures: true },
  });
  const sandbox = new GameSim({
    world: new World(123, 1, LEVEL.Sandbox),
    content,
    store,
    rngSeed: 12,
    opts: { testFixtures: true },
  });
  const controller = new AdminController({
    floors,
    sandbox,
    audit: new MemoryAdminAuditSink(),
  });
  return { floors, controller };
}

function connection(): ConnState {
  return {
    playerId: null,
    lastMeaningfulActivityAt: null,
    lastAim: null,
    idleTimedOut: false,
    terminationReason: null,
    peerFingerprint: null,
    adminSession: createAdminSession(),
    peerAddress: "127.0.0.1",
    spectator: newSpectatorSession(),
  };
}

function observerState(socket: ObserverSocket): Extract<NonNullable<ReturnType<typeof decodeServerMessage>>, { type: "adminObserverState" }> {
  const message = decodeServerMessage(socket.sent[0] ?? "");
  if (message?.type !== "adminObserverState") throw new Error("expected an observer state update");
  return message;
}
