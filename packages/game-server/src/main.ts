// Placeholder WebSocket game-server entrypoint: starts a ws listener on the
// GAME_PORT env contract the EC2 systemd unit sets (8081 in prod) — the
// authoritative sim lands later.
import { WebSocketServer } from "ws";

const DEV_DEFAULT_PORT = 8787;
const port = Number(process.env["GAME_PORT"] ?? DEV_DEFAULT_PORT);

function startServer(): WebSocketServer {
  const server = new WebSocketServer({ port });

  server.on("connection", (socket, request) => {
    console.log(`[game-server] connection from ${request.socket.remoteAddress ?? "unknown"}`);
    socket.on("close", () => {
      console.log("[game-server] connection closed");
    });
  });

  server.on("listening", () => {
    console.log(`[game-server] listening on ws://localhost:${port}`);
  });

  return server;
}

startServer();
