/** Runs local prediction every fixed tick while sending only cadence-selected movement intents. */
import type { MoveInput } from "@dc2d/engine";
import type { Connection } from "./connection.js";

function sendMovement(
  connection: Connection,
  input: MoveInput,
  identity: { seq: number; projectedServerTick: number },
): void {
  connection.send({
    type: "input",
    ...identity,
    moveX: input.moveX,
    moveY: input.moveY,
    ...(input.faceX !== undefined ? { faceX: input.faceX } : {}),
    ...(input.faceY !== undefined ? { faceY: input.faceY } : {}),
    jump: input.jump,
    run: input.run ?? false,
    block: input.block ?? false,
  });
}

export function sendMovementEdge(connection: Connection, input: MoveInput): void {
  if (!connection.world || !connection.body || !connection.canAct) return;
  if (!connection.movementCadence.shouldSendEdge(input)) return;
  sendMovement(connection, input, connection.prediction.nextInputIdentity());
}

export function sampleMovement(connection: Connection, input: MoveInput): void {
  if (!connection.world || !connection.body || !connection.canAct) return;
  const identity = connection.prediction.predict({
    world: connection.world,
    body: connection.body,
    input,
    resources: connection,
    canBlock: connection.weapon !== null,
  });
  if (!connection.movementCadence.shouldSend(input)) return;
  sendMovement(connection, input, identity);
}
