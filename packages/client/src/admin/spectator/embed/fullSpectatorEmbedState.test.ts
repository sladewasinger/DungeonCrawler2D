import { describe, expect, it, vi } from "vitest";
import {
  focusSpectatorEmbedFrame,
} from "./fullSpectatorEmbed.js";
import {
  spectatorEmbedMessagePlan,
  spectatorEmbedSource,
  spectatorEmbedZoomMessage,
} from "./fullSpectatorEmbedMessages.js";

describe("spectatorEmbedMessagePlan", () => {
  it("deduplicates unchanged target and mode updates", () => {
    const state = { active: true, playerId: "p1", mode: "free" as const };
    const initial = spectatorEmbedMessagePlan(null, state);
    expect(initial.messages.map(({ action }) => action)).toEqual(["target", "mode"]);
    expect(spectatorEmbedMessagePlan(initial.sent, state).messages).toEqual([]);
  });

  it("restores free mode after selecting a different target", () => {
    const previous = { playerId: "p1", mode: "free" as const };
    const next = spectatorEmbedMessagePlan(previous, {
      active: true,
      playerId: "p2",
      mode: "free",
    });
    expect(next.messages.map(({ action }) => action)).toEqual(["target", "mode"]);
  });

  it("does not resend controls while the viewer is inactive", () => {
    const previous = { playerId: "p1", mode: "track" as const };
    const next = spectatorEmbedMessagePlan(previous, {
      active: false,
      playerId: "p2",
      mode: "off",
    });
    expect(next).toEqual({ messages: [], sent: previous });
  });

  it("only mounts an exact-target spectator route while active", () => {
    expect(spectatorEmbedSource("?server=ws://localhost:8877", {
      active: false,
      playerId: "p2",
      mode: "off",
    })).toBeNull();
    const source = spectatorEmbedSource("?server=ws://localhost:8877", {
      active: true,
      playerId: "p2",
      mode: "free",
    });
    expect(source).toContain("embed=admin");
    expect(source).toContain("mode=free");
    expect(source).toContain("target=p2");
  });

  it("relays camera zoom through the embedded spectator control channel", () => {
    expect(spectatorEmbedZoomMessage("in")).toEqual({
      type: "dc2d-spectator-control",
      action: "zoom",
      direction: "in",
    });
  });

  it("returns keyboard focus to the embedded camera after a zoom action", () => {
    const focus = vi.fn();

    focusSpectatorEmbedFrame({ contentWindow: { focus } });

    expect(focus).toHaveBeenCalledOnce();
  });
});
