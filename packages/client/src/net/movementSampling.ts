/** Runs local prediction every fixed tick while sending only cadence-selected movement intents. */
import type { MoveInput } from "@dc2d/engine";
import type { Connection } from "./connection.js";

export function sampleMovement(connection: Connection, input: MoveInput): void {
  if (!connection.world || !connection.body || !connection.canAct) return;
  const { seq, projectedServerTick } = connection.prediction.predict(
    connection.world,
    connection.body,
    input,
    connection,
    connection.weapon !== null,
  );
  if (!connection.movementCadence.shouldSend(input)) return;
  connection.send({
    type: "input",
    seq,
    projectedServerTick,
    moveX: input.moveX,
    moveY: input.moveY,
    ...(input.faceX !== undefined ? { faceX: input.faceX } : {}),
    ...(input.faceY !== undefined ? { faceY: input.faceY } : {}),
    jump: input.jump,
    run: input.run ?? false,
    block: input.block ?? false,
  });
}
