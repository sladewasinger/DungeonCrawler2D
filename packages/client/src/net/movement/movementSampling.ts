/** Runs local prediction every fixed tick while sending only cadence-selected movement intents. */
import { NEUTRAL_INPUT, type MoveInput } from "@dc2d/engine";
import type { Connection } from "../connection/connection.js";
import { movementSpeedProjection } from "../prediction/movement/movementSpeedContent.js";

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
  if (holdForStalledCorpNet(connection)) return;
  if (!connection.movementCadence.shouldSendEdge(input)) return;
  sendMovement(connection, input, connection.prediction.nextInputIdentity());
}

export function sampleMovement(connection: Connection, input: MoveInput): void {
  if (!connection.world || !connection.body || !connection.canAct) return;
  if (holdForStalledCorpNet(connection)) return;
  const identity = connection.prediction.predict({
    world: connection.world,
    body: connection.body,
    input,
    resources: connection,
    canBlock: connection.weapon !== null,
    movementSpeed: connection.movementSpeed,
    movementSpeedProjection: movementSpeedProjection(
      connection.movementSpeed,
      connection.statusEffects,
    ),
  });
  if (!connection.movementCadence.shouldSend(input)) return;
  sendMovement(connection, input, identity);
}

function holdForStalledCorpNet(connection: Connection): boolean {
  const gate = connection.corpNet.predictionGate(performance.now());
  if (gate === "open") return false;
  if (gate === "entered-hold") {
    sendMovement(connection, NEUTRAL_INPUT, connection.prediction.nextInputIdentity());
  }
  return true;
}
