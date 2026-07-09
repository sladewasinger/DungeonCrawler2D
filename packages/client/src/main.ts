import { customMapSchema, setCustomMap } from "@dc2d/engine";
import Phaser from "phaser";
import { Connection } from "./net/connection";
import { persistentClientId } from "./net/identity";
import atlas from "./render/atlas.json";
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

// Tile Studio map stamp (tools/tile-studio/): must be installed before
// any chunk is generated, and must match the server's file exactly —
// so load it first, then connect.
async function loadCustomMap(): Promise<void> {
  try {
    const res = await fetch("assets/custom-map.json");
    if (!res.ok) return;
    const def = customMapSchema.parse(await res.json());
    if (def.sheetCols !== atlas.packSheet.cols) {
      console.warn(
        `[main] custom map was drawn on a ${def.sheetCols}-col sheet but the pack sheet has ` +
          `${atlas.packSheet.cols} cols — art will scramble; re-export it from Tile Studio`,
      );
    }
    setCustomMap(def);
    console.log(`[main] custom map stamped at (${def.origin.x}, ${def.origin.y})`);
  } catch {
    // no custom map — the normal case
  }
}
void loadCustomMap().then(() => conn.connect());

// e2e/test hook: Playwright asserts against live client state. Set
// before the Game boots so it exists even if later setup fails.
declare global {
  interface Window {
    __dc2d?: { conn: Connection; game?: Phaser.Game };
  }
}
window.__dc2d = { conn };
window.addEventListener("error", (event) => {
  console.error("[main] uncaught:", event.message, event.filename, event.lineno);
});

window.__dc2d.game = new Phaser.Game({
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

// Dev-harness chat commands (the server ignores them unless its
// debugCommands option is on): /god toggles, /tp X Y teleports.
let godOn = false;
function handleDevCommand(raw: string): boolean {
  if (raw === "/god") {
    godOn = !godOn;
    conn.debugGod(godOn);
    return true;
  }
  if (raw.startsWith("/tp ")) {
    const [x, y] = raw.slice(4).trim().split(/\s+/).map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) conn.debugTeleport(x!, y!);
    return true;
  }
  return false;
}

window.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  if (document.activeElement === chatInput) {
    const raw = chatInput.value.trim();
    if (raw.length > 0 && !handleDevCommand(raw)) {
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
