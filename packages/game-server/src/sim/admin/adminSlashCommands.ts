/** Server-side admin-only chat slash commands (/god, /give, /fillbag, /clearbag, /tp, /biome, /poi, /time, /heal). */
import { getItemDef, maxStackForItem } from "@dc2d/content";
import {
  GroundKind, TOTAL_INVENTORY_SLOTS, sampleMacroBiome,
  type BiomeKind, type ChunkPoi, type WorldChunkCache,
} from "@dc2d/engine";
import type { WorldSim } from "../worldSim.js";

const MSG_NO_PLAYER = "Player not found.";
const B_VERDANT: BiomeKind = "verdant-forest";
const B_AUTUMN: BiomeKind = "autumn-woods";
const B_BOG: BiomeKind = "misty-bog";
const B_HIGH: BiomeKind = "craggy-highlands";
const B_CURSED: BiomeKind = "cursed-ruinlands";
const TIME_PRESETS: Readonly<Record<string, number>> = { dawn: 0.27, day: 0.46, golden: 0.68, dusk: 0.79, night: 0.94 };
const BIOME_ALIASES: Readonly<Record<string, BiomeKind>> = {
  verdant: B_VERDANT, [B_VERDANT]: B_VERDANT,
  autumn: B_AUTUMN, [B_AUTUMN]: B_AUTUMN,
  bog: B_BOG, [B_BOG]: B_BOG,
  highlands: B_HIGH, craggy: B_HIGH, [B_HIGH]: B_HIGH,
  ruinlands: B_CURSED, cursed: B_CURSED, [B_CURSED]: B_CURSED,
};

function isDryTile(cache: WorldChunkCache, tx: number, ty: number): boolean {
  const g = cache.tileAt(tx, ty).ground;
  return g !== GroundKind.DeepWater && g !== GroundKind.ShallowWater;
}

function teleportTo(opts: { readonly sim: WorldSim; readonly playerId: string; readonly x: number; readonly y: number }): boolean {
  const p = opts.sim.getPlayer(opts.playerId);
  if (!p) return false;
  p.x = opts.x; p.y = opts.y; p.elevation = opts.sim.cache.tileAt(Math.floor(opts.x), Math.floor(opts.y)).elevation;
  p.combat.invulnTimer = Math.max(p.combat.invulnTimer, 1.5);
  return true;
}

function runGiveCmd(sim: WorldSim, playerId: string, args: readonly string[]): string {
  const itemId = args[0] ?? "";
  if (!getItemDef(itemId)) return `Unknown item '${itemId}'.`;
  const count = Math.max(1, Math.min(99, Number(args[1] ?? 1) || 1));
  sim.handleAdminAction(playerId, { action: "give", itemId, count });
  return `Granted ${count}x ${itemId}.`;
}

function runFillBagCmd(sim: WorldSim, playerId: string, args: readonly string[]): string {
  const p = sim.getPlayer(playerId);
  if (!p) return MSG_NO_PLAYER;
  const itemId = args[0] && getItemDef(args[0]) ? args[0] : "flint-dagger";
  const count = maxStackForItem(itemId);
  let filled = 0;
  for (let i = 0; i < TOTAL_INVENTORY_SLOTS; i++) {
    if (p.inventory.slots[i] === null) { p.inventory.slots[i] = { itemId, count }; filled++; }
  }
  sim.markPersistenceDirty();
  return `Filled ${filled} empty slots with ${itemId}.`;
}

function runClearBagCmd(sim: WorldSim, playerId: string): string {
  const p = sim.getPlayer(playerId);
  if (!p) return MSG_NO_PLAYER;
  for (let i = 9; i < TOTAL_INVENTORY_SLOTS; i++) p.inventory.slots[i] = null;
  sim.markPersistenceDirty();
  return "Cleared backpack slots.";
}

function findRingSpot(opts: {
  readonly cache: WorldChunkCache; readonly r: number; readonly steps: number; readonly match: (wx: number, wy: number) => boolean;
}): { readonly x: number; readonly y: number } | null {
  for (let step = 0; step < opts.steps; step++) {
    const ang = (step / opts.steps) * Math.PI * 2;
    const wx = Math.round(Math.cos(ang) * opts.r);
    const wy = Math.round(Math.sin(ang) * opts.r);
    if (opts.match(wx, wy) && isDryTile(opts.cache, wx, wy)) return { x: wx + 0.5, y: wy + 0.5 };
  }
  return null;
}

function findBiomeSpot(cache: WorldChunkCache, target: BiomeKind): { readonly x: number; readonly y: number } | null {
  const match = (wx: number, wy: number) => sampleMacroBiome(cache.worldSeed, wx, wy) === target;
  for (let r = 32; r <= 640; r += 32) {
    const hit = findRingSpot({ cache, r, steps: 20, match });
    if (hit) return hit;
  }
  for (let r = 736; r <= 4400; r += 96) {
    const hit = findRingSpot({ cache, r, steps: 24, match });
    if (hit) return hit;
  }
  return null;
}

const POI_FILTERS: Readonly<Record<string, (p: ChunkPoi) => boolean>> = {
  any: () => true, chest: (p) => p.hasChest !== false,
  shrine: (p) => Boolean(p.shrineKind && p.shrineKind !== "waystone"),
  waystone: (p) => p.shrineKind === "waystone", vault: (p) => p.kind === "brazier-vault",
};

function matchesPoiFilter(poi: ChunkPoi, query: string): boolean {
  if (!query) return true;
  const fn = POI_FILTERS[query];
  return fn ? fn(poi) : poi.kind.includes(query);
}

function findChunkMatch(opts: { readonly cache: WorldChunkCache; readonly cx: number; readonly cy: number; readonly q: string }): ChunkPoi | null {
  for (const poi of opts.cache.getChunk(opts.cx, opts.cy).pois) {
    if (matchesPoiFilter(poi, opts.q)) return poi;
  }
  return null;
}

function scanRingRow(opts: { readonly cache: WorldChunkCache; readonly pcx: number; readonly cy: number; readonly r: number; readonly q: string; readonly edge: boolean }): ChunkPoi | null {
  for (let ox = -opts.r; ox <= opts.r; ox++) {
    if (!opts.edge && opts.r > 0 && Math.abs(ox) !== opts.r) continue;
    const hit = findChunkMatch({ cache: opts.cache, cx: opts.pcx + ox, cy: opts.cy, q: opts.q });
    if (hit) return hit;
  }
  return null;
}

function findRingPoi(opts: { readonly cache: WorldChunkCache; readonly pcx: number; readonly pcy: number; readonly r: number; readonly q: string }): ChunkPoi | null {
  for (let oy = -opts.r; oy <= opts.r; oy++) {
    const hit = scanRingRow({ cache: opts.cache, pcx: opts.pcx, cy: opts.pcy + oy, r: opts.r, q: opts.q, edge: Math.abs(oy) === opts.r });
    if (hit) return hit;
  }
  return null;
}

function findPoiNear(opts: { readonly cache: WorldChunkCache; readonly x: number; readonly y: number; readonly query: string }): ChunkPoi | null {
  const pcx = Math.floor(opts.x / 32);
  const pcy = Math.floor(opts.y / 32);
  for (let r = 0; r <= 10; r++) {
    const hit = findRingPoi({ cache: opts.cache, pcx, pcy, r, q: opts.query });
    if (hit) return hit;
  }
  return null;
}

function runBiomeCmd(sim: WorldSim, playerId: string, raw: string): string {
  const target = BIOME_ALIASES[raw.toLowerCase()];
  if (!target) return "Biomes: verdant, autumn, bog, highlands, ruinlands";
  const spot = findBiomeSpot(sim.cache, target);
  if (!spot) return `No dry tile found for ${target}.`;
  teleportTo({ sim, playerId, x: spot.x, y: spot.y });
  return `Teleported to ${target} (${Math.round(spot.x)}, ${Math.round(spot.y)}).`;
}

function runPoiCmd(sim: WorldSim, playerId: string, raw: string): string {
  const p = sim.getPlayer(playerId);
  if (!p) return MSG_NO_PLAYER;
  const poi = findPoiNear({ cache: sim.cache, x: p.x, y: p.y, query: (raw || "chest").toLowerCase() });
  if (!poi) return `No POI matching '${raw || "chest"}' within 10 chunks.`;
  sim.combat.ecology.loot.registerPoiChest(poi);
  const destX = poi.hasChest !== false ? poi.chestX - 1.4 : poi.centerX;
  const destY = poi.hasChest !== false ? poi.chestY : poi.centerY + 2.2;
  teleportTo({ sim, playerId, x: destX, y: destY });
  return `Teleported to ${poi.kind} at (${Math.round(destX)}, ${Math.round(destY)}).`;
}

function runTpCmd(sim: WorldSim, playerId: string, args: readonly string[]): string {
  const x = Number(args[0]); const y = Number(args[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return "Usage: /tp <x> <y>";
  teleportTo({ sim, playerId, x, y });
  return `Teleported to (${x}, ${y}).`;
}

const TIER_TARGET_RADIUS: Readonly<Record<number, number>> = { 1: 10, 2: 1050, 3: 2060, 4: 3580, 5: 6080 };

function runTierCmd(sim: WorldSim, playerId: string, args: readonly string[]): string {
  const tier = Math.floor(Number(args[0]));
  const baseR = TIER_TARGET_RADIUS[tier];
  if (baseR === undefined) return "Usage: /tier <1|2|3|4|5>";
  for (let dr = 0; dr <= 160; dr += 20) {
    const hit = findRingSpot({ cache: sim.cache, r: baseR + dr, steps: 16, match: () => true });
    if (hit) {
      teleportTo({ sim, playerId, x: hit.x, y: hit.y });
      return `Teleported to Danger Tier ${tier} (${Math.round(hit.x)}, ${Math.round(hit.y)}).`;
    }
  }
  return `No dry tile found near Tier ${tier}.`;
}

function runGodCmd(sim: WorldSim, playerId: string, args: readonly string[]): string {
  const flag = args[0] === "on" ? true : (args[0] === "off" ? false : undefined);
  sim.handleAdminAction(playerId, { action: "godMode", enabled: flag });
  return `God mode: ${sim.getPlayer(playerId)?.combat.godMode ? "ON" : "OFF"}`;
}

function runTimeCmd(sim: WorldSim, args: readonly string[]): string {
  const raw = (args[0] ?? "").toLowerCase();
  const phase = TIME_PRESETS[raw] ?? Number(args[0]);
  if (!Number.isFinite(phase)) return "Presets: dawn, day, golden, dusk, night";
  sim.setDayPhase(phase, true);
  return `Time set to ${raw || phase}.`;
}

const SLASH_HANDLERS: Readonly<Record<string, (sim: WorldSim, id: string, args: readonly string[]) => string>> = {
  help: () => "Commands: /god /heal /give <id> [n] /fillbag [id] /clearbag /tp <x> <y> /tier <1-5> /biome <name> /poi <kind> /time <preset>",
  god: runGodCmd,
  heal: (sim, id) => { sim.handleAdminAction(id, { action: "heal" }); return "Healed."; },
  give: runGiveCmd,
  fillbag: runFillBagCmd,
  clearbag: runClearBagCmd,
  tp: runTpCmd,
  tier: runTierCmd,
  biome: (sim, id, args) => runBiomeCmd(sim, id, args[0] ?? ""),
  poi: (sim, id, args) => runPoiCmd(sim, id, args[0] ?? "chest"),
  time: (sim, _id, args) => runTimeCmd(sim, args),
};

export function executeAdminSlashCommand(sim: WorldSim, playerId: string, rawText: string): string | null {
  const trimmed = rawText.trim();
  if (!trimmed.startsWith("/")) return null;
  const [cmdRaw = "", ...args] = trimmed.slice(1).split(/\s+/);
  const cmd = cmdRaw.toLowerCase();
  if (cmd === "shout" || cmd === "s") return null;
  const handler = SLASH_HANDLERS[cmd];
  return handler ? handler(sim, playerId, args) : `Unknown command '/${cmd}'. Try /help.`;
}