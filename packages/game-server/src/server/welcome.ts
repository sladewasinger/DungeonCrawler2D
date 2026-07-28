import { PROTOCOL_VERSION, TICK_RATE, type LevelId } from "@dc2d/engine";
import type { WebSocket } from "ws";
import type { GameSim } from "../sim/core/index.js";
import { sendServerMessage } from "./telemetry/measuredSend.js";
import type { ServerNetworkDiagnostics } from "./telemetry/networkDiagnostics.js";

export interface WelcomeContext {
  ws: WebSocket;
  join: ReturnType<GameSim["addPlayer"]>;
  level: LevelId;
  seedInputText: string;
  worldSeed: number;
  diagnostics: ServerNetworkDiagnostics;
}

export function sendWelcome({ ws, join, level, seedInputText, worldSeed, diagnostics }: WelcomeContext): void {
  sendServerMessage({
    socket: ws,
    playerId: join.playerId,
    message: {
      type: "welcome",
      protocol: PROTOCOL_VERSION,
      playerId: join.playerId,
      resumeToken: join.resumeToken,
      seedInputText,
      worldSeed,
      floor: join.floor,
      level,
      tickRate: TICK_RATE,
      spawn: join.spawn,
    },
    diagnostics,
  });
}
