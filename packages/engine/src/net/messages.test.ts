import { describe, expect, it } from "vitest";
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeMessage,
  type ClientInput,
  type ClientMessage,
  type ServerSnapshot,
} from "./messages.js";

describe("protocol", () => {
  it("round-trips a client input", () => {
    const input: ClientInput = { type: "input", seq: 7, moveX: 1, moveY: -1, jump: true };
    expect(decodeClientMessage(encodeMessage(input))).toEqual(input);
  });

  it("round-trips gameplay intents", () => {
    const intents: ClientMessage[] = [
      { type: "attack", dirX: 1, dirY: 0 },
      { type: "useSlot", slot: 2, targetX: 10.5, targetY: -3.25 },
      { type: "throwTorch", dirX: 0.6, dirY: -0.8 },
      { type: "pickup" },
      { type: "drop", item: "rag" },
      { type: "assign", slot: 4, item: "bandage" },
      { type: "assign", slot: 4, item: null },
      { type: "equip", item: "knife" },
      { type: "equip", item: null },
      { type: "interact" },
      { type: "craft", recipe: "bandage" },
      { type: "stash", op: "put", index: 3 },
      { type: "party", op: "invite", target: "p2" },
      { type: "chat", channel: "party", text: "behind you" },
      { type: "suicide" },
      { type: "hello", protocol: 8, name: "Crawler", clientId: "client-1", level: "sandbox" },
    ];
    for (const intent of intents) {
      expect(decodeClientMessage(encodeMessage(intent))).toEqual(intent);
    }
  });

  it("round-trips a server snapshot", () => {
    const snap: ServerSnapshot = {
      type: "snapshot",
      tick: 42,
      lastSeq: 7,
      self: {
        x: 1.5,
        y: 2.5,
        z: 0,
        zVel: 0,
        grounded: true,
        coyoteTime: 0,
        jumpBuffer: 0,
        jumpHeld: false,
        kx: 0,
        ky: 0,
        hp: 22,
        maxHp: 30,
        fx: ["bleeding"],
      },
      inventory: [
        { item: "rag", qty: 2 },
        { item: "bandage", qty: 5 },
      ],
      hotbar: ["bandage", null, null, null, null, null, null, null, null],
      weapon: "knife",
      party: { id: "party1", members: [{ id: "p2", name: "Ally", x: 100, y: 50 }] },
      entities: [
        {
          id: "e1",
          kind: "enemy",
          defId: "slime",
          x: 9,
          y: 9,
          z: 0,
          hp: 12,
          maxHp: 12,
          fx: [],
          anim: "walk",
          aimX: 0.6,
          aimY: -0.8,
          faceX: 0.6,
          faceY: -0.8,
        },
        { id: "i1", kind: "item", defId: "knife", x: 8, y: 8, z: 0 },
        {
          id: "t1",
          kind: "torch",
          defId: "torch",
          x: 12,
          y: 12,
          z: 0,
          vx: 1.5,
          vy: 0,
          vz: 2.1,
          state: "flying",
          air: true,
        },
        { id: "t2", kind: "torch", defId: "torch", x: 6, y: 6, z: 0, state: "placed", expiresAtTick: 3742 },
      ],
      left: ["p3"],
      events: [
        { t: "hit", id: "e1", amount: -6 },
        { t: "toast", msg: "Crafted bandage" },
        { t: "chat", channel: "party", from: "p2", name: "Ally", text: "hi" },
      ],
      areas: [{ x: 5, y: 5, defId: "area-fire" }, { x: 6, y: 5, defId: null }],
    };
    expect(decodeServerMessage(encodeMessage(snap))).toEqual(snap);
  });

  it("rejects malformed and hostile input (the client is untrusted)", () => {
    expect(decodeClientMessage("not json")).toBeNull();
    expect(decodeClientMessage('{"type":"nope"}')).toBeNull();
    // moveX outside {-1,0,1} — a speedhack attempt.
    expect(
      decodeClientMessage('{"type":"input","seq":1,"moveX":50,"moveY":0,"jump":false}'),
    ).toBeNull();
    // Hotbar slot out of range.
    expect(decodeClientMessage('{"type":"assign","slot":99,"item":"rag"}')).toBeNull();
    // Oversized chat.
    expect(
      decodeClientMessage(
        `{"type":"chat","channel":"local","text":"${"x".repeat(500)}"}`,
      ),
    ).toBeNull();
    // Missing clientId on hello.
    expect(
      decodeClientMessage('{"type":"hello","protocol":2,"name":"A"}'),
    ).toBeNull();
  });
});
