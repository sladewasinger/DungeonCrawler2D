import type { GameEvent, ServerSnapshot } from "@dc2d/engine";
import type { Connection } from "./connection.js";

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
    const snap = remote.snap;
    if (
      (snap.kind !== "player" && snap.kind !== "enemy") ||
      snap.hp === undefined
    ) continue;
    targets.set(id, {
      hp: snap.hp,
      x: snap.x,
      y: snap.y,
      ...(snap.defId === undefined ? {} : { defId: snap.defId }),
      targetKind: snap.kind,
    });
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
    if (
      (entity.kind !== "player" && entity.kind !== "enemy") ||
      entity.hp === undefined
    ) continue;
    targets.set(entity.id, {
      hp: entity.hp,
      x: entity.x,
      y: entity.y,
      ...(entity.defId === undefined ? {} : { defId: entity.defId }),
      targetKind: entity.kind,
    });
  }
  return targets;
}

/**
 * Reliable fallback for rolling deploys and missing combat packets: infer only damage
 * from authoritative HP transitions. Explicit wire events always win, so the normal
 * path never double-spawns blood or numbers.
 */
export function inferMissingDamageEvents(
  conn: Connection,
  snap: ServerSnapshot,
  before: CombatHealthFrame,
): void {
  if (
    !before.initialized ||
    snap.events.some((event) => event.t === "teleported")
  ) return;
  const explicit = explicitHealthTargetIds(snap.events);
  for (const [id, next] of snapshotCombatHealth(conn, snap)) {
    const previous = before.targets.get(id);
    if (!previous || next.hp >= previous.hp || explicit.has(id)) continue;
    conn.visualEvents.push({
      t: "health",
      id,
      delta: next.hp - previous.hp,
      kind: "damage",
      x: next.x,
      y: next.y,
      ...(next.defId === undefined ? {} : { defId: next.defId }),
      targetKind: next.targetKind,
    });
  }
}
