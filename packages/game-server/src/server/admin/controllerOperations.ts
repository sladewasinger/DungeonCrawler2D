import type { AdminCommand, AdminState, FloorGenerationConfig } from "@dc2d/engine";
import type { ApplyGeneratedFloorResult, FloorRegistry } from "../../floors/floorRegistry.js";
import type { GameSim } from "../../sim/core/index.js";
import { authorizeAdminCommand, type AdminSession } from "./access/authorization.js";
import type { AdminAuditHistory, AdminAuditSink } from "./audit.js";
import { recordAdminCommand } from "./audit/adminAuditRecording.js";
import { adminHistoryFeed } from "./history/adminHistoryFeed.js";
import { executeSpectatorCommand } from "./spectator/spectatorCommands.js";
import type { SpectatorSession } from "./spectator/spectatorSession.js";
import { commandTargetId } from "./commands/commandTargets.js";
import { executeAdminWorldCommand, type AdminWorldContext } from "./worldCommands.js";
import { controllerAdminState, controllerObserverState } from "./state/adminControllerState.js";
import { activeAdminSim, adminControllerPlayers, simForAdminPlayer } from "./state/adminControllerPlayers.js";
import type { ActiveAdminCommandOutcome, AdminCommandOutcome } from "./controller.js";
import type { AuthorizedAdminCommand } from "./controllerTypes.js";

export interface AdminControllerOperationContext {
  readonly floors: FloorRegistry;
  readonly sandbox: GameSim;
  readonly combatSandbox: GameSim | undefined;
  readonly audit: AdminAuditSink;
  readonly history: AdminAuditHistory;
}

export function executeAuthorized(
  context: AdminControllerOperationContext,
  input: AuthorizedAdminCommand,
): Omit<AdminCommandOutcome, "state"> {
  const { spectator, command, operatorPlayerId } = input;
  if (command.op === "list") return { ok: true };
  const world = worldContext(context);
  const spectatorResult = executeSpectatorCommand(spectator, command, adminControllerPlayers(world));
  if (spectatorResult.handled) return spectatorResult;
  const worldResult = executeAdminWorldCommand({ context: world, spectator, command });
  if (worldResult) return worldResult;
  const targetId = commandTargetId(command);
  const sim = targetId ? simForAdminPlayer(world, targetId) : undefined;
  return sim ? sim.admin.execute(command, operatorPlayerId) : { ok: false, code: "player_not_found" };
}

export async function applyGeneratedFloor(input: {
  readonly context: AdminControllerOperationContext;
  readonly session: AdminSession;
  readonly command: Extract<AdminCommand, { op: "applyGeneratedFloor" }>;
  readonly operatorPlayerId: string | null;
}): Promise<ActiveAdminCommandOutcome> {
  const decision = authorizeAdminCommand(input.session, input.command);
  if (!decision.allowed) return { ok: false, code: decision.code! };
  const command = input.command;
  const request = {
    floor: command.floor,
    confirm: command.confirm,
    ...(command.config ? { config: command.config as FloorGenerationConfig } : {}),
    ...(command.expectedGeneration ? { expectedGeneration: command.expectedGeneration } : {}),
  };
  const outcome = await input.context.floors.applyGeneratedFloor(request);
  recordAdminCommand(input.context.audit, {
    session: input.session,
    command,
    outcome,
    operatorPlayerId: input.operatorPlayerId,
  });
  return applyResult(outcome);
}

export function state(
  context: AdminControllerOperationContext,
  spectator: SpectatorSession,
  session: AdminSession | null,
): AdminState {
  const world = worldContext(context);
  const players = adminControllerPlayers(world);
  return controllerAdminState({
    floors: context.floors,
    sandbox: context.sandbox,
    combatSandbox: context.combatSandbox,
    spectator,
    session,
    players,
    history: adminHistoryFeed({ session, audit: context.history, players }),
  });
}

export function observerState(
  context: AdminControllerOperationContext,
  spectator: SpectatorSession,
): import("@dc2d/engine").AdminObserverState {
  const world = worldContext(context);
  return controllerObserverState({
    floors: context.floors,
    sandbox: context.sandbox,
    combatSandbox: context.combatSandbox,
    spectator,
    players: adminControllerPlayers(world),
  });
}

export function updateActiveDebug(
  context: AdminControllerOperationContext,
  playerId: string,
  flags: Extract<AdminCommand, { op: "debug" }>["flags"],
): ActiveAdminCommandOutcome {
  const sim = activeAdminSim(worldContext(context), playerId);
  return sim?.admin.setDebugFlags(playerId, flags)
    ? { ok: true }
    : { ok: false, code: "unauthorized" };
}

export function isActiveAdmin(
  context: AdminControllerOperationContext,
  playerId: string,
): boolean {
  return Boolean(activeAdminSim(worldContext(context), playerId));
}

function worldContext(context: AdminControllerOperationContext): AdminWorldContext {
  return {
    floors: context.floors,
    sandbox: context.sandbox,
    combatSandbox: context.combatSandbox,
  };
}

function applyResult(result: ApplyGeneratedFloorResult): ActiveAdminCommandOutcome {
  return result.ok
    ? { ok: true, floor: result.floor, generation: result.generation }
    : { ok: false, code: result.code };
}
