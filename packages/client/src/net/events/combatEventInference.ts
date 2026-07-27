import type { GameEvent, ServerSnapshot } from "@dc2d/engine";
import type { Connection } from "../connection/connection.js";

interface CombatHealthTarget {
  hp: number;
  x: number;
  y: number;
  defId?: string;
  targetKind: "player" | "enemy";
}

export interface CombatHealthFrame {
  initialized: boolean;
  targets: Map<string, CombatHealthTarget>;
}

function remoteCombatHealth(conn: Connection): Map<string, CombatHealthTarget> {
  const targets = new Map<string, CombatHealthTarget>();
  for (const [id, remote] of conn.entities) {
    const target = combatHealthTarget(remote.snap);
    if (target) targets.set(id, target);
  }
  return targets;
}

export function captureCombatHealth(conn: Connection): CombatHealthFrame {
  const targets = remoteCombatHealth(conn);
  const selfId = conn.welcome?.playerId;
  if (selfId && conn.body) {
    targets.set(selfId, {
      hp: conn.hp,
      x: conn.body.x,
      y: conn.body.y,
      targetKind: "player",
    });
  }
  return { initialized: conn.hasReceivedSnapshot, targets };
}

function explicitHealthTargetIds(events: readonly GameEvent[]): Set<string> {
  return new Set(events.flatMap((event) =>
    event.t === "health" || event.t === "hit" ? [event.id] : []
  ));
}

function explicitImpactTargetIds(events: readonly GameEvent[]): Set<string> {
  return new Set(events.flatMap((event) =>
    event.t === "damageImpact" || event.t === "hit" ? [event.id] : []
  ));
}

function snapshotCombatHealth(
  conn: Connection,
  snap: ServerSnapshot,
): Map<string, CombatHealthTarget> {
  const targets = new Map<string, CombatHealthTarget>();
  const selfId = conn.welcome?.playerId;
  if (selfId) {
    targets.set(selfId, {
      hp: snap.self.hp,
      x: snap.self.x,
      y: snap.self.y,
      targetKind: "player",
    });
  }
  for (const entity of snap.entities) {
    const target = combatHealthTarget(entity);
    if (target) targets.set(entity.id, target);
  }
  return targets;
}

/**
 * Reliable fallback for rolling deploys and missing combat packets: infer damage
 * feedback and impact presentation independently from authoritative HP transitions.
 * Each explicit wire event suppresses only its own concern, so an old server that
 * sends health without damageImpact still produces blood without duplicating numbers.
 */
export function inferMissingDamageEvents(
  conn: Connection,
  snap: ServerSnapshot,
  before: CombatHealthFrame,
): void {
  if (!canInferDamage(before, snap)) return;
  const explicitHealth = explicitHealthTargetIds(snap.events);
  const explicitImpacts = explicitImpactTargetIds(snap.events);
  for (const [id, next] of snapshotCombatHealth(conn, snap)) {
    const previous = before.targets.get(id);
    if (!previous || next.hp >= previous.hp) continue;
    const captured = capturedTarget(id, next);
    inferHealthEvent({ conn, explicit: explicitHealth, target: captured, before: previous, next });
    inferImpactEvent({ conn, explicit: explicitImpacts, target: captured, before: previous, next });
  }
}

function combatHealthTarget(snapshot: ServerSnapshot["entities"][number]): CombatHealthTarget | undefined {
  if ((snapshot.kind !== "player" && snapshot.kind !== "enemy") || snapshot.hp === undefined) return undefined;
  return { hp: snapshot.hp, x: snapshot.x, y: snapshot.y, ...(snapshot.defId === undefined ? {} : { defId: snapshot.defId }), targetKind: snapshot.kind };
}

function canInferDamage(before: CombatHealthFrame, snap: ServerSnapshot): boolean {
  return before.initialized && !snap.events.some((event) => event.t === "teleported");
}

function capturedTarget(id: string, next: CombatHealthTarget) {
  return { id, x: next.x, y: next.y, ...(next.defId === undefined ? {} : { defId: next.defId }), targetKind: next.targetKind };
}

interface InferredEventInput {
  readonly conn: Connection;
  readonly explicit: Set<string>;
  readonly target: ReturnType<typeof capturedTarget>;
  readonly before: CombatHealthTarget;
  readonly next: CombatHealthTarget;
}

function inferHealthEvent({ conn, explicit, target, before, next }: InferredEventInput): void {
  if (!explicit.has(target.id)) conn.visualEvents.push({ t: "health", delta: next.hp - before.hp, kind: "damage", ...target });
}

function inferImpactEvent({ conn, explicit, target, before, next }: InferredEventInput): void {
  if (!explicit.has(target.id)) conn.visualEvents.push({ t: "damageImpact", amount: before.hp - next.hp, ...target });
}
