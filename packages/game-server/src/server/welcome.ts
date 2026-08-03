import { PROTOCOL_VERSION, TICK_RATE, type FloorGenerationIdentity, type LevelId, type WorldFeatures } from "@dc2d/engine";
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
  worldFeatures: WorldFeatures;
  generation?: FloorGenerationIdentity;
  finiteFloorArtifact?: string;
  diagnostics: ServerNetworkDiagnostics;
}

export function sendWelcome({ ws, join, level, seedInputText, worldSeed, worldFeatures, generation, finiteFloorArtifact, diagnostics }: WelcomeContext): void {
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
      worldFeatures,
      ...(generation ? { generation } : {}),
      ...(finiteFloorArtifact ? { finiteFloorArtifact } : {}),
      tickRate: TICK_RATE,
      spawn: join.spawn,
    },
    diagnostics,
  });
}
