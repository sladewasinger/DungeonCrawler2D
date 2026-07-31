import type { WebSocketServer } from "ws";
import type { PlayerStore } from "../../store.js";
import type { OperationalEventSink } from "../operations/operationalEvent.js";
import type { SocketMap } from "../types.js";

export interface ServerShutdownContext {
  readonly stopTickLoop: () => void;
  readonly stopHeartbeat: () => void;
  readonly store: PlayerStore;
  readonly wss: WebSocketServer;
  readonly sockets: SocketMap;
  readonly operationalEvents: OperationalEventSink;
}

export function stopServer(input: ServerShutdownContext): void {
  input.stopTickLoop();
  input.stopHeartbeat();
  input.store.flush();
  input.wss.close();
  for (const { ws } of input.sockets.values()) ws.close(1001, "server stopping");
  void input.operationalEvents.flush();
}
