/** Browser DevTools console admin commands (`window.admin`) gated by localhost or ADMIN_TOKEN auth. */
import { ITEM_CATALOG, getItemDef } from "@dc2d/content";
import type { EntityKind } from "@dc2d/engine";
import type { WorldClient } from "../net/worldClient.js";

export const ADMIN_SPAWN_KINDS = [
  "wolf", "bear", "boar", "spider", "slime", "goblin", "orc", "skeleton", "golem",
] as const;

const VALID_SPAWN_SET = new Set<string>(ADMIN_SPAWN_KINDS);
const TIME_PRESETS: Readonly<Record<string, number>> = { dawn: 0.27, day: 0.46, golden: 0.68, dusk: 0.79, night: 0.94 };
const LOG_PREFIX = "[admin]";

export interface AdminConsoleApi {
  help(): void;
  auth(token: string): void;
  spawn(kind: Exclude<EntityKind, "dummy" | "slime-dummy" | "spar-dummy">, count?: number): void;
  god(enabled?: boolean): boolean;
  heal(): void;
  give(itemId: string, count?: number): void;
  clearWebs(): void;
  time(phaseOrPreset: number | "dawn" | "day" | "golden" | "dusk" | "night", paused?: boolean): void;
  state(): Record<string, unknown>;
}

function requireServerMode(client: WorldClient, actionLabel: string): boolean {
  if (client.snapshot().mode === "server") return true;
  console.warn(`${LOG_PREFIX} Not connected to game server — enter the world first before ${actionLabel}.`);
  return false;
}

function requireAuthorized(client: WorldClient, actionLabel: string): boolean {
  const snap = client.snapshot();
  if (snap.mode !== "server" || snap.selfAdmin) return true;
  console.warn(`${LOG_PREFIX} Not authorized in production. Run admin.auth("<ADMIN_TOKEN>") first before ${actionLabel}.`);
  return false;
}

function logHelp(): void {
  console.log([
    `${LOG_PREFIX} Available Chrome DevTools commands:`,
    "  admin.auth(token)            — Authenticate session in production with SSM ADMIN_TOKEN",
    `  admin.spawn(kind, count=1)   — Spawn enemies: ${ADMIN_SPAWN_KINDS.join(", ")} (1..10)`,
    "  admin.god(enabled?)          — Toggle unlimited health & stamina/sprint (or pass true/false)",
    "  admin.heal()                 — Full HP/stamina & clear poison, burn, bleed, web, cocoon",
    "  admin.give(itemId, count=1)  — Grant inventory item (e.g. 'torch', 'sword', 'bow', 'arrow')",
    "  admin.clearWebs()            — Clear nearby spider webs and release cocoon",
    "  admin.time(phase|preset)     — Set time ('dawn'|'day'|'golden'|'dusk'|'night' or 0..1)",
    "  admin.state()                — Inspect live hero, admin auth, & world status",
  ].join("\n"));
}

function runAuth(client: WorldClient, token: string): void {
  if (!requireServerMode(client, "authenticating")) return;
  const trimmed = typeof token === "string" ? token.trim() : "";
  if (!trimmed) { console.warn(`${LOG_PREFIX} Pass your ADMIN_TOKEN: admin.auth("<token>")`); return; }
  client.sendAdmin({ action: "auth", token: trimmed });
  console.info(`${LOG_PREFIX} Auth sent — run admin.state() to confirm isAdmin: true.`);
}

function runSpawn(client: WorldClient, kind: Exclude<EntityKind, "dummy" | "slime-dummy" | "spar-dummy">, count = 1): void {
  if (!VALID_SPAWN_SET.has(kind)) { console.warn(`${LOG_PREFIX} Unknown kind '${kind}'. Valid: ${ADMIN_SPAWN_KINDS.join(", ")}`); return; }
  if (!requireServerMode(client, "spawning enemies") || !requireAuthorized(client, "spawning enemies")) return;
  const n = Math.max(1, Math.min(10, Math.round(count)));
  client.debugSpawn(kind, n);
  console.info(`${LOG_PREFIX} Spawned ${n}x ${kind} ahead of hero.`);
}

function runGod(client: WorldClient, enabled?: boolean): boolean {
  if (!requireAuthorized(client, "toggling god mode")) return false;
  const snap = client.snapshot();
  const me = snap.players.find((p) => p.id === snap.localPlayerId);
  const next = enabled ?? !me?.godMode;
  client.sendAdmin({ action: "godMode", enabled: next });
  console.info(`${LOG_PREFIX} God mode: ${next ? "ON (unlimited health & stamina)" : "OFF"}`);
  return next;
}

function runGive(client: WorldClient, itemId: string, count = 1): void {
  if (!getItemDef(itemId)) {
    const ids = ITEM_CATALOG.map((d) => d.id).join(", ");
    console.warn(`${LOG_PREFIX} Unknown itemId '${itemId}'. Items: ${ids}`);
    return;
  }
  if (!requireServerMode(client, "giving items") || !requireAuthorized(client, "giving items")) return;
  const n = Math.max(1, Math.min(99, Math.round(count)));
  client.sendAdmin({ action: "give", itemId, count: n });
  console.info(`${LOG_PREFIX} Granted ${n}x ${itemId}.`);
}

function runTime(client: WorldClient, phaseOrPreset: number | string, paused = true): void {
  if (!requireAuthorized(client, "changing time")) return;
  const phase = typeof phaseOrPreset === "string" ? (TIME_PRESETS[phaseOrPreset] ?? 0.46) : phaseOrPreset;
  client.setDayPhase(phase, paused);
  console.info(`${LOG_PREFIX} Day phase set to ${phase.toFixed(2)} (paused=${paused}).`);
}

function readAdminState(client: WorldClient): Record<string, unknown> {
  const snap = client.snapshot();
  const me = snap.players.find((p) => p.id === snap.localPlayerId);
  const base = { mode: snap.mode, isAdmin: Boolean(snap.selfAdmin), id: snap.localPlayerId, players: snap.players.length, entities: snap.entities.length, webStrands: snap.webs?.strands.length ?? 0 };
  if (!me) return base;
  return {
    ...base, x: me.x, y: me.y, hp: me.hp, maxHp: me.maxHp, stamina: me.stamina,
    godMode: Boolean(me.godMode), poisonTimer: me.poisonTimer ?? 0, poisonLocked: Boolean(me.poisonLocked),
    webStick: me.webStick ?? 0, cocoonProgress: me.cocoonProgress ?? 0,
  };
}

export function installAdminConsole(client: WorldClient, opts?: { readonly silent?: boolean }): AdminConsoleApi {
  const api: AdminConsoleApi = {
    help: logHelp,
    auth: (token) => runAuth(client, token),
    spawn: (kind, count) => runSpawn(client, kind, count),
    god: (enabled) => runGod(client, enabled),
    heal: () => { if (requireAuthorized(client, "healing")) { client.sendAdmin({ action: "heal" }); console.info(`${LOG_PREFIX} Hero healed and cleared of debuffs.`); } },
    give: (itemId, count) => runGive(client, itemId, count),
    clearWebs: () => { if (requireAuthorized(client, "clearing webs")) { client.sendAdmin({ action: "clearWebs" }); console.info(`${LOG_PREFIX} Cleared nearby webs & cocoon.`); } },
    time: (phase, paused) => runTime(client, phase, paused),
    state: () => readAdminState(client),
  };
  (window as unknown as { admin?: AdminConsoleApi }).admin = api;
  if (!opts?.silent) console.info("[dc2d] DevTools admin console ready — type admin.help()");
  return api;
}
