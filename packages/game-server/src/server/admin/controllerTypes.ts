import type { AdminCommand } from "@dc2d/engine";
import type { AdminSession } from "./access/authorization.js";
import type { SpectatorSession } from "./spectator/spectatorSession.js";

export interface AdminExecuteInput {
  readonly session: AdminSession | null;
  readonly spectator: SpectatorSession;
  readonly command: AdminCommand;
  readonly operatorPlayerId: string | null;
}

export interface AuthorizedAdminCommand {
  readonly spectator: SpectatorSession;
  readonly command: AdminCommand;
  readonly operatorPlayerId: string | null;
}

export interface FailedAdminCommand {
  readonly session: AdminSession | null;
  readonly spectator: SpectatorSession;
  readonly command: AdminCommand;
  readonly operatorPlayerId: string | null;
  readonly code: string;
}
