import Phaser from "phaser";
import { Connection } from "./net/connection";
import { DungeonScene } from "./scenes/DungeonScene";

const NAME_KEY = "dc2d-name";

function playerName(): string {
  let name = localStorage.getItem(NAME_KEY);
  if (!name) {
    name = `Crawler${Math.floor(100 + Math.random() * 900)}`;
    localStorage.setItem(NAME_KEY, name);
  }
  return name;
}

// Same topology as production: the client only knows a ws URL.
// Locally that's the game-server process `npm run dev` starts next
// door; in prod it will be wss://play.<domain> behind Caddy.
const wsUrl = (import.meta.env.VITE_WS_URL as string | undefined) ?? "ws://localhost:8081";

const conn = new Connection(wsUrl, playerName());
conn.connect();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  // Low internal resolution scaled 2× — pixel-perfect chunky rendering
  // so the placeholder pixel art reads the way the real tileset will.
  width: 480,
  height: 320,
  zoom: 2,
  backgroundColor: "#0d0a12",
  pixelArt: true,
  scene: [new DungeonScene(conn)],
});
