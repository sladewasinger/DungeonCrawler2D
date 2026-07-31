import type { AdminCommand, AdminMap, AdminPlayer } from "@dc2d/engine";
import type { FloorRegistry } from "../../floors/floorRegistry.js";
import type { GameSim } from "../../sim/core/index.js";
import { setSpectatorView, type SpectatorSession, type SpectatorView } from "./spectator/spectatorSession.js";

export interface AdminWorldContext {
  readonly floors: FloorRegistry;
  readonly sandbox: GameSim;
}

export interface AdminWorldResult {
  readonly ok: boolean;
  readonly code?: string;
  readonly message?: string;
}

export interface AdminWorldCommandInput {
  readonly context: AdminWorldContext;
  readonly spectator: SpectatorSession;
  readonly command: AdminCommand;
}

export function executeAdminWorldCommand(
  input: AdminWorldCommandInput,
): AdminWorldResult | null {
  const { context, spectator, command } = input;
  if (command.op === "map") return inspectAdminMap(context, spectator, command);
  if (command.op === "spawn") return spawnAdminEntity(context, command);
  if (command.op === "despawn") return despawnAdminEntity(context, command);
  return null;
}

export function inspectAdminMap(
  context: AdminWorldContext,
  spectator: SpectatorSession,
  command: Extract<AdminCommand, { op: "map" }>,
): AdminWorldResult {
  if (!simForLocation(context, command)) return { ok: false, code: "map_not_available" };
  setSpectatorView(spectator, {
    level: command.level,
    floor: command.floor,
    x: command.x,
    y: command.y,
    radius: command.radius,
  });
  return { ok: true };
}

export function spawnAdminEntity(
  context: AdminWorldContext,
  command: Extract<AdminCommand, { op: "spawn" }>,
): AdminWorldResult {
  const sim = simForLocation(context, command);
  return sim ? sim.admin.execute(command, null) : { ok: false, code: "map_not_available" };
}

export function despawnAdminEntity(
  context: AdminWorldContext,
  command: Extract<AdminCommand, { op: "despawn" }>,
): AdminWorldResult {
  const sim = simForLocation(context, command);
  return sim ? sim.admin.execute(command, null) : { ok: false, code: "map_not_available" };
}

export function mapForInspector(
  context: AdminWorldContext,
  spectator: SpectatorSession,
  players: readonly AdminPlayer[],
): AdminMap {
  const view = inspectorView(spectator, players, context.sandbox.world.floor);
  const sim = simForLocation(context, view) ?? context.sandbox;
  return sim.admin.map({ x: view.x, y: view.y, radius: view.radius });
}

export function mapForSpectator(
  context: AdminWorldContext,
  spectator: SpectatorSession,
  players: readonly AdminPlayer[],
): AdminMap | null {
  if (spectator.mode === "off") return null;
  if (spectator.mode === "free") {
    const view = inspectorView(spectator, players, context.sandbox.world.floor);
    const sim = simForLocation(context, view) ?? context.sandbox;
    return sim.admin.map({ x: view.x, y: view.y, radius: view.radius });
  }
  const target = trackedPlayer(spectator, players);
  if (!target) return null;
  const sim = simForLocation(context, target);
  return sim?.admin.map({ x: target.x, y: target.y, radius: 10 }) ?? null;
}

function inspectorView(
  spectator: SpectatorSession,
  players: readonly AdminPlayer[],
  sandboxFloor: number,
): SpectatorView {
  if (spectator.mapView) return spectator.mapView;
  const player = players[0];
  if (player) return { level: player.level, floor: player.floor, x: player.x, y: player.y, radius: 10 };
  return { level: "sandbox", floor: sandboxFloor, x: 0, y: 0, radius: 10 };
}

function trackedPlayer(
  spectator: SpectatorSession,
  players: readonly AdminPlayer[],
): AdminPlayer | undefined {
  if (spectator.mode !== "track" || !spectator.playerId) return undefined;
  return players.find((player) => player.playerId === spectator.playerId);
}

function simForLocation(
  context: AdminWorldContext,
  location: { level: "dungeon" | "sandbox"; floor: number },
): GameSim | undefined {
  if (location.level === "sandbox") {
    return location.floor === context.sandbox.world.floor ? context.sandbox : undefined;
  }
  return context.floors.activeSims().find((sim) => sim.world.floor === location.floor);
}
