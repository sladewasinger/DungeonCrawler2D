import { expect, type Page } from "@playwright/test";

/**
 * The client exposes window.__dc2d.conn (set before the game boots).
 * These helpers read live client state through it — assertions run
 * against exactly what a player's client believes.
 */

export interface HookState {
  status: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  z: number;
  grounded: boolean;
  playerId: string | null;
  entityCount: number;
  fx: string[];
  party: { id: string; members: Array<{ id: string; name: string }> } | null;
  pendingInvite: { from: string; name: string } | null;
  chatLog: Array<{ channel: string; name: string; text: string }>;
  entities: Array<{ id: string; kind: string; defId?: string; hp?: number; x: number; y: number }>;
}

export async function readState(page: Page): Promise<HookState> {
  return page.evaluate(() => {
    const conn = window.__dc2d!.conn;
    return {
      status: conn.status,
      hp: conn.hp,
      maxHp: conn.maxHp,
      x: conn.body?.x ?? 0,
      y: conn.body?.y ?? 0,
      z: conn.body?.z ?? 0,
      grounded: conn.body?.grounded ?? false,
      playerId: conn.welcome?.playerId ?? null,
      entityCount: conn.entities.size,
      fx: conn.fx,
      party: conn.party
        ? { id: conn.party.id, members: conn.party.members.map((m) => ({ id: m.id, name: m.name })) }
        : null,
      pendingInvite: conn.pendingInvite,
      chatLog: conn.chatLog,
      entities: [...conn.entities.values()].map((e) => ({
        id: e.snap.id,
        kind: e.snap.kind,
        ...(e.snap.defId !== undefined ? { defId: e.snap.defId } : {}),
        ...(e.snap.hp !== undefined ? { hp: e.snap.hp } : {}),
        x: e.snap.x,
        y: e.snap.y,
      })),
    };
  });
}

/** Load the game and wait until the client is connected and spawned. */
export async function openGame(page: Page): Promise<HookState> {
  await page.goto("/");
  await page.waitForFunction(
    () => window.__dc2d?.conn.status === "connected" && window.__dc2d.conn.body !== null,
    undefined,
    { timeout: 20_000 },
  );
  // Click the canvas so the game has keyboard focus.
  await page.locator("canvas").first().click({ position: { x: 640, y: 200 } });
  const state = await readState(page);
  expect(state.hp).toBeGreaterThan(0);
  return state;
}

/**
 * The closest ground item of a def, from a FRESH state read. Snapshots
 * can contain far-away copies (platform loot on unreachable mesas), so
 * "the fixture at spawn" must be picked by distance, not list order.
 */
export async function nearestItem(
  page: Page,
  defId: string,
): Promise<{ x: number; y: number } | null> {
  const s = await readState(page);
  let best: { x: number; y: number } | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const e of s.entities) {
    if (e.kind !== "item" || e.defId !== defId) continue;
    const d = Math.hypot(e.x - s.x, e.y - s.y);
    if (d < bestD) {
      bestD = d;
      best = { x: e.x, y: e.y };
    }
  }
  return best;
}

/** Hold a key for a duration of real gameplay. */
export async function holdKey(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

/** Steer toward (tx, ty) with real held keys, axis-dominant, re-aiming each hop. */
export async function walkTo(
  page: Page,
  tx: number,
  ty: number,
  opts: { timeoutMs?: number; tolerance?: number } = {},
): Promise<void> {
  const deadline = Date.now() + (opts.timeoutMs ?? 30_000);
  const tolerance = opts.tolerance ?? 0.5;
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
    await holdKey(page, key, Math.min(600, Math.max(80, dist * 110)));
  }
}

/** Nearest world tile of the given id around the player (client worldgen). */
export async function findTile(
  page: Page,
  tileId: number,
  radius = 12,
): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ([id, r]) => {
      const conn = window.__dc2d!.conn;
      const bx = Math.floor(conn.body!.x);
      const by = Math.floor(conn.body!.y);
      let best: { x: number; y: number } | null = null;
      let bestD = Number.POSITIVE_INFINITY;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (conn.world!.tileAt(bx + dx, by + dy) !== id) continue;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = { x: bx + dx + 0.5, y: by + dy + 0.5 };
          }
        }
      }
      if (!best) throw new Error(`tile ${id} not found within ${r} tiles`);
      return best;
    },
    [tileId, radius] as const,
  );
}

declare global {
  interface Window {
    __dc2d?: {
      conn: {
        status: string;
        hp: number;
        maxHp: number;
        fx: string[];
        body: { x: number; y: number; z: number; grounded: boolean } | null;
        welcome: { playerId: string } | null;
        entities: Map<
          string,
          { snap: { id: string; kind: string; defId?: string; hp?: number; x: number; y: number } }
        >;
        party: { id: string; members: Array<{ id: string; name: string; x: number; y: number }> } | null;
        pendingInvite: { from: string; name: string } | null;
        chatLog: Array<{ channel: string; name: string; text: string }>;
        inventory: Array<{ item: string; qty: number } | null>;
        world: {
          tileAt(x: number, y: number): number;
          isSanctuary(x: number, y: number): boolean;
        } | null;
        attack(dx: number, dy: number): void;
      };
    };
  }
}
