import type { WebSocket, WebSocketServer } from "ws";

/** Transport-level heartbeat for detecting half-open browser connections. */

const HEARTBEAT_INTERVAL_MS = 5_000;

type HeartbeatSocket = Pick<WebSocket, "ping" | "terminate">;

export function sweepHeartbeat(
  sockets: Iterable<HeartbeatSocket>,
  responsive: Set<HeartbeatSocket>,
): void {
  for (const socket of sockets) {
    if (!responsive.delete(socket)) {
      socket.terminate();
      continue;
    }
    socket.ping();
  }
}

export function startHeartbeat(wss: WebSocketServer): () => void {
  const responsive = new Set<WebSocket>();
  const track = (socket: WebSocket) => {
    responsive.add(socket);
    socket.on("pong", () => responsive.add(socket));
    socket.on("close", () => responsive.delete(socket));
  };
  wss.on("connection", track);
  const timer = setInterval(
    () => sweepHeartbeat(wss.clients, responsive),
    HEARTBEAT_INTERVAL_MS,
  );
  return () => {
    clearInterval(timer);
    wss.off("connection", track);
    responsive.clear();
  };
}
