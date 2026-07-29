import type { Entity } from "../../entities/entity.js";
import type { EffectEvent } from "../events.js";
import type { EffectTarget, HealthChange } from "../health.js";
import type { Primitive } from "../types.js";
import type { StatusApplication, StatusRemoval } from "../resolve.js";

export interface PrimitiveExecution {
  readonly entity: Entity;
  readonly primitive: Primitive;
  readonly events: EffectEvent[];
  readonly target: EffectTarget;
  readonly rng: () => number;
  readonly sourceTags?: readonly string[] | undefined;
  readonly sourceId?: string;
}

export interface PrimitiveCallbacks {
  readonly modifyHealth: (change: HealthChange) => number;
  readonly applyStatus: (change: StatusApplication) => boolean;
  readonly removeStatusesByTag: (removal: StatusRemoval) => void;
}

export function executePrimitive(execution: PrimitiveExecution, callbacks: PrimitiveCallbacks): void {
  const { entity, primitive, events } = execution;
  switch (primitive.primitive) {
    case "modify_health":
      callbacks.modifyHealth(healthChange(execution, primitive.amount));
      break;
    case "apply_status":
      applyStatus({ execution, callbacks, statusId: primitive.status, chance: primitive.chance });
      break;
    case "remove_status":
      callbacks.removeStatusesByTag({ entity, tag: primitive.tag, events });
      break;
    case "spawn_area":
      events.push({
        t: "spawnArea",
        x: Math.floor(entity.body.x),
        y: Math.floor(entity.body.y),
        area: primitive.area,
        radius: primitive.radius,
        ...(execution.sourceId === undefined ? {} : { sourceId: execution.sourceId }),
      });
      break;
    case "destroy_entity":
      events.push({ t: "destroy", id: entity.id });
      break;
    case "modify_stat":
      break;
  }
}

function healthChange(execution: PrimitiveExecution, amount: number): HealthChange {
  const { entity, events, sourceTags, sourceId, target } = execution;
  const opts = {
    ...(sourceTags ? { sourceTags } : {}),
    ...(sourceId === undefined ? {} : { sourceId }),
  };
  return { entity, amount, events, opts, target };
}

interface StatusExecution {
  readonly execution: PrimitiveExecution;
  readonly callbacks: PrimitiveCallbacks;
  readonly statusId: string;
  readonly chance: number | undefined;
}

function applyStatus(request: StatusExecution): void {
  const { execution, callbacks, statusId, chance } = request;
  const { entity, events, sourceId, target, rng } = execution;
  if (chance === undefined || rng() < chance) {
    callbacks.applyStatus({
      entity,
      statusId,
      events,
      target,
      ...(sourceId === undefined ? {} : { sourceId }),
    });
  }
}
