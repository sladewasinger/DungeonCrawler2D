import { describe, expect, it } from "vitest";
import { ADMIN_HELP_LINES, HELP_LINES, parseChatInput } from "./commands.js";

describe("parseChatInput", () => {
  it("plain text sends on the active channel", () => {
    expect(parseChatInput("hello all", "global", null)).toEqual({
      kind: "send",
      channel: "global",
      text: "hello all",
    });
    expect(parseChatInput("  nearby?  ", "local", null)).toEqual({
      kind: "send",
      channel: "local",
      text: "nearby?",
    });
  });

  it("empty and whitespace-only input is a no-op", () => {
    expect(parseChatInput("", "global", null)).toEqual({ kind: "none" });
    expect(parseChatInput("   ", "party", null)).toEqual({ kind: "none" });
  });

  it("plain text on the dm tab auto-targets the current DM partner", () => {
    expect(parseChatInput("hey again", "dm", "Wren")).toEqual({
      kind: "send",
      channel: "dm",
      text: "hey again",
      target: "Wren",
    });
    expect(parseChatInput("hey?", "dm", null)).toMatchObject({ kind: "error" });
  });

  it("/help returns client-local lines, never a send", () => {
    expect(parseChatInput("/help", "global", null)).toEqual({
      kind: "local-lines",
      lines: [...HELP_LINES],
    });
  });

  it("/help includes the complete admin command summary only for active admins", () => {
    expect(parseChatInput("/help", "global", {
      lastDmPartner: null,
      activeAdmin: true,
    })).toEqual({
      kind: "local-lines",
      lines: [...HELP_LINES, ...ADMIN_HELP_LINES],
    });
    expect(ADMIN_HELP_LINES.join("\n")).toContain("/admin list");
    expect(ADMIN_HELP_LINES.join("\n")).toContain("/admin map");
    expect(ADMIN_HELP_LINES.join("\n")).toContain("/admin spawn");
  });

  // The parser command table, one row per command shape.
  it.each([
    ["/dm Wren meet at the door", { kind: "send", channel: "dm", text: "meet at the door", target: "Wren" }],
    ["/whisper Wren psst", { kind: "send", channel: "dm", text: "psst", target: "Wren" }],
    ["/DM Wren caps ok", { kind: "send", channel: "dm", text: "caps ok", target: "Wren" }],
    ["/dm Wren", { kind: "error", message: "Usage: /dm <name> <message>" }],
    ["/dm", { kind: "error", message: "Usage: /dm <name> <message>" }],
    ["/who", { kind: "who" }],
    ["/party invite Wren", { kind: "party", op: "invite", target: "Wren" }],
    ["/party accept", { kind: "party", op: "accept" }],
    ["/party decline", { kind: "party", op: "decline" }],
    ["/party leave", { kind: "party", op: "leave" }],
    ["/party kick Wren", { kind: "party", op: "kick", target: "Wren" }],
    ["/party dance", {
      kind: "error",
      message: "Usage: /party invite <name> | accept | decline | leave | kick <name>",
    }],
    ["/mute Wren", { kind: "moderation", op: "mute", target: "wren" }],
    ["/unmute Wren", { kind: "moderation", op: "unmute", target: "wren" }],
    ["/block Wren", { kind: "moderation", op: "block", target: "wren" }],
    ["/unblock Wren", { kind: "moderation", op: "unblock", target: "wren" }],
    ["/report Wren chat abuse", { kind: "moderation", op: "report", target: "wren", reason: "chat abuse" }],
    ["/report", { kind: "error", message: "Usage: /report <name> [reason]" }],
    ["/god", { kind: "debug-god" }],
    ["/tp 10 -20", { kind: "debug-teleport", x: 10, y: -20 }],
    ["/tp nowhere", { kind: "error", message: "Usage: /tp <x> <y>" }],
    ["/dance", { kind: "error", message: "Unknown command /dance — try /help" }],
  ] as const)("%s", (raw, expected) => {
    expect(parseChatInput(raw, "global", null)).toEqual(expected);
  });

  it("/r replies to the last DM partner, and errors without a thread", () => {
    expect(parseChatInput("/r on my way", "global", "Rex")).toEqual({
      kind: "send",
      channel: "dm",
      text: "on my way",
      target: "Rex",
    });
    expect(parseChatInput("/r", "global", "Rex")).toEqual({ kind: "error", message: "Usage: /r <message>" });
    expect(parseChatInput("/r hi", "global", null)).toMatchObject({ kind: "error" });
  });
});
