// Placeholder WebSocket game-server entrypoint: starts a ws listener, logs
// connections, and echoes nothing yet — the authoritative sim lands later.
import { WebSocketServer } from "ws";
import { seededHash } from "@dc2d/engine";
import { items } from "@dc2d/content";

const PORT = 8787;

function startServer(): WebSocketServer {
  const server = new WebSocketServer({ port: PORT });

  server.on("connection", (socket, request) => {
    console.log(`[game-server] connection from ${request.socket.remoteAddress ?? "unknown"}`);
    socket.on("close", () => {
      console.log("[game-server] connection closed");
    });
  });

  server.on("listening", () => {
    const bootHash = seededHash(1, items.length);
    console.log(
      `[game-server] listening on ws://localhost:${PORT} (boot hash ${bootHash}, ${items.length} content item(s) loaded)`,
    );
  });

  return server;
}

startServer();
