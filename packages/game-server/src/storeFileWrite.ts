import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { PlayerStoreFileData } from "./storeFile.js";

export function writePlayerStoreFile(file: string, data: PlayerStoreFileData, version: number): void {
  const temporary = `${file}.${process.pid}.tmp`;
  mkdirSync(dirname(file), { recursive: true });
  try {
    writeFileSync(temporary, JSON.stringify({
      version,
      nextSlot: data.nextSlot,
      players: data.players,
    }), { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, file);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}
