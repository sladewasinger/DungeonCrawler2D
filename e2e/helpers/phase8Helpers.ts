/** Shared deterministic Playwright helpers for Phase 8 Desktop and Mobile verification gates. */
import { GroundKind, PropKind, WorldChunkCache, validateStructurePlacement, type ChunkProp } from "@dc2d/engine";
import { expect, type Page } from "@playwright/test";

export interface FoundWorldProp {
  readonly id: string;
  readonly kind: PropKind;
  readonly x: number;
  readonly y: number;
}

interface DiagWindowApi {
  __dc2dDiag?: { getStats(): { readonly playerPos?: { readonly x: number; readonly y: number } | null } };
  admin?: {
    auth(t: string): void;
    god(enabled?: boolean): boolean;
    give(id: string, c?: number): void;
    tp(x: number, y: number): void;
    time(phaseOrPreset: number | string, paused?: boolean): void;
    state(): { readonly isAdmin?: boolean; readonly mode?: string };
  };
}

const SEL_CANVAS = "#app canvas";
const SEL_BADGE = ".ow-placement-badge";
const STRUCTURE_KINDS = ["workbench", "palisade", "bed", "wood-chest"] as const;
const FORAGE_KINDS = new Set<PropKind>([PropKind.Bush, PropKind.Wildflower, PropKind.GiantMushroom, PropKind.BogReed]);
const DESKTOP_GHOST_OFFSETS: readonly (readonly [number, number])[] = [
  [96, 0], [116, 0], [136, 0], [0, 116], [-116, 0], [0, -116],
];

const spiralYOffset = (dy: number): number =>
  (dy === 0 ? 0 : dy % 2 === 1 ? Math.ceil(dy / 2) * 0.5 : -(dy / 2) * 0.5);

function findBetterInChunk(
  props: readonly ChunkProp[],
  opts: { readonly allowed: ReadonlySet<PropKind>; readonly o: { readonly x: number; readonly y: number }; readonly bestDist: number },
): { readonly prop: ChunkProp; readonly dist: number } | null {
  let best: ChunkProp | null = null;
  let dist = opts.bestDist;
  for (const p of props) {
    if (!opts.allowed.has(p.kind) || p.elevation !== 0) continue;
    const d = Math.hypot(p.x - opts.o.x, p.y - opts.o.y);
    if (d < dist) { dist = d; best = p; }
  }
  return best ? { prop: best, dist } : null;
}

export function findNearestSeedProp(opts: {
  readonly kinds: readonly PropKind[];
  readonly maxDist?: number;
  readonly origin?: { readonly x: number; readonly y: number };
}): FoundWorldProp {
  const cache = new WorldChunkCache(1337);
  const o = opts.origin ?? { x: 0.5, y: 0.5 };
  const allowed = new Set<PropKind>(opts.kinds);
  let best: ChunkProp | null = null;
  let bestDist = opts.maxDist ?? 42;
  for (const [cx, cy] of [[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1]] as const) {
    const hit = findBetterInChunk(cache.getChunk(cx, cy).props, { allowed, o, bestDist });
    if (hit) { best = hit.prop; bestDist = hit.dist; }
  }
  if (!best) throw new Error(`No seed prop matching ${opts.kinds.join(",")} within ${bestDist}`);
  return { id: best.id, kind: best.kind, x: best.x, y: best.y };
}

function isStandableSpot(cache: WorldChunkCache, sx: number, sy: number): boolean {
  const tile = cache.tileAt(Math.floor(sx), Math.floor(sy));
  if (tile.ground === GroundKind.DeepWater || tile.ground === GroundKind.ShallowWater || tile.elevation !== 0) return false;
  if (cache.blockingObstaclesNear(sx, sy).some((obs) => Math.hypot(sx - obs.x, sy - obs.y) < obs.radius + 0.65)) return false;
  return !cache.propsNear(sx, sy).some((p) => FORAGE_KINDS.has(p.kind) && Math.hypot(sx - p.x, sy - p.y) < 2.75);
}

function isValidMultiBuildSpot(cache: WorldChunkCache, x: number, y: number): boolean {
  if (!isStandableSpot(cache, x - 1.5, y)) return false;
  const okAllKinds = STRUCTURE_KINDS.every((kind) =>
    validateStructurePlacement({ cache, x, y, playerX: x - 1.5, playerY: y, playerElev: 0, kind }).ok,
  );
  if (!okAllKinds) return false;
  if (cache.blockingObstaclesNear(x, y).some((obs) => Math.hypot(x - obs.x, y - obs.y) < obs.radius + 1.0)) return false;
  return !cache.propsNear(x, y).some((p) => FORAGE_KINDS.has(p.kind) && Math.hypot(x - p.x, y - p.y) < 2.75);
}

function tryAddBuildSpot(
  cache: WorldChunkCache,
  chosen: { readonly x: number; readonly y: number }[],
  pos: { readonly x: number; readonly y: number },
): void {
  const farEnough = chosen.every((c) => Math.hypot(pos.x - c.x, pos.y - c.y) >= 3.2);
  if (farEnough && isValidMultiBuildSpot(cache, pos.x, pos.y)) chosen.push(pos);
}

function scanHalfPlaneBuildSpots(opts: {
  readonly cache: WorldChunkCache; readonly chosen: { readonly x: number; readonly y: number }[];
  readonly count: number; readonly dir: 1 | -1;
}): void {
  for (let dist = 14.5; dist <= 34 && opts.chosen.length < opts.count; dist += 0.5) {
    for (let dy = 0; dy <= 36 && opts.chosen.length < opts.count; dy += 1) {
      tryAddBuildSpot(opts.cache, opts.chosen, { x: dist * opts.dir, y: spiralYOffset(dy) });
    }
  }
}

export function findClearHalfPlaneSpots(dir: 1 | -1, count: number): { readonly x: number; readonly y: number }[] {
  const cache = new WorldChunkCache(1337);
  const chosen: { readonly x: number; readonly y: number }[] = [];
  scanHalfPlaneBuildSpots({ cache, chosen, count, dir });
  if (chosen.length < count) throw new Error(`Only found ${chosen.length}/${count} clear spots on dir=${dir}`);
  return chosen;
}

export async function readPlayerPos(page: Page): Promise<{ readonly x: number; readonly y: number }> {
  const pos = await page.evaluate(() => (window as unknown as DiagWindowApi).__dc2dDiag?.getStats()?.playerPos ?? null);
  if (!pos) throw new Error("Player position unavailable from __dc2dDiag");
  return pos;
}

export async function teleportPlayer(page: Page, pos: { readonly x: number; readonly y: number }): Promise<void> {
  await page.evaluate((p) => { (window as unknown as DiagWindowApi).admin?.tp(p.x, p.y); }, pos);
  await expect.poll(async () => {
    const cur = await readPlayerPos(page);
    return Math.hypot(cur.x - pos.x, cur.y - pos.y) <= 0.8;
  }, { timeout: 6_000 }).toBe(true);
  await page.waitForTimeout(160);
}

export async function authenticateAndGiveItems(page: Page, items: readonly (readonly [string, number])[], needsAuth = true): Promise<void> {
  if (needsAuth) {
    await page.evaluate(() => { (window as unknown as DiagWindowApi).admin?.auth("e2e-test-token"); });
    await expect.poll(async () => page.evaluate(() => Boolean((window as unknown as DiagWindowApi).admin?.state()?.isAdmin)), { timeout: 8_000 }).toBe(true);
    await page.evaluate(() => {
      const api = (window as unknown as DiagWindowApi).admin;
      api?.god(true);
      api?.time("day", true);
    });
  }
  await page.evaluate((list) => {
    const api = (window as unknown as DiagWindowApi).admin;
    for (const [id, count] of list) api?.give(id, count);
  }, items as [string, number][]);
}

async function burstTouchMove(page: Page, dir: { readonly nx: number; readonly ny: number }, ms: number): Promise<void> {
  const sx = 110; const sy = 560;
  const tx = Math.round(sx + dir.nx * 42); const ty = Math.round(sy + dir.ny * 42);
  await page.evaluate((p) => {
    const c = document.querySelector(p.sel);
    if (!c) return;
    c.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 77, pointerType: "touch", clientX: p.sx, clientY: p.sy, bubbles: true }));
    c.dispatchEvent(new PointerEvent("pointermove", { pointerId: 77, pointerType: "touch", clientX: p.tx, clientY: p.ty, bubbles: true }));
  }, { sel: SEL_CANVAS, sx, sy, tx, ty });
  await page.waitForTimeout(ms);
  await page.evaluate((p) => {
    const c = document.querySelector(p.sel);
    c?.dispatchEvent(new PointerEvent("pointerup", { pointerId: 77, pointerType: "touch", clientX: p.tx, clientY: p.ty, bubbles: true }));
  }, { sel: SEL_CANVAS, tx, ty });
}

function movementKeysForVec(dx: number, dy: number): readonly string[] {
  const keys: string[] = [];
  if (Math.abs(dx) > 0.25) keys.push(dx > 0 ? "KeyD" : "KeyA");
  if (Math.abs(dy) > 0.25) keys.push(dy > 0 ? "KeyS" : "KeyW");
  return keys;
}

async function burstKeyMove(page: Page, vec: { readonly dx: number; readonly dy: number; readonly ms: number }): Promise<void> {
  const keys = movementKeysForVec(vec.dx, vec.dy);
  await page.keyboard.down("ShiftLeft");
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(vec.ms);
  for (const k of keys) await page.keyboard.up(k);
  await page.keyboard.up("ShiftLeft");
}

const computeWalkBurstMs = (dist: number): number =>
  Math.min(dist > 4 ? 700 : 300, Math.max(100, Math.round((dist / 5.0) * 1000)));

async function stepTowardOrSidestep(page: Page, opts: {
  readonly dx: number; readonly dy: number; readonly dist: number; readonly project: string; readonly stalled: boolean;
}): Promise<void> {
  const vx = opts.stalled ? -opts.dy / opts.dist : opts.dx / opts.dist;
  const vy = opts.stalled ? opts.dx / opts.dist : opts.dy / opts.dist;
  const ms = opts.stalled ? 320 : computeWalkBurstMs(opts.dist);
  if (opts.project === "mobile") await burstTouchMove(page, { nx: vx, ny: vy }, ms);
  else await burstKeyMove(page, { dx: vx, dy: vy, ms });
}

export async function walkTowardPoint(page: Page, opts: {
  readonly targetX: number; readonly targetY: number; readonly project: string; readonly tolerance?: number; readonly maxSteps?: number;
}): Promise<void> {
  const tol = opts.tolerance ?? 1.3;
  const steps = opts.maxSteps ?? 28;
  let prev = await readPlayerPos(page);
  let stallCount = 0;
  for (let i = 0; i < steps; i++) {
    const cur = await readPlayerPos(page);
    const dx = opts.targetX - cur.x; const dy = opts.targetY - cur.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= tol) return;
    stallCount = i > 0 && Math.hypot(cur.x - prev.x, cur.y - prev.y) < 0.08 ? stallCount + 1 : 0;
    prev = cur;
    await stepTowardOrSidestep(page, { dx, dy, dist, project: opts.project, stalled: stallCount >= 2 });
  }
}

export async function selectHotbarByItemTitle(page: Page, displayName: string): Promise<void> {
  const slot = page.locator(`.ow-hotbar button.ow-slot[title="${displayName}"]`).first();
  await expect(slot).toBeVisible({ timeout: 6_000 });
  await slot.click();
  await expect(slot).toHaveAttribute("data-selected", "true");
}

export async function useItemViaInventory(page: Page, displayName: string): Promise<void> {
  await page.locator("button[aria-label='Inventory (Tab)']").click();
  await expect(page.locator(".ow-inv-modal")).toBeVisible();
  const slot = page.locator(`.ow-modal button.ow-slot[title="${displayName}"], .ow-hotbar button.ow-slot[title="${displayName}"]`).first();
  await slot.click();
  await page.locator(".ow-item-card button:has-text('Use')").click();
  await page.keyboard.press("Escape");
}

export async function placeHeldStructure(page: Page, project: string): Promise<void> {
  await page.waitForTimeout(180);
  if (project === "mobile") {
    await expect(page.locator(SEL_BADGE)).toHaveAttribute("data-valid", "true", { timeout: 2_500 });
    await page.locator(".ow-atk-btn").tap();
    return;
  }
  const box = await page.locator(SEL_CANVAS).first().boundingBox();
  if (!box) throw new Error("Missing game canvas bounds");
  const cx = box.x + box.width * 0.5; const cy = box.y + box.height * 0.5;
  for (const [ox, oy] of DESKTOP_GHOST_OFFSETS) {
    await page.mouse.move(cx + ox, cy + oy);
    await page.waitForTimeout(110);
    if ((await page.locator(SEL_BADGE).getAttribute("data-valid")) === "true") {
      await page.mouse.click(cx + ox, cy + oy);
      return;
    }
  }
  const reason = await page.locator(SEL_BADGE).textContent();
  throw new Error(`No valid desktop ghost placement offset found (last badge: ${reason ?? "none"})`);
}

export async function triggerHeldAction(page: Page, project: string): Promise<void> {
  if (project === "mobile") {
    await page.locator(".ow-atk-btn").tap();
    return;
  }
  const box = await page.locator(SEL_CANVAS).first().boundingBox();
  if (!box) throw new Error("Missing game canvas bounds");
  const tx = box.x + box.width * 0.5 + 88; const ty = box.y + box.height * 0.5;
  await page.mouse.move(tx, ty);
  await page.waitForTimeout(80);
  await page.mouse.click(tx, ty);
}

export async function openCraftingFromToolbar(page: Page): Promise<void> {
  await page.locator("button[aria-label='Inventory (Tab)']").click();
  await expect(page.locator(".ow-inv-modal")).toBeVisible();
  await page.locator(".ow-inv-modal button:has-text('Craft')").click();
  await expect(page.locator(".ow-craft-modal")).toBeVisible();
}

export async function enterOfflineOverworld(page: Page, skipTitle = true): Promise<void> {
  await page.goto(`/?qaDiag=1&offline=1${skipTitle ? "&skipTitle=1" : ""}`, { waitUntil: "domcontentloaded" });
  if (!skipTitle) {
    await expect(page.locator(".ow-title-backdrop")).toBeVisible({ timeout: 15_000 });
    await page.locator(".ow-title-enter").click();
  }
  await expect(page.locator(SEL_CANVAS).first()).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => page.evaluate(() => Boolean((window as unknown as DiagWindowApi).__dc2dDiag?.getStats()?.playerPos)), { timeout: 10_000 }).toBe(true);
}
