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

const UNKNOWN = (cmd: string): ChatCommand => ({
  kind: "error",
  message: `Unknown command ${cmd} — try /help`,
});

/** Splits "/dm name rest of message" into its command word and argument tail. */
function splitCommand(raw: string): { cmd: string; rest: string } {
  const spaceAt = raw.indexOf(" ");
  if (spaceAt < 0) return { cmd: raw.toLowerCase(), rest: "" };
  return { cmd: raw.slice(0, spaceAt).toLowerCase(), rest: raw.slice(spaceAt + 1).trim() };
}

function parseDm(rest: string): ChatCommand {
  // Split by hand (not splitCommand) so the target keeps its display-name casing.
  const spaceAt = rest.indexOf(" ");
  const name = spaceAt < 0 ? rest : rest.slice(0, spaceAt);
  const message = spaceAt < 0 ? "" : rest.slice(spaceAt + 1).trim();
  if (!name || !message) return { kind: "error", message: "Usage: /dm <name> <message>" };
  return { kind: "send", channel: "dm", text: message, target: name };
}

function parseReply(rest: string, lastDmPartner: string | null): ChatCommand {
  if (!rest) return { kind: "error", message: "Usage: /r <message>" };
  if (!lastDmPartner) {
    return { kind: "error", message: "No DM thread to reply to — use /dm <name> <message>" };
  }
  return { kind: "send", channel: "dm", text: rest, target: lastDmPartner };
}

function parseTeleport(rest: string): ChatCommand {
  const [xRaw, yRaw] = rest.split(/\s+/);
  const x = Number(xRaw);
  const y = Number(yRaw);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { kind: "error", message: "Usage: /tp <x> <y>" };
  return { kind: "debug-teleport", x, y };
}

function parseParty(rest: string): ChatCommand {
  const { cmd, rest: target } = splitCommand(rest);
  const untargeted = new Set(["accept", "decline", "leave"]);
  if (untargeted.has(cmd) && !target) {
    return {
      kind: "party",
      op: cmd as "accept" | "decline" | "leave",
    };
  }
  if ((cmd === "invite" || cmd === "kick") && target) {
    return { kind: "party", op: cmd, target };
  }
  return {
    kind: "error",
    message: "Usage: /party invite <name> | accept | decline | leave | kick <name>",
  };
}

function parseModeration(
  op: "mute" | "unmute" | "block" | "unblock" | "report",
  rest: string,
): ChatCommand {
  const { cmd: target, rest: reason } = splitCommand(rest);
  if (!target) {
    return {
      kind: "error",
      message: `Usage: /${op} <name>${op === "report" ? " [reason]" : ""}`,
    };
  }
  return {
    kind: "moderation",
    op,
    target,
    ...(op === "report" && reason ? { reason } : {}),
  };
}

function parseSlash(trimmed: string, lastDmPartner: string | null): ChatCommand {
  const { cmd, rest } = splitCommand(trimmed);
  const moderation = ["/mute", "/unmute", "/block", "/unblock", "/report"];
  if (moderation.includes(cmd)) {
    return parseModeration(cmd.slice(1) as "mute" | "unmute" | "block" | "unblock" | "report", rest);
  }
  return parseKnownSlash(cmd, rest, lastDmPartner);
}

function parseKnownSlash(cmd: string, rest: string, lastDmPartner: string | null): ChatCommand {
  const staticCommands: Record<string, ChatCommand> = {
    "/help": { kind: "local-lines", lines: [...HELP_LINES] },
    "/who": { kind: "who" },
    "/god": { kind: "debug-god" },
  };
  const direct = staticCommands[cmd];
  if (direct) return direct;
  switch (cmd) {
    case "/dm":
    case "/whisper":
      return parseDm(rest);
    case "/r":
      return parseReply(rest, lastDmPartner);
    case "/party":
      return parseParty(rest);
    case "/tp":
      return parseTeleport(rest);
    default:
      return UNKNOWN(cmd);
  }
}

/**
 * Parses one submitted chat line. Plain text sends on the active tab's channel;
 * on the dm tab it auto-targets the current DM partner (the brief's auto-prefix).
 */
export function parseChatInput(
  raw: string,
  activeChannel: ChatSendChannel,
  lastDmPartner: string | null,
): ChatCommand {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "none" };
  if (trimmed.startsWith("/")) return parseSlash(trimmed, lastDmPartner);
  if (activeChannel !== "dm") return { kind: "send", channel: activeChannel, text: trimmed };
  if (!lastDmPartner) {
    return { kind: "error", message: "No DM thread yet — use /dm <name> <message>" };
  }
  return { kind: "send", channel: "dm", text: trimmed, target: lastDmPartner };
}
