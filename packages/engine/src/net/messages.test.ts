import { describe, expect, it } from "vitest";
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeMessage,
  type ClientInput,
  type ServerSnapshot,
} from "./messages";

describe("protocol", () => {
  it("round-trips a client input", () => {
    const input: ClientInput = { type: "input", seq: 7, moveX: 1, moveY: -1, jump: true };
    expect(decodeClientMessage(encodeMessage(input))).toEqual(input);
  });

  it("round-trips a server snapshot", () => {
    const snap: ServerSnapshot = {
      type: "snapshot",
      tick: 42,
      lastSeq: 7,
      self: { x: 1.5, y: 2.5, z: 0, zVel: 0, grounded: true },
      others: [{ id: "p2", name: "Stranger", x: 9, y: 9, z: 3 }],
      left: ["p3"],
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
    // Non-integer seq.
    expect(
      decodeClientMessage('{"type":"input","seq":1.5,"moveX":0,"moveY":0,"jump":false}'),
    ).toBeNull();
    // Oversized name.
    expect(
      decodeClientMessage(
        `{"type":"hello","protocol":1,"name":"${"x".repeat(40)}"}`,
      ),
    ).toBeNull();
    // Missing jump field.
    expect(decodeClientMessage('{"type":"input","seq":1,"moveX":0,"moveY":0}')).toBeNull();
  });
});
