import {
  clampFiniteFloorPosition,
  safeRoomSpawn,
  type AdminCommand,
  type AdminPlayer,
} from "@dc2d/engine";
import { teleportPlayer } from "../actions/playerTeleport.js";
import { findPlayerSpawn } from "../spawn/playerSpawn.js";
import { despawnAdminEntity, spawnAdminEntity } from "./adminSpawning.js";
import { killAdminEnemies } from "./adminEnemyControls.js";
import { executeAdminPlayerMutation } from "./adminPlayerMutations.js";
import type { PlayerSlot, SimState } from "../state/state.js";

export interface AdminMutationResult {
  readonly ok: boolean;
  readonly code?: string;
  readonly message?: string;
}

export function adminPlayers(sim: SimState): AdminPlayer[] {
  return [...sim.players.values()]
    .filter((slot) => slot.connected)
    .map((slot) => adminPlayer(sim, slot));
}

export function executeAdminMutation(
  sim: SimState,
  command: AdminCommand,
  operatorPlayerId: string | null,
): AdminMutationResult {
  if (command.op === "spawn") return spawnAdminEntity(sim, command);
  if (command.op === "despawn") return despawnAdminEntity(sim, command);
  if (command.op === "teleport") return adminTeleport(sim, command, operatorPlayerId);
  if (command.op === "killEnemies") return killAdminEnemies(sim, command.centerPlayerId, command.radius);
  return executeAdminPlayerMutation(sim, command);
}

function adminPlayer(sim: SimState, slot: PlayerSlot): AdminPlayer {
  const body = slot.entity.body;
  return {
    playerId: slot.entity.id,
    profileId: slot.stored.localProfileId ?? `local-profile-${slot.stored.slot}`,
    name: slot.entity.name ?? slot.stored.name,
    level: sim.world.level,
    floor: sim.world.floor,
    x: body.x,
    y: body.y,
    z: body.z,
    hp: slot.entity.hp,
    maxHp: slot.entity.maxHp,
    downed: slot.downedAtTick !== null,
    god: slot.god,
    handicapped: Boolean(slot.handicap),
    admin: slot.admin,
    statuses: slot.entity.statuses.map((status) => status.defId),
    connected: slot.connected,
    clientId: slot.clientId,
    ...identityFields(slot),
  };
}

function identityFields(slot: PlayerSlot): Pick<AdminPlayer, "userAgent" | "platform" | "touch"> {
  const identity = slot.stored.identity;
  return {
    ...(identity?.userAgent === undefined ? {} : { userAgent: identity.userAgent }),
    ...(identity?.platform === undefined ? {} : { platform: identity.platform }),
    ...(identity?.touch === undefined ? {} : { touch: identity.touch }),
  };
}

function adminTeleport(
  sim: SimState,
  command: Extract<AdminCommand, { op: "teleport" }>,
  operatorPlayerId: string | null,
): AdminMutationResult {
  const target = sim.players.get(command.playerId);
  if (!target) return { ok: false, code: "player_not_found" };
  const destination = teleportDestination({
    sim,
    target,
    destination: command.destination,
    targetPlayerId: command.targetPlayerId,
    operatorPlayerId,
    x: command.x,
    y: command.y,
  });
  if (!destination) return { ok: false, code: "destination_not_found" };
  teleportPlayer({ sim, slot: target, to: destination, remember: false });
  target.outbox.push({ t: "toast", msg: `An admin teleported you to ${teleportLabel(command)}.` });
  return { ok: true };
}

function teleportDestination(
  input: TeleportDestinationInput,
): { x: number; y: number; z: number } | null {
  const { sim, target, destination, targetPlayerId, operatorPlayerId } = input;
  if (destination === "spawn") return findPlayerSpawn(sim, target.stored.slot);
  if (destination === "safeRoom") return roomDestination(sim);
  if (destination === "coordinates") return coordinateDestination(input);
  const playerId = destination === "self" ? operatorPlayerId : targetPlayerId;
  const player = playerId ? sim.players.get(playerId) : undefined;
  if (!player) return null;
  const { x, y, z } = player.entity.body;
  return { x, y, z };
}

interface TeleportDestinationInput {
  readonly sim: SimState;
  readonly target: PlayerSlot;
  readonly destination: Extract<AdminCommand, { op: "teleport" }>["destination"];
  readonly targetPlayerId: string | undefined;
  readonly operatorPlayerId: string | null;
  readonly x: number | undefined;
  readonly y: number | undefined;
}

function coordinateDestination(
  input: TeleportDestinationInput,
): { x: number; y: number; z: number } | null {
  if (input.x === undefined || input.y === undefined) return null;
  const position = clampFiniteFloorPosition(input.sim.world.floorBounds, { x: input.x, y: input.y });
  if (!input.sim.world.isWalkable(position.x, position.y)) return null;
  return { x: position.x, y: position.y, z: input.sim.world.groundAt(position.x, position.y) };
}

function teleportLabel(command: Extract<AdminCommand, { op: "teleport" }>): string {
  if (command.destination === "safeRoom") return "the safe room";
  if (command.destination === "self") return "the admin";
  if (command.destination === "coordinates") return `coordinates ${command.x}, ${command.y}`;
  return command.destination === "spawn" ? "the spawn room" : "another player";
}

function roomDestination(sim: SimState): { x: number; y: number; z: number } {
  const position = safeRoomSpawn(0, 0);
  return { ...position, z: sim.world.groundAt(position.x, position.y) };
}
