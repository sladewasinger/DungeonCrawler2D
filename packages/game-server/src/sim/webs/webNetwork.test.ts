import { GroundKind, PropKind, WorldChunkCache, type ChunkProp } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { createCombatState, type CombatPlayerRef } from "../combatActions.js";
import { CombatWorld } from "../combatSim.js";
import { createStarterInventory } from "../playerInventory.js";

class TreeAnchorCache extends WorldChunkCache {
  override tileAt() { return { ground: GroundKind.Grass, elevation: 0, stairs: false }; }
  override propsNear(): readonly ChunkProp[] {
    return [{ id: "oak-1", kind: PropKind.OakTree, x: 21.2, y: 12.1, variant: 0, elevation: 0, radius: 0.4, blocksMovement: true }];
  }
}

const SPEAR_ID = "wooden-spear";

function makePlayer(opts: {
  readonly id: string; readonly x: number; readonly y: number; readonly heldItem?: string | null;
}): CombatPlayerRef & { moving: boolean } {
  const inv = createStarterInventory();
  const held = opts.heldItem === undefined ? SPEAR_ID : opts.heldItem;
  inv.slots[0] = held ? { itemId: held, count: 1 } : null;
  return {
    id: opts.id, x: opts.x, y: opts.y, elevation: 0, facingX: 1, facingY: 0, aimX: 1, aimY: 0,
    selectedHotbar: 0, crouching: false, inventory: inv, combat: createCombatState(), moving: false,
  };
}

function stepTick(opts: {
  readonly cw: CombatWorld; readonly map: Map<string, CombatPlayerRef>; readonly p: CombatPlayerRef; readonly attack?: boolean;
}): void {
  opts.cw.stepPlayerAction({
    player: opts.p, players: opts.map, dt: 0.05,
    input: { moveX: 0, moveY: 0, attackQueued: Boolean(opts.attack), bowDrawing: false, bowReleaseQueued: false, blockHeld: false, dodgeQueued: false },
  });
  opts.cw.stepWorld({ players: opts.map, dt: 0.05, dayPhase: 0.5, timeSec: 0 });
}

function swingUntilFreed(opts: {
  readonly cw: CombatWorld; readonly map: Map<string, CombatPlayerRef>; readonly attacker: CombatPlayerRef; readonly victim: CombatPlayerRef; readonly ticks?: number;
}): void {
  const ticks = opts.ticks ?? 8;
  for (let strike = 0; strike < 3 && opts.victim.combat.cocoonProgress > 0; strike++) {
    for (let i = 0; i < ticks; i++) stepTick({ cw: opts.cw, map: opts.map, p: opts.attacker, attack: i === 0 });
  }
}

function setupCocoonScenario() {
  const cw = new CombatWorld(new TreeAnchorCache(1337));
  const v = makePlayer({ id: "v", x: 20, y: 12, heldItem: SPEAR_ID });
  v.combat.webStick = 0.95; v.combat.webStuckSec = 2.0;
  const map = new Map<string, CombatPlayerRef>([[v.id, v]]);
  const spider = cw.ecology.spawnEntity({ kind: "spider", x: 20.8, y: 12, homeRadius: 8, poiId: null, packId: null, packSlot: 0 });
  spider.targetPlayerId = v.id; spider.aiState = "chase"; spider.suspicion = 1; spider.webShotCooldown = 99;
  for (let i = 0; i < 62; i++) stepTick({ cw, map, p: v });
  return { cw, v, map, spider };
}

describe("Dynamic cloth spiderwebs, sharp cuts, fire spread, cocoon wrap & rescues", () => {
  it("spawns tree-anchored cloth webs on ranged spider spit, auto-stitches overlapping webs, and stretches when walked through", () => {
    const cw = new CombatWorld(new TreeAnchorCache(1337));
    const p = makePlayer({ id: "p1", x: 20, y: 12 });
    const map = new Map<string, CombatPlayerRef>([[p.id, p]]);
    const spider = cw.ecology.spawnEntity({ kind: "spider", x: 24.5, y: 12, homeRadius: 10, poiId: null, packId: null, packSlot: 0 });
    spider.targetPlayerId = p.id; spider.aiState = "chase"; spider.suspicion = 1;

    for (let i = 0; i < 16; i++) stepTick({ cw, map, p });
    expect(cw.drainEvents().some((e) => e.kind === "webSpit")).toBe(true);
    const firstStrands = cw.webs.strands.length;
    expect(firstStrands).toBeGreaterThan(10);
    expect(cw.webs.nodes.some((n) => n.pinned && Math.hypot(n.x - 21.2, n.y - 12.1) < 0.05)).toBe(true);

    cw.webs.spawnWebCluster({ cache: new TreeAnchorCache(1337), x: 21.3, y: 12.2 });
    expect(cw.webs.strands.length).toBeGreaterThan(firstStrands * 2);

    const freeNode = cw.webs.nodes.find((n) => !n.pinned && Math.hypot(n.x - p.x, n.y - p.y) < 0.5)!;
    const xBefore = freeNode.x;
    p.x += 0.22;
    stepTick({ cw, map, p });
    expect(freeNode.x).not.toBeCloseTo(xBefore, 4);
    expect(p.combat.webStick).toBeGreaterThan(0.3);
  });

  it("resists unarmed/blunt blows while sharp weapons cut strands free and torches ignite connected webs", () => {
    const cw = new CombatWorld(new TreeAnchorCache(1337));
    cw.webs.spawnWebCluster({ cache: new TreeAnchorCache(1337), x: 20.5, y: 12 });
    const blunt = makePlayer({ id: "blunt", x: 19.6, y: 12, heldItem: "pickaxe" });
    const map = new Map<string, CombatPlayerRef>([[blunt.id, blunt]]);
    const initialCount = cw.webs.strands.length;
    for (let i = 0; i < 9; i++) stepTick({ cw, map, p: blunt, attack: i === 0 });
    expect(cw.webs.strands.length).toBe(initialCount);

    blunt.inventory.slots[0] = { itemId: SPEAR_ID, count: 1 };
    blunt.combat.actionCooldown = 0; blunt.combat.swingTimer = 0;
    for (let i = 0; i < 9; i++) stepTick({ cw, map, p: blunt, attack: i === 0 });
    expect(cw.webs.strands.length).toBeLessThan(initialCount);
    expect(cw.drainEvents().some((e) => e.kind === "webCut")).toBe(true);

    blunt.inventory.slots[0] = { itemId: "torch", count: 1 };
    blunt.combat.actionCooldown = 0; blunt.combat.swingTimer = 0;
    for (let i = 0; i < 6; i++) stepTick({ cw, map, p: blunt, attack: i === 0 });
    expect(cw.webs.strands.some((s) => s.fire > 0)).toBe(true);
    for (let i = 0; i < 24; i++) stepTick({ cw, map, p: blunt });
    expect(cw.webs.strands.length).toBe(0);
  });

  it("cocoons extended stuck victims with ~60s locked poison, de-aggros spider, and supports self-cut & ally rescues", () => {
    const s1 = setupCocoonScenario();
    expect(s1.v.combat.cocoonProgress).toBe(1);
    expect(s1.v.combat.poisonLocked).toBe(true);
    expect(s1.cw.moveMultiplier(s1.v)).toBe(0);
    expect(["return", "ambush", "patrol", "idle"]).toContain(s1.spider.aiState);
    expect(s1.spider.targetPlayerId).toBeNull();
    const lockedDur = s1.v.combat.poisonTimer;
    const hpBefore = s1.v.combat.hp;
    s1.cw.drainEvents();
    for (let i = 0; i < 26; i++) stepTick({ cw: s1.cw, map: s1.map, p: s1.v });
    expect(s1.v.combat.poisonTimer).toBeCloseTo(lockedDur, 2);
    const ticks = s1.cw.drainEvents().filter((e) => e.kind === "poisonTick");
    expect(ticks[0]?.value).toBe(2);
    expect(hpBefore - s1.v.combat.hp).toBe(2);
    expect(s1.spider.targetPlayerId).toBeNull();
    expect(["return", "ambush", "patrol", "idle"]).toContain(s1.spider.aiState);

    swingUntilFreed({ cw: s1.cw, map: s1.map, attacker: s1.v, victim: s1.v });
    expect(s1.v.combat.cocoonProgress).toBe(0);
    expect(s1.v.combat.poisonLocked).toBe(false);
    expect(s1.cw.drainEvents().some((e) => e.kind === "cocoonBreak")).toBe(true);

    const s2 = setupCocoonScenario();
    const ally = makePlayer({ id: "ally", x: 19.1, y: 12, heldItem: "sword" });
    s2.map.set(ally.id, ally);
    s2.cw.drainEvents();
    swingUntilFreed({ cw: s2.cw, map: s2.map, attacker: ally, victim: s2.v, ticks: 7 });
    expect(s2.v.combat.cocoonProgress).toBe(0);
    expect(s2.cw.drainEvents().some((e) => e.kind === "hit" && e.actorId === "ally" && e.targetId === s2.v.id)).toBe(false);
  });

  it("burns through cocoon to free trapped victims and unlock poison", () => {
    const s3 = setupCocoonScenario();
    s3.v.inventory.slots[0] = { itemId: "torch", count: 1 };
    for (let i = 0; i < 6; i++) stepTick({ cw: s3.cw, map: s3.map, p: s3.v, attack: i === 0 });
    expect(s3.v.combat.cocoonBurning).toBe(true);
    for (let i = 0; i < 32; i++) stepTick({ cw: s3.cw, map: s3.map, p: s3.v });
    expect(s3.v.combat.cocoonProgress).toBe(0);
    expect(s3.v.combat.poisonLocked).toBe(false);
  });
});
