import {
  AOI_RADIUS,
  type Entity,
  type EntitySnapshot,
  type GameEvent,
  type ServerSnapshot,
} from "@dc2d/engine";
import type { SimState } from "./state";

/** AOI-scoped per-player snapshots: entities, events, and area deltas. */

export function buildSnapshots(sim: SimState): Map<string, ServerSnapshot> {
  const snapshots = new Map<string, ServerSnapshot>();
  const areaDirty = sim.areas.drainDirty();
  const worldEvents = sim.worldEvents;
  sim.worldEvents = [];

  for (const slot of sim.players.values()) {
    if (!slot.connected) {
      slot.outbox.length = 0;
      continue;
    }
    const self = slot.entity;
    const inAoi = (x: number, y: number) =>
      (x - self.body.x) ** 2 + (y - self.body.y) ** 2 <= AOI_RADIUS * AOI_RADIUS;

    const entities: EntitySnapshot[] = [];
    const visible = new Set<string>();
    const consider = (entity: Entity) => {
      if (entity.id === self.id) return;
      if (!inAoi(entity.body.x, entity.body.y)) return;
      visible.add(entity.id);
      const enemyAnimation = entity.kind === "enemy" ? sim.enemies.get(entity.id)!.animation : null;
      const aim = enemyAnimation?.target
        ? (() => {
            const dx = enemyAnimation.target!.x - entity.body.x;
            const dy = enemyAnimation.target!.y - entity.body.y;
            const distance = Math.hypot(dx, dy) || 1;
            return { x: dx / distance, y: dy / distance };
          })()
        : null;
      entities.push({
        id: entity.id,
        kind: entity.kind,
        ...(entity.defId !== undefined ? { defId: entity.defId } : {}),
        ...(entity.name !== undefined ? { name: entity.name } : {}),
        x: entity.body.x,
        y: entity.body.y,
        z: entity.body.z,
        ...(entity.kind === "player" || entity.kind === "enemy"
          ? {
              hp: entity.hp,
              maxHp: entity.maxHp,
              fx: entity.statuses.map((s) => s.defId),
            }
          : {}),
        ...(entity.kind === "item" && entity.qty > 1 ? { qty: entity.qty } : {}),
        ...(enemyAnimation
          ? {
              anim: enemyAnimation.state,
              ...(aim ? { aimX: aim.x, aimY: aim.y } : {}),
            }
          : {}),
        ...(entity.kind === "player" && sim.players.get(entity.id)?.downedAtTick !== null
          ? { downed: true }
          : {}),
        // Projectiles never touch body.grounded; everyone else is
        // airborne only mid-jump/mid-fall.
        ...(entity.kind === "projectile" || !entity.body.grounded ? { air: true as const } : {}),
      });
    };
    for (const other of sim.players.values()) if (other.entity.hp >= 0) consider(other.entity);
    for (const enemy of sim.enemies.values()) consider(enemy.entity);
    for (const item of sim.items.values()) consider(item);
    for (const projectile of sim.projectiles.values()) consider(projectile);

    const left: string[] = [];
    for (const id of slot.known) if (!visible.has(id)) left.push(id);
    slot.known = visible;

    const events: GameEvent[] = [...slot.outbox];
    slot.outbox.length = 0;
    for (const we of worldEvents) if (inAoi(we.x, we.y)) events.push(we.ev);

    let areas = areaDirty.filter((a) => inAoi(a.x, a.y));
    if (slot.needsFullAreas) {
      slot.needsFullAreas = false;
      areas = sim.areas.allTiles().filter((a) => inAoi(a.x, a.y));
    }

    const party = slot.partyId ? sim.parties.get(slot.partyId) : undefined;

    snapshots.set(self.id, {
      type: "snapshot",
      tick: sim.tickCount,
      lastSeq: slot.lastSeq,
      self: {
        x: self.body.x,
        y: self.body.y,
        z: self.body.z,
        zVel: self.body.zVel,
        grounded: self.body.grounded,
        coyoteTime: self.body.coyoteTime,
        kx: self.body.kx,
        ky: self.body.ky,
        hp: self.hp,
        maxHp: self.maxHp,
        fx: self.statuses.map((s) => s.defId),
        ...(slot.downedAtTick !== null ? { downed: true } : {}),
      },
      inventory: slot.inventory.map((s) => ({ ...s })),
      hotbar: [...slot.hotbar],
      weapon: slot.weapon,
      party: party
        ? {
            id: party.id,
            members: [...party.members]
              .filter((m) => m !== self.id)
              .map((m) => {
                const member = sim.players.get(m)!;
                return {
                  id: m,
                  name: member.entity.name ?? "?",
                  x: member.entity.body.x,
                  y: member.entity.body.y,
                };
              }),
          }
        : null,
      entities,
      left,
      events,
      areas,
    });
  }
  return snapshots;
}
