import { parseSlashCommand } from "./chatSlashCommands.js";

/**
 * Pure slash-command parser for the chat line (Epic 7.9): raw input + context in,
 * one ChatCommand out — no network, no DOM, fully unit-tested. Unknown commands
 * become client-local error lines and are never sent as chat (ASSUMPTION #19).
 */

/** The four sendable channels — mirrors clientChatSchema's channel enum minus "system". */
export type ChatSendChannel = "party" | "local" | "global" | "dm";

export type ChatCommand =
  | { kind: "none" }
  | { kind: "send"; channel: ChatSendChannel; text: string; target?: string }
  | { kind: "who" }
  | {
      kind: "party";
      op: "invite" | "accept" | "decline" | "leave" | "kick";
      target?: string;
    }
  | {
      kind: "moderation";
      op: "mute" | "unmute" | "block" | "unblock" | "report";
      target: string;
      reason?: string;
    }
  /** Client-local output (e.g. /help) — rendered as system lines, never sent. */
  | { kind: "local-lines"; lines: string[] }
  | { kind: "error"; message: string }
  /** Dev-gated passthroughs — the server drops these unless debugCommands is on. */
  | { kind: "debug-god" }
  | { kind: "debug-teleport"; x: number; y: number };

export const HELP_LINES: readonly string[] = [
  "/party invite <name> | accept | decline — answer invitations",
  "/party leave | kick <name> — manage membership",
  "/mute|unmute|block|unblock <name> — control contact",
  "/report <name> [reason] — flag abuse for review",
  "/help — this list",
  "/dm <name> <message> — direct message a contact (/whisper works too)",
  "/r <message> — reply to your latest DM thread",
  "/who — who's online and nearby",
  "Tabs: global reaches everyone, local is nearby, party is your party.",
];

export const ADMIN_HELP_LINES: readonly string[] = [
  "/admin list — show connected players and ids",
  "/admin track <playerId> | free | stop | next | previous",
  "/admin heal|kill <playerId>",
  "/admin god|handicap <playerId> on|off",
  "/admin teleport <playerId> spawn|safeRoom|self|player <targetId>",
  "/admin kill-enemies <playerId> [radius]",
  "/admin map <dungeon|sandbox> <floor> <x> <y> [radius]",
  "/admin spawn <enemy|item|weapon> <id> <x> <y> [level] [floor]",
];

/**
 * Parses one submitted chat line. Plain text sends on the active tab's channel;
 * on the dm tab it auto-targets the current DM partner (the brief's auto-prefix).
 */
export function parseChatInput(
  raw: string,
  activeChannel: ChatSendChannel,
  context: string | null | { readonly lastDmPartner: string | null; readonly activeAdmin: boolean },
): ChatCommand {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "none" };
  const chatContext = normalizeContext(context);
  if (trimmed.startsWith("/")) return parseSlashCommand(trimmed, { ...chatContext, channel: activeChannel });
  if (activeChannel !== "dm") return { kind: "send", channel: activeChannel, text: trimmed };
  if (!chatContext.lastDmPartner) {
    return { kind: "error", message: "No DM thread yet — use /dm <name> <message>" };
  }
  return { kind: "send", channel: "dm", text: trimmed, target: chatContext.lastDmPartner };
}

function normalizeContext(
  context: string | null | { readonly lastDmPartner: string | null; readonly activeAdmin: boolean },
): { readonly lastDmPartner: string | null; readonly activeAdmin: boolean } {
  return typeof context === "object"
    ? context ?? { lastDmPartner: null, activeAdmin: false }
    : { lastDmPartner: context, activeAdmin: false };
}
