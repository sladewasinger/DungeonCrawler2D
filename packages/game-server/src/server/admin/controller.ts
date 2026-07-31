import {
  type AdminCommand,
  type AdminPlayer,
  type AdminState,
  type DebugFlags,
} from "@dc2d/engine";
import type { FloorRegistry } from "../../floors/floorRegistry.js";
import type { GameSim } from "../../sim/core/index.js";
import {
  authorizeAdminCommand,
  createAdminSession,
  type AdminSession,
} from "./access/authorization.js";
import type { AdminAuditSink } from "./audit.js";
import { newSpectatorSession, type SpectatorSession } from "./spectator/spectatorSession.js";
import { executeSpectatorCommand } from "./spectator/spectatorCommands.js";
import { commandTargetId, commandTargetIds } from "./commands/commandTargets.js";
import { executeActiveAdminCommand } from "./commands/activeAdminExecution.js";
import {
  executeAdminWorldCommand,
  type AdminWorldContext,
} from "./worldCommands.js";
import { controllerAdminState, controllerObserverState } from "./state/adminControllerState.js";
import type {
  AdminExecuteInput,
  AuthorizedAdminCommand,
  FailedAdminCommand,
} from "./controllerTypes.js";

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
}

export class AdminController {
  private readonly floors: FloorRegistry;
  private readonly sandbox: GameSim;
  private readonly audit: AdminAuditSink;

  constructor(options: AdminControllerOptions) {
    this.floors = options.floors;
    this.sandbox = options.sandbox;
    this.audit = options.audit;
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
    this.auditCommand({ session, command, outcome, operatorPlayerId });
    return { ...outcome, state: this.state(spectator, session) };
  }

  /** Executes a command for a current gameplay slot after validating its live role. */
  executeActive(input: Omit<AdminExecuteInput, "session">): ActiveAdminCommandOutcome {
    return executeActiveAdminCommand({
      ...input,
      active: (playerId) => Boolean(this.activeSim(playerId)),
      execute: (command) => this.executeAuthorized(command),
      updateDebug: (playerId, flags) => this.updateActiveDebug(playerId, flags),
      audit: (command, outcome) => this.auditCommand({ session: createAdminSession(), command, outcome, operatorPlayerId: input.operatorPlayerId }),
    });
  }

  state(spectator: SpectatorSession, session: AdminSession | null): AdminState {
    return controllerAdminState({ floors: this.floors, sandbox: this.sandbox, spectator, session, players: this.players() });
  }

  observerState(spectator: SpectatorSession): import("@dc2d/engine").AdminObserverState {
    return controllerObserverState({ floors: this.floors, sandbox: this.sandbox, spectator, players: this.players() });
  }

  private executeAuthorized(input: AuthorizedAdminCommand): Omit<AdminCommandOutcome, "state"> {
    const { spectator, command, operatorPlayerId } = input;
    if (command.op === "list") return { ok: true };
    const spectatorResult = executeSpectatorCommand(spectator, command, this.players());
    if (spectatorResult.handled) return spectatorResult;
    const worldResult = executeAdminWorldCommand({ context: this.worldContext(), spectator, command });
    if (worldResult) return worldResult;
    const targetId = commandTargetId(command);
    const sim = targetId ? this.simForPlayer(targetId) : undefined;
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
    const outcome = { ok: false, code, state: this.state(spectator, session) };
    this.auditCommand({ session, command, outcome, operatorPlayerId });
    return outcome;
  }

  private auditCommand(input: AuditCommandInput): void {
    const { session, command, outcome, operatorPlayerId } = input;
    this.audit.record({
      at: Date.now(),
      sessionId: session?.sessionId ?? "unauthenticated",
      ...(operatorPlayerId ? { operatorPlayerId } : {}),
      command: command.op,
      targetIds: commandTargetIds(command),
      ok: outcome.ok,
      ...(outcome.code ? { code: outcome.code } : {}),
    });
  }

  private players(): AdminPlayer[] {
    return [...this.floors.activeSims(), this.sandbox].flatMap((sim) => sim.admin.players());
  }

  private activeSim(playerId: string): GameSim | undefined {
    const sim = this.simForPlayer(playerId);
    return sim?.admin.isActiveAdmin(playerId) ? sim : undefined;
  }

  private updateActiveDebug(
    playerId: string,
    flags: DebugFlags,
  ): ActiveAdminCommandOutcome {
    const sim = this.activeSim(playerId);
    return sim?.admin.setDebugFlags(playerId, flags)
      ? { ok: true }
      : { ok: false, code: "unauthorized" };
  }

  private worldContext(): AdminWorldContext {
    return { floors: this.floors, sandbox: this.sandbox };
  }

  private simForPlayer(playerId: string): GameSim | undefined {
    return [...this.floors.activeSims(), this.sandbox]
      .find((sim) => sim.admin.players().some((player) => player.playerId === playerId));
  }
}

interface AuditCommandInput {
  readonly session: AdminSession | null;
  readonly command: AdminCommand;
  readonly outcome: Pick<AdminCommandOutcome, "ok" | "code">;
  readonly operatorPlayerId: string | null | undefined;
}
