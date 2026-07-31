import type { LevelId } from "@dc2d/engine";

export type SpectatorMode = "off" | "free" | "track";

export interface SpectatorSession {
  mode: SpectatorMode;
  playerId: string | null;
  mapView: SpectatorView | null;
}

export interface SpectatorView {
  readonly level: LevelId;
  readonly floor: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export function newSpectatorSession(): SpectatorSession {
  return { mode: "off", playerId: null, mapView: null };
}

export function trackSpectator(session: SpectatorSession, playerId: string | null): void {
  session.mode = playerId ? "track" : "off";
  session.playerId = playerId;
}

export function setFreeSpectator(session: SpectatorSession): void {
  session.mode = "free";
  session.playerId = null;
}

export function setSpectatorView(session: SpectatorSession, view: SpectatorView): void {
  session.mapView = view;
}

export function stopSpectator(session: SpectatorSession): void {
  session.mode = "off";
  session.playerId = null;
}
