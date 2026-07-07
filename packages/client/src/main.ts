import Phaser from "phaser";
import { Connection, persistentClientId } from "./net/connection";
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
const wsUrl = (import.meta.env.VITE_WS_URL as string | undefined) ?? "ws://localhost:8081";

const conn = new Connection(wsUrl, playerName(), persistentClientId());
conn.connect();

// e2e/test hook: Playwright asserts against live client state. Set
// before the Game boots so it exists even if later setup fails.
declare global {
  interface Window {
    __dc2d?: { conn: Connection };
  }
}
window.__dc2d = { conn };
window.addEventListener("error", (event) => {
  console.error("[main] uncaught:", event.message, event.filename, event.lineno);
});

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 1280,
  height: 720,
  backgroundColor: "#0d0a12",
  pixelArt: true,
  scene: [new DungeonScene(conn)],
});

// ── chat input (DOM overlay — Enter to open, Enter to send) ────────
// "/l hello" sends to local chat; otherwise party if you have one.
const chatInput = document.createElement("input");
chatInput.id = "chat-input";
chatInput.maxLength = 200;
chatInput.placeholder = "party chat — start with /l for local";
Object.assign(chatInput.style, {
  position: "absolute",
  bottom: "180px",
  left: "50%",
  transform: "translateX(-50%)",
  width: "420px",
  padding: "6px 10px",
  background: "#0d0a12e8",
  color: "#e8e4f0",
  border: "1px solid #9fe8c9",
  fontFamily: "monospace",
  fontSize: "13px",
  display: "none",
  zIndex: "10",
});
document.body.appendChild(chatInput);

window.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  if (document.activeElement === chatInput) {
    const raw = chatInput.value.trim();
    if (raw.length > 0) {
      if (raw.startsWith("/l ")) conn.chat("local", raw.slice(3));
      else if (conn.party) conn.chat("party", raw);
      else conn.chat("local", raw);
    }
    chatInput.value = "";
    chatInput.style.display = "none";
    chatInput.blur();
  } else {
    chatInput.style.display = "block";
    chatInput.focus();
    event.preventDefault();
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.activeElement === chatInput) {
    chatInput.value = "";
    chatInput.style.display = "none";
    chatInput.blur();
  }
});
