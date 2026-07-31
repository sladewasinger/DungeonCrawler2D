import type { AdminCommand } from "@dc2d/engine";
import type { ActiveAdminCommandOutcome } from "../controller.js";
import type { AuthorizedAdminCommand } from "../controllerTypes.js";

export interface ActiveAdminExecution {
  readonly command: AdminCommand;
  readonly operatorPlayerId: string | null;
  readonly execute: (input: AuthorizedAdminCommand) => ActiveAdminCommandOutcome;
  readonly active: (playerId: string) => boolean;
  readonly updateDebug: (
    playerId: string,
    flags: Extract<AdminCommand, { op: "debug" }> ["flags"],
  ) => ActiveAdminCommandOutcome;
  readonly audit: (command: AdminCommand, outcome: ActiveAdminCommandOutcome) => void;
  readonly spectator: AuthorizedAdminCommand["spectator"];
}

export function executeActiveAdminCommand(input: ActiveAdminExecution): ActiveAdminCommandOutcome {
  const { command, operatorPlayerId } = input;
  if (!operatorPlayerId || !input.active(operatorPlayerId)) return finish(input, { ok: false, code: "unauthorized" });
  const outcome = command.op === "debug"
    ? input.updateDebug(operatorPlayerId, command.flags)
    : input.execute({ spectator: input.spectator, command, operatorPlayerId });
  return finish(input, outcome);
}

function finish(input: ActiveAdminExecution, outcome: ActiveAdminCommandOutcome): ActiveAdminCommandOutcome {
  input.audit(input.command, outcome);
  return outcome;
}
