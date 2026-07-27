import type { Connection } from "../../net/connection/connection.js";
import type { MovementTraceControl } from "./movementTraceControl.js";

export interface DevelopmentMovementTraceSource {
  readonly root: HTMLElement;
  readonly connection: Connection;
  readonly focusGame: () => void;
  readonly active: () => boolean;
  readonly attach: (control: MovementTraceControl) => void;
}

export function attachDevelopmentMovementTrace(source: DevelopmentMovementTraceSource): void {
  const { root, connection, focusGame, active, attach } = source;
  if (!import.meta.env.DEV) return;
  void import("./movementTraceControl.js").then(({ MovementTraceControl }) => {
    if (!active()) return;
    attach(new MovementTraceControl(root, connection, focusGame));
  });
}
