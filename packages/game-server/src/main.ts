/** Boots the authoritative multiplayer overworld server simulation with JSON persistence. */
import { startGameServer } from "./net/wsServer.js";

const savePath = process.env.WORLD_SAVE_PATH === "none" ? undefined : (process.env.WORLD_SAVE_PATH ?? "data/world-save.json");
void startGameServer({ savePath });
