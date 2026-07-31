import {
  ADMIN_HELP_LINES,
  HELP_LINES,
  type ChatCommand,
  type ChatSendChannel,
} from "./commands.js";

export interface SlashCommandContext {
  readonly lastDmPartner: string | null;
  readonly activeAdmin: boolean;
  readonly channel: ChatSendChannel;
}

export function parseSlashCommand(
  trimmed: string,
  context: SlashCommandContext,
): ChatCommand {
  const { cmd, rest } = splitCommand(trimmed);
  if (cmd === "/admin") return context.activeAdmin
    ? { kind: "send", channel: context.channel, text: trimmed }
    : unknownCommand(cmd);
  if (isModerationCommand(cmd)) return parseModeration(cmd.slice(1) as ModerationOp, rest);
  return parseKnownSlash({ cmd, rest, context });
}

function parseKnownSlash(input: {
  readonly cmd: string;
  readonly rest: string;
  readonly context: SlashCommandContext;
}): ChatCommand {
  const parser = KNOWN_SLASH_COMMANDS[input.cmd];
  return parser ? parser(input) : unknownCommand(input.cmd);
}

type KnownSlashParser = (input: {
  readonly rest: string;
  readonly context: SlashCommandContext;
}) => ChatCommand;

const KNOWN_SLASH_COMMANDS: Record<string, KnownSlashParser> = {
  "/help": ({ context }) => helpCommand(context.activeAdmin),
  "/who": () => ({ kind: "who" }),
  "/god": () => ({ kind: "debug-god" }),
  "/dm": ({ rest }) => parseDm(rest),
  "/whisper": ({ rest }) => parseDm(rest),
  "/r": ({ rest, context }) => parseReply(rest, context.lastDmPartner),
  "/party": ({ rest }) => parseParty(rest),
  "/tp": ({ rest }) => parseTeleport(rest),
};

function helpCommand(activeAdmin: boolean): ChatCommand {
  return { kind: "local-lines", lines: [...HELP_LINES, ...(activeAdmin ? ADMIN_HELP_LINES : [])] };
}

function splitCommand(raw: string): { cmd: string; rest: string } {
  const spaceAt = raw.indexOf(" ");
  if (spaceAt < 0) return { cmd: raw.toLowerCase(), rest: "" };
  return { cmd: raw.slice(0, spaceAt).toLowerCase(), rest: raw.slice(spaceAt + 1).trim() };
}

function parseDm(rest: string): ChatCommand {
  const spaceAt = rest.indexOf(" ");
  const name = spaceAt < 0 ? rest : rest.slice(0, spaceAt);
  const message = spaceAt < 0 ? "" : rest.slice(spaceAt + 1).trim();
  return name && message
    ? { kind: "send", channel: "dm", text: message, target: name }
    : { kind: "error", message: "Usage: /dm <name> <message>" };
}

function parseReply(rest: string, lastDmPartner: string | null): ChatCommand {
  if (!rest) return { kind: "error", message: "Usage: /r <message>" };
  return lastDmPartner
    ? { kind: "send", channel: "dm", text: rest, target: lastDmPartner }
    : { kind: "error", message: "No DM thread to reply to — use /dm <name> <message>" };
}

function parseTeleport(rest: string): ChatCommand {
  const [xRaw, yRaw] = rest.split(/\s+/);
  const x = Number(xRaw);
  const y = Number(yRaw);
  return Number.isFinite(x) && Number.isFinite(y)
    ? { kind: "debug-teleport", x, y }
    : { kind: "error", message: "Usage: /tp <x> <y>" };
}

function parseParty(rest: string): ChatCommand {
  const { cmd, rest: target } = splitCommand(rest);
  if (["accept", "decline", "leave"].includes(cmd) && !target) {
    return { kind: "party", op: cmd as "accept" | "decline" | "leave" };
  }
  if ((cmd === "invite" || cmd === "kick") && target) return { kind: "party", op: cmd, target };
  return { kind: "error", message: "Usage: /party invite <name> | accept | decline | leave | kick <name>" };
}

type ModerationOp = "mute" | "unmute" | "block" | "unblock" | "report";

function isModerationCommand(cmd: string): boolean {
  return ["/mute", "/unmute", "/block", "/unblock", "/report"].includes(cmd);
}

function parseModeration(op: ModerationOp, rest: string): ChatCommand {
  const { cmd: target, rest: reason } = splitCommand(rest);
  if (!target) return { kind: "error", message: `Usage: /${op} <name>${op === "report" ? " [reason]" : ""}` };
  return { kind: "moderation", op, target, ...(op === "report" && reason ? { reason } : {}) };
}

function unknownCommand(cmd: string): ChatCommand {
  return { kind: "error", message: `Unknown command ${cmd} — try /help` };
}
