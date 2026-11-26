/** Deterministic headless simulation harness wrapping WorldSim for multi-tick & reboot testing. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ArmorSlotKey, CharacterAppearance, DropItemRequest } from "@dc2d/engine";
import { hashResumeToken } from "../net/playerAuth.js";
import { TICK_RATE, WorldSim, type SimPlayer } from "../sim/worldSim.js";

export interface ScenarioPlayerHandle {
  readonly id: string;
  readonly name: string;
  readonly accountId: string;
  readonly resumeToken: string;
}

export type ScenarioInput = Omit<Parameters<WorldSim["queueInput"]>[1], "seq">;

export type ScenarioAction =
  | { readonly t: "selectHotbar"; readonly slot: number }
  | { readonly t: "useItem"; readonly slotIndex: number }
  | { readonly t: "equipArmor"; readonly slotIndex: number; readonly targetArmor?: ArmorSlotKey | undefined }
  | { readonly t: "unequipArmor"; readonly armorSlot: ArmorSlotKey; readonly targetSlot?: number | undefined }
  | { readonly t: "craft"; readonly recipeId: string }
  | { readonly t: "placeStructure"; readonly itemId: string; readonly x: number; readonly y: number }
  | { readonly t: "setRespawnBed"; readonly structureId: string }
  | { readonly t: "pickupLoot"; readonly lootId?: string | undefined }
  | { readonly t: "dropItem"; readonly req: DropItemRequest }
  | { readonly t: "toggleTorch" };

interface TrackedPlayer {
  id: string;
  readonly name: string;
  readonly accountId: string;
  readonly resumeToken: string;
  readonly appearance?: CharacterAppearance | undefined;
  nextSeq: number;
}

interface ScenarioConfig {
  readonly seed: number;
  readonly persistencePath: string;
  readonly ownedTempDir: string | null;
  readonly dayPaused: boolean;
}

function resolveCreateConfig(opts: {
  readonly seed?: number | undefined;
  readonly dayPaused?: boolean | undefined;
  readonly persistencePath?: string | undefined;
} = {}): ScenarioConfig {
  const ownedTempDir = opts.persistencePath ? null : mkdtempSync(join(tmpdir(), "dc2d-sim-"));
  const persistencePath = opts.persistencePath ?? join(ownedTempDir!, "world-save.json");
  return {
    seed: opts.seed ?? 1337,
    persistencePath,
    ownedTempDir,
    dayPaused: opts.dayPaused ?? true,
  };
}

export class SimScenario {
  readonly seed: number;
  readonly persistencePath: string;
  private readonly ownedTempDir: string | null;
  readonly sim: WorldSim;
  private readonly tracked: TrackedPlayer[] = [];

  private constructor(opts: ScenarioConfig) {
    this.seed = opts.seed;
    this.persistencePath = opts.persistencePath;
    this.ownedTempDir = opts.ownedTempDir;
    this.sim = new WorldSim(opts.seed, { persistencePath: opts.persistencePath });
    this.sim.dayPaused = opts.dayPaused;
  }

  static create(opts?: {
    readonly seed?: number | undefined;
    readonly dayPaused?: boolean | undefined;
    readonly persistencePath?: string | undefined;
  }): SimScenario {
    return new SimScenario(resolveCreateConfig(opts));
  }

  joinPlayer(opts: {
    readonly name: string;
    readonly accountId?: string | undefined;
    readonly resumeToken?: string | undefined;
    readonly appearance?: CharacterAppearance | undefined;
  }): ScenarioPlayerHandle {
    const auth = this.sim.authenticateSession({ accountId: opts.accountId, resumeToken: opts.resumeToken });
    const issuedToken = auth.issuedCredentials?.resumeToken ?? opts.resumeToken ?? "scenario-fallback-token-01";
    const id = this.sim.addPlayer(opts.name, opts.appearance, {
      accountId: auth.accountId,
      tokenHash: hashResumeToken(issuedToken),
    });
    this.tracked.push({
      id, name: opts.name, accountId: auth.accountId, resumeToken: issuedToken, appearance: opts.appearance, nextSeq: 1,
    });
    return { id, name: opts.name, accountId: auth.accountId, resumeToken: issuedToken };
  }

  sendInput(playerId: string, input: ScenarioInput): this {
    const t = this.tracked.find((p) => p.id === playerId);
    const seq = t ? t.nextSeq++ : 1;
    this.sim.queueInput(playerId, { ...input, seq });
    return this;
  }

  sendAction(playerId: string, action: ScenarioAction): boolean {
    return dispatchScenarioAction(this.sim, playerId, action);
  }

  tick(count = 1, dtSeconds = 1 / TICK_RATE): this {
    for (let i = 0; i < count; i++) this.sim.step(dtSeconds);
    return this;
  }

  stepSeconds(seconds: number): this {
    return this.tick(Math.max(1, Math.round(seconds * TICK_RATE)), 1 / TICK_RATE);
  }

  getPlayer(playerId: string): SimPlayer | undefined {
    return this.sim.getPlayer(playerId);
  }

  getWorld(): WorldSim {
    return this.sim;
  }

  rebootFromPersistence(): { readonly scenario: SimScenario; readonly handles: readonly ScenarioPlayerHandle[] } {
    this.sim.savePersistenceNow();
    const next = new SimScenario({
      seed: this.seed,
      persistencePath: this.persistencePath,
      ownedTempDir: this.ownedTempDir,
      dayPaused: this.sim.dayPaused,
    });
    const handles = this.tracked.map((t) => next.joinPlayer({
      name: t.name, accountId: t.accountId, resumeToken: t.resumeToken, appearance: t.appearance,
    }));
    return { scenario: next, handles };
  }

  dispose(): void {
    if (this.ownedTempDir) rmSync(this.ownedTempDir, { recursive: true, force: true });
  }
}

const ACTION_HANDLERS: Readonly<Record<ScenarioAction["t"], (sim: WorldSim, playerId: string, action: never) => boolean>> = {
  selectHotbar: (sim, id, a: Extract<ScenarioAction, { t: "selectHotbar" }>) => { sim.selectHotbar(id, a.slot); return true; },
  useItem: (sim, id, a: Extract<ScenarioAction, { t: "useItem" }>) => { sim.useItem(id, a.slotIndex); return true; },
  equipArmor: (sim, id, a: Extract<ScenarioAction, { t: "equipArmor" }>) => { sim.equipArmor(id, { slotIndex: a.slotIndex, targetArmor: a.targetArmor }); return true; },
  unequipArmor: (sim, id, a: Extract<ScenarioAction, { t: "unequipArmor" }>) => { sim.unequipArmor(id, { armorSlot: a.armorSlot, targetSlot: a.targetSlot }); return true; },
  craft: (sim, id, a: Extract<ScenarioAction, { t: "craft" }>) => sim.craftRecipe(id, a.recipeId),
  placeStructure: (sim, id, a: Extract<ScenarioAction, { t: "placeStructure" }>) => sim.placeStructure(id, { itemId: a.itemId, x: a.x, y: a.y }),
  setRespawnBed: (sim, id, a: Extract<ScenarioAction, { t: "setRespawnBed" }>) => sim.setRespawnBed(id, a.structureId),
  pickupLoot: (sim, id, a: Extract<ScenarioAction, { t: "pickupLoot" }>) => { sim.pickupLoot(id, a.lootId); return true; },
  dropItem: (sim, id, a: Extract<ScenarioAction, { t: "dropItem" }>) => { sim.dropItem(id, a.req); return true; },
  toggleTorch: (sim, id) => { sim.toggleTorch(id); return true; },
};

function dispatchScenarioAction(sim: WorldSim, playerId: string, action: ScenarioAction): boolean {
  return ACTION_HANDLERS[action.t](sim, playerId, action as never);
}
