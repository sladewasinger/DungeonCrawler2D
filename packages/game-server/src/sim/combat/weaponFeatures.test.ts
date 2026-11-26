import { getItemDef, maxStackForItem, RECIPE_CATALOG, resolveBlockMode, resolveItemInstance } from "@dc2d/content";
import {
  GroundKind, PARRY_STAGGER_SEC, WEAPON_ARCHETYPES, WorldChunkCache, resolveWeaponArchetype,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { createCombatState, type CombatPlayerRef } from "../combatActions.js";
import { CombatWorld } from "../combatSim.js";
import { createStarterInventory } from "../playerInventory.js";

const DAGGER_ID = "flint-dagger";
const SPEAR_ID = "wooden-spear";
const GREATSWORD_ID = "iron-greatsword";
const SHIELD_ID = "wooden-shield";

class TestCache extends WorldChunkCache {
  constructor(private readonly ground: GroundKind = GroundKind.Grass) { super(1337); }
  override tileAt() { return { ground: this.ground, elevation: 0, stairs: false }; }
  override propsNear() { return []; }
}

function makeArmedPlayer(opts: { readonly id: string; readonly x: number; readonly y: number; readonly heldItem: string; readonly offhand?: string | null }): CombatPlayerRef {
  const baseInv = createStarterInventory();
  const offhand = opts.offhand === undefined ? SHIELD_ID : opts.offhand;
  const inv = { ...baseInv, armor: { ...baseInv.armor, offhand } };
  inv.slots[0] = { itemId: opts.heldItem, count: 1 };
  return {
    id: opts.id, x: opts.x, y: opts.y, elevation: 0, facingX: 1, facingY: 0, aimX: 1, aimY: 0,
    selectedHotbar: 0, crouching: false, inventory: inv, combat: createCombatState(),
  };
}

function swingAndResolve(opts: { readonly cw: CombatWorld; readonly p: CombatPlayerRef; readonly map: Map<string, CombatPlayerRef>; readonly block?: boolean }) {
  for (let i = 0; i < 10; i++) {
    opts.cw.stepPlayerAction({
      player: opts.p, players: opts.map, dt: 0.05,
      input: { moveX: 0, moveY: 0, attackQueued: i === 0, bowDrawing: false, bowReleaseQueued: false, blockHeld: Boolean(opts.block), dodgeQueued: false },
    });
    opts.cw.stepWorld({ players: opts.map, dt: 0.05, dayPhase: 0.5, timeSec: i * 0.05 });
  }
}

describe("Phase 7 weapon archetypes, recipes, armor-crush, burn DoT, shield-poke, and riposte", () => {
  it("registers all 8 archetypes, twoHanded flags, and crafting recipes for flint-dagger, wooden-spear & iron-greatsword", () => {
    expect(WEAPON_ARCHETYPES).toHaveLength(8);
    expect(resolveWeaponArchetype(DAGGER_ID, getItemDef(DAGGER_ID)?.weaponArchetype)).toBe("dagger");
    expect(resolveWeaponArchetype(SPEAR_ID, getItemDef(SPEAR_ID)?.weaponArchetype)).toBe("spear");
    expect(resolveWeaponArchetype(GREATSWORD_ID, getItemDef(GREATSWORD_ID)?.weaponArchetype)).toBe("greatsword");
    expect(getItemDef(GREATSWORD_ID)?.twoHanded).toBe(true);
    expect(getItemDef("bow")?.twoHanded).toBe(true);
    expect(RECIPE_CATALOG.map((r) => r.id)).toEqual(expect.arrayContaining([`craft-${DAGGER_ID}`, `craft-${SPEAR_ID}`, `craft-${GREATSWORD_ID}`]));
    expect(maxStackForItem(DAGGER_ID)).toBe(1);
  });

  it("deals Pickaxe 1.4x armor-crush vs golem + 0.65-tile AoE slam, and Spear Shield-Poke without dropping block", () => {
    const cw = new CombatWorld(new TestCache());
    const p = makeArmedPlayer({ id: "p1", x: 20, y: 12, heldItem: "pickaxe" });
    const map = new Map([[p.id, p]]);
    const golem = cw.ecology.spawnEntity({ kind: "golem", x: 21.1, y: 12, homeRadius: 8, poiId: null, packId: null, packSlot: 0 });
    const splashGoblin = cw.ecology.spawnEntity({ kind: "goblin", x: 21.2, y: 12.45, homeRadius: 8, poiId: null, packId: null, packSlot: 1 });
    golem.facingX = -1; splashGoblin.facingX = -1;

    const golemHpBefore = golem.hp;
    const gobHpBefore = splashGoblin.hp;
    swingAndResolve({ cw, p, map });
    const evs = cw.drainEvents();
    expect(evs.some((e) => e.kind === "slamImpact")).toBe(true);
    expect(golemHpBefore - golem.hp).toBeGreaterThan(gobHpBefore - splashGoblin.hp);
    expect(splashGoblin.hp).toBeLessThan(gobHpBefore);

    const spearCw = new CombatWorld(new TestCache());
    const sp = makeArmedPlayer({ id: "sp", x: 20, y: 12, heldItem: SPEAR_ID });
    const sMap = new Map([[sp.id, sp]]);
    spearCw.stepPlayerAction({
      player: sp, players: sMap, dt: 0.05,
      input: { moveX: 0, moveY: 0, attackQueued: false, bowDrawing: false, bowReleaseQueued: false, blockHeld: true, dodgeQueued: false },
    });
    swingAndResolve({ cw: spearCw, p: sp, map: sMap, block: true });
    expect(sp.combat.blocking).toBe(true);
    expect(spearCw.drainEvents().some((e) => e.kind === "swing" && e.weaponArchetype === "spear")).toBe(true);
  });

  it("applies Torch burn DoT (1.35x vs spider), water extinguish, Dagger 3x backstab & Timed Parry Riposte", () => {
    const cw = new CombatWorld(new TestCache());
    const p = makeArmedPlayer({ id: "p1", x: 20, y: 12, heldItem: "torch" });
    const map = new Map([[p.id, p]]);
    const spider = cw.ecology.spawnEntity({ kind: "spider", x: 21.1, y: 12, homeRadius: 8, poiId: null, packId: null, packSlot: 0 });
    spider.facingX = -1;
    swingAndResolve({ cw, p, map });
    expect(spider.burnTimer).toBeGreaterThan(2.0);
    for (let i = 0; i < 18; i++) cw.stepWorld({ players: map, dt: 0.05, dayPhase: 0.5, timeSec: 1 + i * 0.05 });
    expect(cw.drainEvents().some((e) => e.kind === "burnTick" && e.targetId === spider.id)).toBe(true);

    const waterCw = new CombatWorld(new TestCache(GroundKind.ShallowWater));
    const wp = makeArmedPlayer({ id: "pw", x: 20, y: 12, heldItem: "sword" });
    wp.inWater = true; wp.combat.burnTimer = 2.0;
    const wMap = new Map([[wp.id, wp]]);
    waterCw.stepPlayerAction({
      player: wp, players: wMap, dt: 0.05,
      input: { moveX: 0, moveY: 0, attackQueued: false, bowDrawing: false, bowReleaseQueued: false, blockHeld: false, dodgeQueued: false },
    });
    expect(wp.combat.burnTimer).toBe(0);
    expect(waterCw.drainEvents().some((e) => e.kind === "burnExtinguish")).toBe(true);

    const dagCw = new CombatWorld(new TestCache());
    const dp = makeArmedPlayer({ id: "dp", x: 28.9, y: 12, heldItem: DAGGER_ID });
    dp.crouching = true; dp.visibility = 0.35; dp.noiseRadius = 0.4;
    const dMap = new Map([[dp.id, dp]]);
    const daggerGob = dagCw.ecology.spawnEntity({ kind: "goblin", x: 30, y: 12, homeRadius: 8, poiId: null, packId: null, packSlot: 0 });
    daggerGob.facingX = 1; daggerGob.facingY = 0; daggerGob.targetPlayerId = null;
    swingAndResolve({ cw: dagCw, p: dp, map: dMap });
    const backHit = dagCw.drainEvents().find((e) => e.kind === "backstab" && e.targetId === daggerGob.id);
    expect(backHit).toBeDefined();
    expect(backHit?.value).toBeGreaterThanOrEqual(33);

    const ripP = makeArmedPlayer({ id: "rp", x: 9.2, y: -1.5, heldItem: "sword" });
    const rMap = new Map([[ripP.id, ripP]]);
    const spar = cw.dummies.find((d) => d.id === "dummy-spar")!;
    spar.telegraphTimer = 0.05;
    cw.stepPlayerAction({ player: ripP, players: rMap, dt: 0.05, input: { moveX: 0, moveY: 0, attackQueued: false, bowDrawing: false, bowReleaseQueued: false, blockHeld: true, dodgeQueued: false } });
    cw.stepWorld({ players: rMap, dt: 0.05, dayPhase: 0.5, timeSec: 0 });
    expect(spar.staggerTimer).toBeCloseTo(PARRY_STAGGER_SEC, 2);
    expect(spar.parried).toBe(true);
    swingAndResolve({ cw, p: ripP, map: rMap });
    expect(cw.drainEvents().some((e) => e.kind === "riposte")).toBe(true);
  });

  it("supports weaker two-handed blade block & timed parry without a shield while disabling bow block", () => {
    expect(resolveBlockMode("bow", SHIELD_ID)).toBe("none");
    expect(resolveBlockMode(GREATSWORD_ID, null)).toBe("twoHanded");

    const runBlock = (heldItem: string, offhand: string | null, holdTicksBefore: number) => {
      const cw = new CombatWorld(new TestCache());
      const att = makeArmedPlayer({ id: "att", x: 20, y: 12, heldItem: "sword" });
      const def = makeArmedPlayer({ id: "def", x: 21.1, y: 12, heldItem, offhand });
      def.aimX = -1; def.facingX = -1;
      const map = new Map([[att.id, att], [def.id, def]]);
      for (let i = 0; i < holdTicksBefore; i++) {
        cw.stepPlayerAction({ player: def, players: map, dt: 0.05, input: { moveX: 0, moveY: 0, attackQueued: false, bowDrawing: false, bowReleaseQueued: false, blockHeld: true, dodgeQueued: false } });
      }
      const hpBefore = def.combat.hp;
      const stamBefore = def.combat.stamina;
      for (let i = 0; i < 4; i++) {
        cw.stepPlayerAction({ player: def, players: map, dt: 0.05, input: { moveX: 0, moveY: 0, attackQueued: false, bowDrawing: false, bowReleaseQueued: false, blockHeld: true, dodgeQueued: false } });
        cw.stepPlayerAction({ player: att, players: map, dt: 0.05, input: { moveX: 0, moveY: 0, attackQueued: i === 0, bowDrawing: false, bowReleaseQueued: false, blockHeld: false, dodgeQueued: false } });
      }
      return { blocking: def.combat.blocking, hpLoss: hpBefore - def.combat.hp, stamLoss: stamBefore - def.combat.stamina, evs: cw.drainEvents() };
    };

    const shieldRes = runBlock("sword", SHIELD_ID, 6);
    const gsBlockRes = runBlock(GREATSWORD_ID, null, 6);
    expect(gsBlockRes.blocking).toBe(true);
    expect(gsBlockRes.hpLoss).toBeGreaterThan(shieldRes.hpLoss);
    expect(gsBlockRes.stamLoss).toBeGreaterThan(shieldRes.stamLoss);

    const gsParryRes = runBlock(GREATSWORD_ID, null, 0);
    expect(gsParryRes.evs.some((e) => e.kind === "parry" && e.actorId === "def")).toBe(true);
  });

  it("propagates bow perks/element, bleed DoT, Math.max perk stacking, and tiered harvestPower", () => {
    const venomSword = resolveItemInstance("venom-fang-blade", "venomous");
    expect(venomSword.perks.find((p) => p.kind === "poison")?.value).toBe(6);
    expect(getItemDef("bow")?.weaponArchetype).toBe("bow");
    expect(getItemDef("copper-axe")?.harvestPower).toBe(42);
    expect(getItemDef("frost-hatchet")?.harvestPower).toBe(56);

    const cw = new CombatWorld(new TestCache());
    const archer = makeArmedPlayer({ id: "arc", x: 20, y: 12, heldItem: "bow" });
    archer.inventory.slots[0] = { itemId: "bow", count: 1, prefixId: "blazing" };
    archer.inventory.slots[1] = { itemId: "arrow", count: 10 };
    const aMap = new Map([[archer.id, archer]]);
    const bear = cw.ecology.spawnEntity({ kind: "bear", x: 22.5, y: 12, homeRadius: 8, poiId: null, packId: null, packSlot: 0 });
    cw.stepPlayerAction({ player: archer, players: aMap, dt: 0.4, input: { moveX: 0, moveY: 0, attackQueued: false, bowDrawing: true, bowReleaseQueued: false, blockHeld: false, dodgeQueued: false } });
    cw.stepPlayerAction({ player: archer, players: aMap, dt: 0.05, input: { moveX: 0, moveY: 0, attackQueued: false, bowDrawing: false, bowReleaseQueued: true, blockHeld: false, dodgeQueued: false } });
    expect(cw.snapshots().projectiles[0]?.element).toBe("fire");
    for (let i = 0; i < 8; i++) cw.stepWorld({ players: aMap, dt: 0.05, dayPhase: 0.5, timeSec: i * 0.05 });
    expect(bear.burnTimer).toBeGreaterThan(0);

    const bleeder = makeArmedPlayer({ id: "bld", x: 20, y: 20, heldItem: "frost-hatchet" });
    const bMap = new Map([[bleeder.id, bleeder]]);
    const target = cw.ecology.spawnEntity({ kind: "bear", x: 21.1, y: 20, homeRadius: 8, poiId: null, packId: null, packSlot: 0 });
    target.facingX = -1;
    swingAndResolve({ cw, p: bleeder, map: bMap });
    cw.drainEvents();
    expect(target.bleedTimer).toBeGreaterThan(2.5);
    const hpAfterHit = target.hp;
    for (let i = 0; i < 24; i++) cw.stepWorld({ players: bMap, dt: 0.05, dayPhase: 0.5, timeSec: 2 + i * 0.05 });
    expect(target.hp).toBeLessThan(hpAfterHit);
    expect(cw.drainEvents().some((e) => e.kind === "hit" && e.goreStyle === "drip" && e.targetId === target.id)).toBe(true);
  });
});
