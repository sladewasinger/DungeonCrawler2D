import { WorldChunkCache, GroundKind, MELEE_FEEL_TUNING, type WorldEvent } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { createCombatState, type CombatPlayerRef } from "../combatActions.js";
import { CombatWorld } from "../combatSim.js";
import { createStarterInventory } from "../playerInventory.js";

class FlatCache extends WorldChunkCache {
  override tileAt() { return { ground: GroundKind.Grass, elevation: 0, stairs: false }; }
  override propsNear() { return []; }
}

function makeFighter(opts: { readonly id: string; readonly x: number; readonly y: number; readonly heldItem?: string }): CombatPlayerRef {
  const baseInv = createStarterInventory();
  const inv = { ...baseInv, armor: { ...baseInv.armor, offhand: "wooden-shield" } };
  inv.slots[0] = { itemId: opts.heldItem ?? "sword", count: 1 };
  return {
    id: opts.id, x: opts.x, y: opts.y, elevation: 0, facingX: 1, facingY: 0, aimX: 1, aimY: 0,
    selectedHotbar: 0, crouching: false, inventory: inv, combat: createCombatState(),
  };
}

function stepCombat(opts: {
  readonly cw: CombatWorld; readonly p: CombatPlayerRef; readonly map: Map<string, CombatPlayerRef>;
  readonly steps: number; readonly attack?: boolean; readonly attackHold?: boolean; readonly dodge?: boolean;
}): void {
  for (let i = 0; i < opts.steps; i++) {
    opts.cw.stepPlayerAction({
      player: opts.p, players: opts.map, dt: 0.05,
      input: {
        moveX: 0, moveY: 0, attackQueued: Boolean(opts.attack && i === 0), attackHold: Boolean(opts.attackHold),
        bowDrawing: false, bowReleaseQueued: false, blockHeld: false, dodgeQueued: Boolean(opts.dodge && i === 0),
        dodgeDirX: opts.dodge ? -1 : undefined, dodgeDirY: 0,
      },
    });
    opts.cw.stepWorld({ players: opts.map, dt: 0.05, dayPhase: 0.5, timeSec: i * 0.05 });
  }
}

describe("3-phase melee timeline, dodge-cancel, input buffer, and heavy charge", () => {
  it("delays melee damage until windupEnd active window and lets early windup dodge-cancel abort cleanly", () => {
    const cw = new CombatWorld(new FlatCache(1337));
    const p = makeFighter({ id: "p1", x: 8.2, y: 0.5, heldItem: "iron-greatsword" });
    const map = new Map([[p.id, p]]);
    const dummy = cw.dummies.find((d) => d.id === "dummy-straw")!;
    const hpStart = dummy.hp;

    stepCombat({ cw, p, map, steps: 1, attack: true });
    expect(dummy.hp).toBe(hpStart);

    stepCombat({ cw, p, map, steps: 2, dodge: true });
    expect(p.combat.dodgeTimer).toBeGreaterThan(0);
    expect(p.combat.pendingSwing).toBeNull();
    stepCombat({ cw, p, map, steps: 10 });
    expect(dummy.hp).toBe(hpStart);

    p.x = 8.2; p.combat.dodgeCooldown = 0; p.combat.dodgeTimer = 0; p.combat.stamina = 100;
    stepCombat({ cw, p, map, steps: 1, attack: true });
    expect(dummy.hp).toBe(hpStart);
    stepCombat({ cw, p, map, steps: 6 });
    expect(dummy.hp).toBeLessThan(hpStart);
  });

  it("buffers an attack pressed late in recovery and triggers the next combo step automatically", () => {
    const cw = new CombatWorld(new FlatCache(1337));
    const p = makeFighter({ id: "p1", x: 8.2, y: 0.5 });
    const map = new Map([[p.id, p]]);

    stepCombat({ cw, p, map, steps: 3, attack: true });
    expect(p.combat.comboStep).toBe(1);
    stepCombat({ cw, p, map, steps: 1, attack: true });
    expect(p.combat.bufferedAction?.kind).toBe("attack");

    stepCombat({ cw, p, map, steps: 5 });
    expect(p.combat.comboStep).toBe(2);
    const swings = cw.drainEvents().filter((e: WorldEvent) => e.kind === "swing");
    expect(swings.map((s) => s.comboStep)).toEqual([1, 2]);
  });

  it("holds heavy melee charge past 0.24s, emits heavyCharge, deals 1.65x dmg, and guard-breaks blocking shields", () => {
    const cw = new CombatWorld(new FlatCache(1337));
    const p = makeFighter({ id: "p1", x: 18.2, y: 0.5 });
    const defender = makeFighter({ id: "p2", x: 19.4, y: 0.5 });
    defender.aimX = -1; defender.facingX = -1; defender.combat.blocking = true;
    const map = new Map([[p.id, p], [defender.id, defender]]);

    stepCombat({ cw, p, map, steps: 8, attack: true, attackHold: true });
    expect(p.combat.heavyCharge).toBeGreaterThanOrEqual(MELEE_FEEL_TUNING.heavyHoldMinSec / MELEE_FEEL_TUNING.heavyHoldMaxSec);
    expect(cw.drainEvents().some((e) => e.kind === "heavyCharge")).toBe(true);

    cw.stepPlayerAction({
      player: defender, players: map, dt: 0.05,
      input: { moveX: 0, moveY: 0, attackQueued: false, bowDrawing: false, bowReleaseQueued: false, blockHeld: true, dodgeQueued: false },
    });
    stepCombat({ cw, p, map, steps: 6, attackHold: false });

    const evs = cw.drainEvents();
    const gb = evs.find((e) => e.kind === "guardBreak" && e.actorId === "p2");
    expect(gb).toBeDefined();
    expect(gb?.value).toBeGreaterThan(0);
    expect(defender.combat.staggerTimer).toBeGreaterThan(0.3);
    expect(defender.combat.blocking).toBe(false);

    const runUnblocked = (heavy: boolean) => {
      const cw2 = new CombatWorld(new FlatCache(1337));
      const a2 = makeFighter({ id: "a2", x: 18.2, y: 0.5 });
      const t2 = makeFighter({ id: "t2", x: 19.4, y: 0.5 });
      const m2 = new Map([[a2.id, a2], [t2.id, t2]]);
      stepCombat({ cw: cw2, p: a2, map: m2, steps: 8, attack: true, attackHold: heavy });
      const midStam = a2.combat.stamina;
      if (heavy) stepCombat({ cw: cw2, p: a2, map: m2, steps: 6, attackHold: false });
      return { ev: cw2.drainEvents().find((e) => e.kind === "hit" && e.targetId === "t2" && (!heavy || e.heavy)), midStam };
    };
    const light = runUnblocked(false);
    const heavy = runUnblocked(true);
    expect(heavy.ev).toBeDefined();
    expect(heavy.ev?.value).toBeGreaterThan(Math.round((light.ev?.value ?? 0) * 1.4));
    expect(MELEE_FEEL_TUNING.heavyStaminaExtra).toBe(14);
    expect(100 - heavy.midStam).toBe(12 + MELEE_FEEL_TUNING.heavyStaminaExtra);
  });
});
