import type { SpectatorMode } from "@dc2d/engine";
import { spectatorUrl } from "../../../spectator/spectatorUrl.js";
import type { FullSpectatorEmbedState } from "./fullSpectatorEmbed.js";

const SPECTATOR_CONTROL_MESSAGE_TYPE = "dc2d-spectator-control";

export interface SentSpectatorEmbedState {
  readonly playerId: string | null;
  readonly mode: Exclude<SpectatorMode, "off"> | null;
}

interface SpectatorEmbedMessagePlan {
  readonly messages: Array<Record<string, unknown>>;
  readonly sent: SentSpectatorEmbedState | null;
}

export function spectatorEmbedMessagePlan(
  previous: SentSpectatorEmbedState | null,
  state: FullSpectatorEmbedState,
): SpectatorEmbedMessagePlan {
  if (!state.active) return { messages: [], sent: previous };
  const targetChanged = previous?.playerId !== state.playerId;
  const modeAfterTarget = targetChanged && state.playerId ? "track" : previous?.mode ?? null;
  return {
    messages: [
      ...targetChangeMessage(targetChanged, state.playerId),
      ...modeChangeMessage(state.mode, modeAfterTarget),
    ],
    sent: sentState(state),
  };
}

export function spectatorEmbedSource(
  search: string,
  state: FullSpectatorEmbedState,
): string | null {
  if (!state.active || state.mode === "off") return null;
  return spectatorUrl(search, {
    embedded: true,
    hud: false,
    mode: state.mode,
    ...(state.playerId ? { playerId: state.playerId } : {}),
  });
}

export function spectatorEmbedZoomMessage(
  direction: "in" | "out",
): Record<string, unknown> {
  return controlMessage("zoom", { direction });
}

function sentState(state: FullSpectatorEmbedState): SentSpectatorEmbedState {
  return {
    playerId: state.playerId,
    mode: state.mode === "off" ? null : state.mode,
  };
}

function targetChangeMessage(
  changed: boolean,
  playerId: string | null,
): Array<Record<string, unknown>> {
  return changed && playerId
    ? [controlMessage("target", { playerId })]
    : [];
}

function modeChangeMessage(
  mode: FullSpectatorEmbedState["mode"],
  previous: SentSpectatorEmbedState["mode"],
): Array<Record<string, unknown>> {
  return mode !== "off" && mode !== previous
    ? [controlMessage("mode", { mode })]
    : [];
}

function controlMessage(
  action: string,
  details: Record<string, unknown>,
): Record<string, unknown> {
  return { type: SPECTATOR_CONTROL_MESSAGE_TYPE, action, ...details };
}
