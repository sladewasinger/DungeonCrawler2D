import type { FireFieldRig } from "./fireFieldRig.js";
import type { FireFieldComponent } from "./fireFieldTopology.js";
import { fireTileOverlap } from "./fireFieldUnion.js";

export interface ActiveFireComponent {
  readonly rig: FireFieldRig;
  tileKeys: ReadonlySet<string>;
}

interface FireComponentTarget {
  readonly component: FireFieldComponent;
  readonly key: string;
  readonly tileKeys: ReadonlySet<string>;
}

export interface FireReconciliationInput {
  readonly components: readonly FireFieldComponent[];
  readonly maximumComponents: number;
  readonly particleDepth: number;
  readonly active: ReadonlyMap<string, ActiveFireComponent>;
  readonly acquireRig: () => FireFieldRig;
  readonly releaseRig: (rig: FireFieldRig) => void;
}

export function reconcileFireComponents(
  input: FireReconciliationInput,
): Map<string, ActiveFireComponent> {
  const targets = componentTargets(input.components, input.maximumComponents);
  const claimed = new Set<ActiveFireComponent>();
  const candidates = [...input.active.values()];
  const plans = targets.map((target) => {
    const active = bestOverlap(target, candidates, claimed);
    if (active) claimed.add(active);
    return { active, target };
  });
  releaseUnclaimed(input, claimed);
  const next = new Map<string, ActiveFireComponent>();
  for (const plan of plans) {
    const active = syncTarget(input, plan);
    next.set(plan.target.key, active);
  }
  return next;
}

function syncTarget(
  input: FireReconciliationInput,
  plan: {
    readonly active: ActiveFireComponent | undefined;
    readonly target: FireComponentTarget;
  },
): ActiveFireComponent {
  const { target } = plan;
  const active: ActiveFireComponent = plan.active ?? {
    rig: input.acquireRig(),
    tileKeys: target.tileKeys,
  };
  active.tileKeys = target.tileKeys;
  const placement = {
    component: target.component,
    particleDepth: input.particleDepth,
  };
  if (plan.active) active.rig.retarget(placement);
  else active.rig.activate(placement);
  return active;
}

function componentTargets(
  components: readonly FireFieldComponent[],
  maximumComponents: number,
): FireComponentTarget[] {
  const targets: FireComponentTarget[] = [];
  const limit = Math.min(components.length, maximumComponents);
  for (let index = 0; index < limit; index++) {
    const component = components[index];
    if (!component) continue;
    targets.push({
      component,
      key: component.signature,
      tileKeys: new Set(component.tiles.map(({ x, y }) => `${x},${y}`)),
    });
  }
  return targets;
}

function bestOverlap(
  target: FireComponentTarget,
  candidates: readonly ActiveFireComponent[],
  claimed: ReadonlySet<ActiveFireComponent>,
): ActiveFireComponent | undefined {
  let best: ActiveFireComponent | undefined;
  let bestOverlap = 0;
  for (const candidate of candidates) {
    if (claimed.has(candidate)) continue;
    const overlap = fireTileOverlap(target.tileKeys, candidate.tileKeys);
    if (overlap <= bestOverlap) continue;
    best = candidate;
    bestOverlap = overlap;
  }
  return best;
}

function releaseUnclaimed(
  input: FireReconciliationInput,
  claimed: ReadonlySet<ActiveFireComponent>,
): void {
  for (const active of input.active.values()) {
    if (claimed.has(active)) continue;
    input.releaseRig(active.rig);
  }
}
