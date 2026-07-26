import {
  LEVEL,
  World,
  createBody,
  type MoveInput,
  type ServerWelcome,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { InputController } from "../../input/index.js";
import { Connection } from "../../net/connection.js";
import { ChatController, type ChatPort } from "../../ui/chat/controller.js";
import type { TouchVisualSnapshot } from "../../input/touch/index.js";
import { LiveHudSnapshotCache } from "./liveHudSnapshotCache.js";

function connection(): Connection {
  const conn = new Connection("ws://test", "Tester", "client");
  conn.world = new World(7, 0, LEVEL.Sandbox);
  conn.welcome = {
    type: "welcome",
    protocol: 1,
    playerId: "player",
    resumeToken: "token",
    worldSeed: 7,
    floor: 0,
    level: LEVEL.Sandbox,
    tickRate: 20,
    spawn: { x: 5.5, y: 5.5, z: 0 },
  } satisfies ServerWelcome;
  conn.body = createBody(5.5, 5.5, 0);
  conn.status = "connected";
  conn.hasReceivedSnapshot = true;
  conn.hp = 30;
  conn.maxHp = 30;
  return conn;
}

function chat(): ChatController {
  const port: ChatPort = {
    chatLog: [],
    chatSeq: 0,
    chat: () => {},
    who: () => {},
    partyCommand: () => {},
    moderate: () => {},
    debugGod: () => {},
    debugTeleport: () => {},
  };
  return new ChatController(port);
}

function inputState() {
  let touch: TouchVisualSnapshot | null = null;
  const input = {
    selectedHotbarSlot: () => null,
    armedThrowableSlot: () => null,
    touchVisual: () => touch,
  } as unknown as InputController;
  return {
    input,
    setTouch: (next: TouchVisualSnapshot | null) => {
      touch = next;
    },
  };
}

describe("LiveHudSnapshotCache", () => {
  it("reuses fixed HUD derivation while refreshing render-frequency fields", () => {
    const conn = connection();
    const input = inputState();
    const cache = new LiveHudSnapshotCache();
    const controller = chat();
    const first = cache.build(conn, input.input, null, controller, 60, 0, 12);
    const body = conn.body;
    if (!body) throw new Error("test connection is missing its body");
    const touch = {
      stick: null,
      buttons: { attack: false, jump: false, interact: false },
    };

    conn.rttMs = 42;
    body.x = 6.4;
    input.setTouch(touch);
    const second = cache.build(
      conn,
      input.input,
      { key: "R", label: "pick up" },
      controller,
      57,
      90,
      135,
    );

    expect(second).toBe(first);
    expect(second).toMatchObject({
      pingMs: 42,
      fps: 57,
      compassBearingDeg: 90,
      headingDeg: 135,
      biome: expect.any(String),
      interactionPrompt: { key: "R", label: "pick up" },
      touch,
    });
    expect(second.coords.x).not.toBe(5);
  });

  it("rebuilds once the fixed prediction clock advances", () => {
    const conn = connection();
    const input = inputState();
    const cache = new LiveHudSnapshotCache();
    const controller = chat();
    const first = cache.build(conn, input.input, null, controller, 60, 0);
    const neutral: MoveInput = {
      moveX: 0,
      moveY: 0,
      jump: false,
      run: false,
    };
    const world = conn.world;
    const body = conn.body;
    if (!world || !body) throw new Error("test connection is not initialized");

    conn.prediction.predict(world, body, neutral, conn, false);
    const next = cache.build(conn, input.input, null, controller, 60, 0);

    expect(next).not.toBe(first);
    expect(cache.build(conn, input.input, null, controller, 60, 0)).toBe(next);
  });

  it("invalidates when 2D combat help is completed", () => {
    const conn = connection();
    const input = inputState();
    const cache = new LiveHudSnapshotCache();
    const controller = chat();
    const initial = cache.build(conn, input.input, null, controller, 60, 0);

    conn.contextualActionsUsed.add("attack");
    const completed = cache.build(
      conn, input.input, null, controller, 60, 0,
    );

    expect(completed).not.toBe(initial);
    expect(completed.completedContextualActions).toEqual(["attack"]);
  });
});
