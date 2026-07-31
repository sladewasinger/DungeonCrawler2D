import type { AdminState, DebugFlags } from "@dc2d/engine";
import type { FloorRegistry } from "../../floors/floorRegistry.js";
import type { GameSim } from "../../sim/core/index.js";
import {
  authorizeAdminCommand,
  createAdminSession,
  type AdminSession,
} from "./access/authorization.js";
import type { AdminAuditHistory, AdminAuditSink } from "./audit.js";
import { recordAdminCommand, recordAdminLogout } from "./audit/adminAuditRecording.js";
import { adminHistoryFeed } from "./history/adminHistoryFeed.js";
import { newSpectatorSession, type SpectatorSession } from "./spectator/spectatorSession.js";
import { executeSpectatorCommand } from "./spectator/spectatorCommands.js";
import { commandTargetId } from "./commands/commandTargets.js";
import { executeActiveAdminCommand } from "./commands/activeAdminExecution.js";
import { executeAdminWorldCommand, type AdminWorldContext } from "./worldCommands.js";
import { controllerAdminState, controllerObserverState } from "./state/adminControllerState.js";
import { activeAdminSim, adminControllerPlayers, simForAdminPlayer } from "./state/adminControllerPlayers.js";
import type { AdminExecuteInput, AuthorizedAdminCommand, FailedAdminCommand } from "./controllerTypes.js";

export interface AdminCommandOutcome {
  readonly ok: boolean;
  readonly code?: string;
  readonly message?: string;
  readonly state: AdminState;
}

export type ActiveAdminCommandOutcome = Omit<AdminCommandOutcome, "state">;

export interface AdminControllerOptions {
  readonly floors: FloorRegistry;
  readonly sandbox: GameSim;
  readonly audit: AdminAuditSink;
  readonly history?: AdminAuditHistory;
}

export class AdminController {
  private readonly floors: FloorRegistry;
  private readonly sandbox: GameSim;
  private readonly audit: AdminAuditSink;
  private readonly history: AdminAuditHistory;

  constructor(options: AdminControllerOptions) {
    this.floors = options.floors;
    this.sandbox = options.sandbox;
    this.audit = options.audit;
    this.history = options.history ?? emptyAdminAuditHistory;
  }

  createSpectator(): SpectatorSession {
    return newSpectatorSession();
  }

  execute(input: AdminExecuteInput): AdminCommandOutcome {
    const { session, spectator, command, operatorPlayerId } = input;
    if (!session) return this.finish({ session, spectator, command, operatorPlayerId, code: "unauthorized" });
    const decision = authorizeAdminCommand(session, command);
    if (!decision.allowed) return this.finish({ session, spectator, command, operatorPlayerId, code: decision.code! });
    const outcome = command.op === "debug"
      ? this.updateDebug(session, command.flags)
      : this.executeAuthorized({ spectator, command, operatorPlayerId });
    recordAdminCommand(this.audit, { session, command, outcome, operatorPlayerId });
    return { ...outcome, state: this.state(spectator, session) };
  }

  /** Executes a command for a current gameplay slot after validating its live role. */
  executeActive(input: Omit<AdminExecuteInput, "session">): ActiveAdminCommandOutcome {
    return executeActiveAdminCommand({
      ...input,
      active: (playerId) => Boolean(activeAdminSim(this.worldContext(), playerId)),
      execute: (command) => this.executeAuthorized(command),
      updateDebug: (playerId, flags) => this.updateActiveDebug(playerId, flags),
      audit: (command, outcome) => recordAdminCommand(this.audit, {
        session: createAdminSession(),
        command,
        outcome,
        operatorPlayerId: input.operatorPlayerId,
      }),
    });
  }

  state(spectator: SpectatorSession, session: AdminSession | null): AdminState {
    const players = adminControllerPlayers(this.worldContext());
    return controllerAdminState({
      floors: this.floors,
      sandbox: this.sandbox,
      spectator,
      session,
      players,
      history: adminHistoryFeed({ session, audit: this.history, players }),
    });
  }

  observerState(spectator: SpectatorSession): import("@dc2d/engine").AdminObserverState {
    return controllerObserverState({
      floors: this.floors,
      sandbox: this.sandbox,
      spectator,
      players: adminControllerPlayers(this.worldContext()),
    });
  }

  recordPortalLogout(session: AdminSession): void {
    recordAdminLogout(this.audit, session);
  }

  private executeAuthorized(input: AuthorizedAdminCommand): Omit<AdminCommandOutcome, "state"> {
    const { spectator, command, operatorPlayerId } = input;
    if (command.op === "list") return { ok: true };
    const spectatorResult = executeSpectatorCommand(
      spectator,
      command,
      adminControllerPlayers(this.worldContext()),
    );
    if (spectatorResult.handled) return spectatorResult;
    const worldResult = executeAdminWorldCommand({ context: this.worldContext(), spectator, command });
    if (worldResult) return worldResult;
    const targetId = commandTargetId(command);
    const sim = targetId ? simForAdminPlayer(this.worldContext(), targetId) : undefined;
    if (!sim) return { ok: false, code: "player_not_found" };
    const result = sim.admin.execute(command, operatorPlayerId);
    return result;
  }

  private updateDebug(
    session: AdminSession,
    flags: DebugFlags,
  ): Omit<AdminCommandOutcome, "state"> {
    session.debugFlags = { ...flags };
    return { ok: true };
  }

  private finish(input: FailedAdminCommand): AdminCommandOutcome {
    const { session, spectator, command, operatorPlayerId, code } = input;
    const outcome = { ok: false, code };
    recordAdminCommand(this.audit, { session, command, outcome, operatorPlayerId });
    return { ...outcome, state: this.state(spectator, session) };
  }

  private updateActiveDebug(
    playerId: string,
    flags: DebugFlags,
  ): ActiveAdminCommandOutcome {
    const sim = activeAdminSim(this.worldContext(), playerId);
    return sim?.admin.setDebugFlags(playerId, flags)
      ? { ok: true }
      : { ok: false, code: "unauthorized" };
  }

  private worldContext(): AdminWorldContext {
    return { floors: this.floors, sandbox: this.sandbox };
  }
}

const emptyAdminAuditHistory: AdminAuditHistory = {
  recent: () => [],
};
