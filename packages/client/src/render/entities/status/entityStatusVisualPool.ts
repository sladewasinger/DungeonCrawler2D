import {
  statusVisualSeed,
  type StatusVisualRig,
} from "./statusVisualRig.js";
import {
  defaultStatusVisualBudget,
  type StatusVisualBudget,
} from "./statusVisualBudget.js";
import type {
  StatusCombatantView,
  StatusCombatantVisual,
  StatusVisualFrame,
} from "./statusVisualFrame.js";

export type StatusVisualRigFactory = (
  seed: number,
  budget: StatusVisualBudget,
) => StatusVisualRig;

export class EntityStatusVisualPool {
  private readonly active = new Map<string, StatusVisualRig>();
  private readonly spare: StatusVisualRig[] = [];
  private readonly seen = new Set<string>();
  private readonly frame: StatusVisualFrame = {
    groundScreenY: 0,
    nowMs: 0,
    burning: false,
    oiled: false,
    poisoned: false,
  };

  constructor(
    private readonly factory: StatusVisualRigFactory,
    private readonly budget = defaultStatusVisualBudget(),
  ) {}

  beginFrame(nowMs: number): void {
    this.seen.clear();
    this.frame.nowMs = nowMs;
  }

  syncEntity(
    id: string,
    visual: StatusCombatantVisual,
    view: StatusCombatantView,
  ): void {
    this.frame.burning = view.fx.includes("on-fire");
    this.frame.oiled = view.fx.includes("oiled");
    this.frame.poisoned = view.fx.includes("poisoned");
    if (view.hp <= 0 || !hasVisibleStatus(this.frame)) {
      this.releaseId(id);
      return;
    }
    this.seen.add(id);
    this.frame.groundScreenY = visual.shadow.y;
    const rig = this.rigFor(id);
    rig?.sync(visual.body, this.frame);
  }

  endFrame(): void {
    for (const id of this.active.keys()) {
      if (!this.seen.has(id)) this.releaseId(id);
    }
  }

  private rigFor(id: string): StatusVisualRig | null {
    const current = this.active.get(id);
    if (current) return current;
    if (this.active.size >= this.budget.maximumActiveRigs) return null;
    const seed = statusVisualSeed(id);
    const rig = this.spare.pop() ?? this.create(seed);
    rig.activate(seed);
    this.active.set(id, rig);
    return rig;
  }

  private create(seed: number): StatusVisualRig {
    return this.factory(seed, this.budget);
  }

  private releaseId(id: string): void {
    const rig = this.active.get(id);
    if (!rig) return;
    this.active.delete(id);
    rig.reset();
    if (this.spare.length < this.budget.maximumSpareRigs) {
      this.spare.push(rig);
      return;
    }
    rig.destroy();
  }

  dispose(): void {
    for (const rig of this.active.values()) rig.destroy();
    for (const rig of this.spare) rig.destroy();
    this.active.clear();
    this.spare.length = 0;
    this.seen.clear();
  }
}

function hasVisibleStatus(frame: StatusVisualFrame): boolean {
  return frame.burning || frame.oiled || frame.poisoned;
}
