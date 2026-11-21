import type { AdminCommand, AdminState, DebugFlags, FloorGenerationIdentity } from "@dc2d/engine";
import type { FloorRegistry } from "../../floors/floorRegistry.js";
import type { GameSim } from "../../sim/core/index.js";
import {
  authorizeAdminCommand,
  createAdminSession,
  type AdminSession,
} from "./access/authorization.js";
import type { AdminAuditHistory, AdminAuditSink } from "./audit.js";
import { recordAdminCommand, recordAdminLogout } from "./audit/adminAuditRecording.js";
import { newSpectatorSession, type SpectatorSession } from "./spectator/spectatorSession.js";
import { executeActiveAdminCommand } from "./commands/activeAdminExecution.js";
import type { AdminExecuteInput, AuthorizedAdminCommand, FailedAdminCommand } from "./controllerTypes.js";
import * as operations from "./controllerOperations.js";

export interface AdminCommandOutcome {
  readonly ok: boolean;
  readonly code?: string;
  readonly message?: string;
  readonly state: AdminState;
  readonly floor?: number;
  readonly generation?: FloorGenerationIdentity;
}

export type ActiveAdminCommandOutcome = Omit<AdminCommandOutcome, "state">;

export interface AdminControllerOptions {
  readonly floors: FloorRegistry;
  readonly sandbox: GameSim;
  readonly combatSandbox?: GameSim;
  readonly audit: AdminAuditSink;
  readonly history?: AdminAuditHistory;
}

export class AdminController {
  private readonly floors: FloorRegistry;
  private readonly sandbox: GameSim;
  private readonly combatSandbox: GameSim | undefined;
  private readonly audit: AdminAuditSink;
  private readonly history: AdminAuditHistory;

  constructor(options: AdminControllerOptions) {
    this.floors = options.floors;
    this.sandbox = options.sandbox;
    this.combatSandbox = options.combatSandbox;
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
      active: (playerId) => operations.isActiveAdmin(this.operationContext(), playerId),
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

  async applyGeneratedFloor(input: {
    readonly session: AdminSession;
    readonly command: Extract<AdminCommand, { op: "applyGeneratedFloor" }>;
    readonly operatorPlayerId: string | null;
  }): Promise<ActiveAdminCommandOutcome> {
    return operations.applyGeneratedFloor({ ...input, context: this.operationContext() });
  }

  state(spectator: SpectatorSession, session: AdminSession | null): AdminState {
    return operations.state(this.operationContext(), spectator, session);
  }

  observerState(spectator: SpectatorSession): import("@dc2d/engine").AdminObserverState {
    return operations.observerState(this.operationContext(), spectator);
  }

  recordPortalLogout(session: AdminSession): void {
    recordAdminLogout(this.audit, session);
  }

  private executeAuthorized(input: AuthorizedAdminCommand): Omit<AdminCommandOutcome, "state"> {
    return operations.executeAuthorized(this.operationContext(), input);
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
    return operations.updateActiveDebug(this.operationContext(), playerId, flags);
  }

  private operationContext(): operations.AdminControllerOperationContext {
    return {
      floors: this.floors,
      sandbox: this.sandbox,
      combatSandbox: this.combatSandbox,
      audit: this.audit,
      history: this.history,
    };
  }
}

const emptyAdminAuditHistory: AdminAuditHistory = {
  recent: () => [],
};
