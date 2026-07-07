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

/** Hold a key for a duration of real gameplay. */
export async function holdKey(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
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
        attack(dx: number, dy: number): void;
      };
    };
  }
}
