// Shared drive/read helpers for the e2e suite. Every action goes through REAL trusted
// input (page.keyboard/page.mouse — Phaser's InputPlugin ignores synthetic dispatchEvent
// calls, so page.evaluate must never be used to fake a click/keypress). Assertions read
// window.__dc2d.conn, the live Connection a DEV+?debug=1 build exposes read-only
// (packages/client/src/main.ts) — the same "authoritative client state" convention
// reference/e2e/game.spec.ts's v1 suite proved, ported (not copied) to v2's shape.
//
// Non-null-assertion note (suite-wide, ENGINEERING_STANDARDS.md's "needs an inline
// justification comment" outside packages/engine): every `window.__dc2d!` in this suite
// follows openGame()'s own `waitForFunction(() => window.__dc2d?.conn.status ===
// "connected" ...)`, which is the one place that can fail — every read after it is
// inside a passing test where the hook is already known to exist.
import { expect, type Page } from "@playwright/test";
import { CLIENT_URL, WS_URL } from "./env.js";

export interface HookEntity {
  id: string;
  kind: string;
  defId?: string;
  hp?: number;
  x: number;
  y: number;
  state?: string;
}

export interface HookChatLine {
  channel: string;
  name: string;
  text: string;
  target?: string;
}

export interface HookState {
  status: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  z: number;
  grounded: boolean;
  playerId: string | null;
  weapon: string | null;
  inventory: Array<{ item: string; qty: number }>;
  hotbar: Array<string | null>;
  entities: HookEntity[];
  chatLog: HookChatLine[];
  contacts: Array<{ name: string; online: boolean }>;
}

export async function readState(page: Page): Promise<HookState> {
  return page.evaluate(() => {
    // Nested (not imported): page.evaluate serializes this whole callback to run
    // in-browser, so a helper it calls must be declared inside the same closure —
    // splitting it out only keeps the outer callback's own complexity under the lint cap.
    function toEntity(e: { snap: Record<string, unknown> & { id: string; kind: string; x: number; y: number } }): HookEntity {
      const snap = e.snap;
      return {
        id: snap.id,
        kind: snap.kind,
        ...(snap["defId"] !== undefined ? { defId: snap["defId"] as string } : {}),
        ...(snap["hp"] !== undefined ? { hp: snap["hp"] as number } : {}),
        ...(snap["state"] !== undefined ? { state: snap["state"] as string } : {}),
        x: snap.x,
        y: snap.y,
      };
    }
    const conn = window.__dc2d!.conn;
    // Defaulted once, up front — reading through `body.*` below (instead of
    // `conn.body?.x ?? 0` five times over) keeps this function's branch count low.
    const body = conn.body ?? { x: 0, y: 0, z: 0, zVel: 0, grounded: false };
    return {
      status: conn.status,
      hp: conn.hp,
      maxHp: conn.maxHp,
      x: body.x,
      y: body.y,
      z: body.z,
      grounded: body.grounded,
      playerId: conn.welcome?.playerId ?? null,
      weapon: conn.weapon,
      inventory: conn.inventory,
      hotbar: conn.hotbar,
      chatLog: conn.chatLog,
      contacts: conn.contacts,
      entities: [...conn.entities.values()].map(toEntity),
    };
  });
}

/**
 * Loads the game with a fixed e2e server override and waits until connected+spawned.
 *
 * `level` defaults to "sandbox", not the title screen's own "dungeon" default: the
 * deterministic TEST_FIXTURES fixtures (starter-kit ground items, the slime-pit combat
 * arena) only seed on the sandbox level — game-server/src/sim/enemies/population.ts's
 * `populateChunk` runs `populateTestZoneChunk` solely inside its `level === Sandbox`
 * branch, so a dungeon join gets ordinary random procedural spawns instead (verified
 * live: a dungeon-level join finds an unrelated wild slime, never the documented
 * (20.5, 42.5) fixture). v2's title screen has no level picker to reach sandbox at all
 * (docs/ROADMAP.md Epic 7.12's title-screen audit bullet — a different lane's gap), so
 * a sandbox join drives Connection.connect("sandbox") directly through the same
 * DEV+?debug=1 hook every other assertion in this suite already reads through, instead
 * of the real "Enter the Dungeon" button (which only ever requests "dungeon"). The
 * "dungeon" path below still exercises the real name-field + button UI for specs that
 * only care about the join flow itself, not fixture determinism.
 */
export async function openGame(page: Page, name?: string, level: "dungeon" | "sandbox" = "sandbox"): Promise<HookState> {
  await page.goto(`${CLIENT_URL}/?debug=1&server=${encodeURIComponent(WS_URL)}`);
  if (level === "dungeon") {
    if (name) await page.locator("input").first().fill(name);
    await page.getByRole("button", { name: "Enter the Dungeon" }).click();
  } else {
    await page.waitForFunction(() => window.__dc2d !== undefined, undefined, { timeout: 10_000 });
    await page.evaluate(
      ({ name: playerName }) => {
        const conn = window.__dc2d!.conn;
        if (playerName) conn.setName(playerName);
        conn.connect("sandbox");
      },
      { name },
    );
  }
  await page.waitForFunction(
    () => window.__dc2d?.conn.status === "connected" && window.__dc2d.conn.body !== null,
    undefined,
    { timeout: 20_000 },
  );
  // Real click so the canvas — not the name/connect DOM overlay — owns keyboard focus.
  await page.locator("canvas").first().click({ position: { x: 640, y: 200 } });
  const state = await readState(page);
  expect(state.hp).toBeGreaterThan(0);
  return state;
}

/** Holds a key for a duration of real gameplay, real trusted keydown/keyup. */
export async function holdKey(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

/** Steers toward (tx, ty) with real held keys, axis-dominant, re-aiming every hop. */
export async function walkTo(
  page: Page,
  tx: number,
  ty: number,
  opts: { timeoutMs?: number; tolerance?: number } = {},
): Promise<void> {
  const deadline = Date.now() + (opts.timeoutMs ?? 20_000);
  const tolerance = opts.tolerance ?? 0.6;
  for (;;) {
    const s = await readState(page);
    const dx = tx - s.x;
    const dy = ty - s.y;
    if (Math.hypot(dx, dy) <= tolerance) return;
    if (Date.now() > deadline) {
      throw new Error(`walkTo(${tx},${ty}) stuck at (${s.x.toFixed(1)},${s.y.toFixed(1)})`);
    }
    const key = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "d" : "a") : dy > 0 ? "s" : "w";
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    await holdKey(page, key, Math.min(500, Math.max(80, dist * 110)));
  }
}

/** The nearest entity of a kind/def to the player, from a fresh state read. */
export async function nearestEntity(
  page: Page,
  kind: string,
  defId?: string,
): Promise<HookEntity | null> {
  const s = await readState(page);
  let best: HookEntity | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const e of s.entities) {
    if (e.kind !== kind || (defId !== undefined && e.defId !== defId)) continue;
    const d = Math.hypot(e.x - s.x, e.y - s.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

declare global {
  interface Window {
    __dc2d?: {
      conn: {
        status: string;
        hp: number;
        maxHp: number;
        name: string;
        weapon: string | null;
        fx: string[];
        body: { x: number; y: number; z: number; zVel: number; grounded: boolean } | null;
        welcome: { playerId: string } | null;
        serverTick: number;
        entities: Map<string, { snap: Record<string, unknown> & { id: string; kind: string; x: number; y: number } }>;
        inventory: Array<{ item: string; qty: number }>;
        hotbar: Array<string | null>;
        chatLog: HookChatLine[];
        contacts: Array<{ name: string; online: boolean }>;
        pendingInvite: { from: string; name: string } | null;
        party: { id: string; members: Array<{ id: string; name: string; x: number; y: number }> } | null;
        world: {
          tileAt(x: number, y: number): number;
          heightAt(x: number, y: number): number;
        } | null;
        attack(dx: number, dy: number): void;
        equip(item: string | null): void;
        throwTorch(dirX: number, dirY: number): void;
        pickup(): void;
        suicide(): void;
        fistbump(targetId: string): void;
        chat(channel: "party" | "local" | "global" | "dm", text: string, target?: string): void;
        debugTeleport(x: number, y: number): void;
        debugGod(on?: boolean): void;
        setName(name: string): void;
        connect(level: "dungeon" | "sandbox"): void;
      };
      game: unknown;
      /** LANE W2 read-only observation hook — the seam's live settled ViewOrientation. */
      viewOrientation(): number;
    };
  }
}
