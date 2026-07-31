import type { SpectatorMode } from "@dc2d/engine";

const SPECTATOR_CONTROL_TYPE = "dc2d-spectator-control";

interface SpectatorControlBase {
  readonly type: typeof SPECTATOR_CONTROL_TYPE;
}

export type SpectatorControlMessage = SpectatorControlBase & (
  | { readonly action: "target"; readonly playerId: string }
  | { readonly action: "mode"; readonly mode: SpectatorMode }
  | { readonly action: "hud"; readonly visible: boolean }
  | { readonly action: "center" }
  | { readonly action: "zoom"; readonly direction: "in" | "out" }
  | { readonly action: "zoom-reset" }
);

export function spectatorControlMessage(value: unknown): SpectatorControlMessage | null {
  if (!isControlRecord(value)) return null;
  const action = typeof value.action === "string" ? value.action : "";
  return CONTROL_MESSAGE_PARSERS[action]?.(value) ?? null;
}

type ControlMessageParser = (
  value: Record<string, unknown>,
) => SpectatorControlMessage | null;

const CONTROL_MESSAGE_PARSERS: Readonly<Record<string, ControlMessageParser>> = {
  target: targetMessage,
  mode: modeMessage,
  hud: hudMessage,
  center: centerMessage,
  zoom: zoomMessage,
  "zoom-reset": zoomResetMessage,
};

function isControlRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" &&
    (value as Record<string, unknown>).type === SPECTATOR_CONTROL_TYPE;
}

function targetMessage(value: Record<string, unknown>): SpectatorControlMessage | null {
  const playerId = value.playerId;
  if (!exactKeys(value, ["type", "action", "playerId"])) return null;
  if (typeof playerId !== "string" || playerId.length < 1 || playerId.length > 64) return null;
  return { type: SPECTATOR_CONTROL_TYPE, action: "target", playerId };
}

function modeMessage(value: Record<string, unknown>): SpectatorControlMessage | null {
  if (!exactKeys(value, ["type", "action", "mode"])) return null;
  if (value.mode !== "free" && value.mode !== "track") return null;
  return { type: SPECTATOR_CONTROL_TYPE, action: "mode", mode: value.mode };
}

function hudMessage(value: Record<string, unknown>): SpectatorControlMessage | null {
  if (!exactKeys(value, ["type", "action", "visible"])) return null;
  if (typeof value.visible !== "boolean") return null;
  return { type: SPECTATOR_CONTROL_TYPE, action: "hud", visible: value.visible };
}

function centerMessage(value: Record<string, unknown>): SpectatorControlMessage | null {
  return exactKeys(value, ["type", "action"])
    ? { type: SPECTATOR_CONTROL_TYPE, action: "center" }
    : null;
}

function zoomMessage(value: Record<string, unknown>): SpectatorControlMessage | null {
  if (!exactKeys(value, ["type", "action", "direction"])) return null;
  if (value.direction !== "in" && value.direction !== "out") return null;
  return { type: SPECTATOR_CONTROL_TYPE, action: "zoom", direction: value.direction };
}

function zoomResetMessage(value: Record<string, unknown>): SpectatorControlMessage | null {
  return exactKeys(value, ["type", "action"])
    ? { type: SPECTATOR_CONTROL_TYPE, action: "zoom-reset" }
    : null;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}
