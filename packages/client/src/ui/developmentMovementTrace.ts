import type { Connection } from "../net/connection.js";
import type { MovementTraceControl } from "./movementTraceControl.js";

export function attachDevelopmentMovementTrace(
  root: HTMLElement,
  connection: Connection,
  focusGame: () => void,
  active: () => boolean,
  attach: (control: MovementTraceControl) => void,
): void {
  if (!import.meta.env.DEV) return;
  void import("./movementTraceControl.js").then(({ MovementTraceControl }) => {
    if (!active()) return;
    attach(new MovementTraceControl(root, connection, focusGame));
  });
}
