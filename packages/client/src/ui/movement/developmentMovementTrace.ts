import type { Connection } from "../../net/connection/connection.js";
import type { MovementTraceControl } from "./movementTraceControl.js";

export interface DevelopmentMovementTraceSource {
  readonly root: HTMLElement;
  readonly connection: Connection;
  readonly focusGame: () => void;
  readonly active: () => boolean;
  readonly attach: (control: MovementTraceControl) => void;
}

export interface MovementTraceDiagnosticsEnvironment {
  readonly DEV: boolean;
  readonly VITE_ENABLE_MOVEMENT_TRACE?: string;
}

export function movementTraceDiagnosticsEnabled(
  environment: MovementTraceDiagnosticsEnvironment,
): boolean {
  return environment.DEV && environment.VITE_ENABLE_MOVEMENT_TRACE === "1";
}

export function attachDevelopmentMovementTrace(source: DevelopmentMovementTraceSource): void {
  const { root, connection, focusGame, active, attach } = source;
  if (!movementTraceDiagnosticsEnabled(import.meta.env)) return;
  void import("./movementTraceControl.js").then(({ MovementTraceControl }) => {
    if (!active()) return;
    attach(new MovementTraceControl(root, connection, focusGame));
  });
}
