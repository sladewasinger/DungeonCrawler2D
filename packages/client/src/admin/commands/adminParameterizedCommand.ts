import {
  ADMIN_WORLD_COORDINATE_LIMIT,
  type AdminCommand,
} from "@dc2d/engine";

export interface AdminParameterizedCommandResult {
  readonly recognized: boolean;
  readonly command: AdminCommand | null;
  readonly error?: string;
}

export function adminParameterizedCommand(
  action: string,
  control: HTMLButtonElement | null,
): AdminParameterizedCommandResult {
  if (action === "teleport-coordinates") return coordinateTeleport(control);
  if (action === "kill-enemies") return killNearbyEnemies(control);
  return { recognized: false, command: null };
}

function coordinateTeleport(control: HTMLButtonElement | null): AdminParameterizedCommandResult {
  const playerId = control?.dataset.playerId;
  const group = control?.closest<HTMLElement>("[data-admin-action-group]");
  const x = numberValue(group, "[data-admin-teleport-x]");
  const y = numberValue(group, "[data-admin-teleport-y]");
  if (!playerId || !worldCoordinate(x) || !worldCoordinate(y)) {
    return invalid("Enter valid X and Y coordinates.");
  }
  return {
    recognized: true,
    command: { op: "teleport", playerId, destination: "coordinates", x, y },
  };
}

function killNearbyEnemies(control: HTMLButtonElement | null): AdminParameterizedCommandResult {
  const centerPlayerId = control?.dataset.playerId;
  const group = control?.closest<HTMLElement>("[data-admin-action-group]");
  const radius = numberValue(group, "[data-admin-enemy-radius]");
  if (!centerPlayerId || !Number.isFinite(radius) || radius < 1 || radius > 64) {
    return invalid("Enemy radius must be between 1 and 64 tiles.");
  }
  return {
    recognized: true,
    command: { op: "killEnemies", centerPlayerId, radius },
  };
}

function numberValue(root: HTMLElement | null | undefined, selector: string): number {
  return root?.querySelector<HTMLInputElement>(selector)?.valueAsNumber ?? Number.NaN;
}

function worldCoordinate(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= ADMIN_WORLD_COORDINATE_LIMIT;
}

function invalid(error: string): AdminParameterizedCommandResult {
  return { recognized: true, command: null, error };
}
