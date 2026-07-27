import { resolveHitAgainstPending } from "../../vfx/meleeConnect.js";
import type { VisualEventContext } from "./visualEvents.js";

export interface CapturedTarget {
  readonly id: string;
  readonly x?: number | undefined;
  readonly y?: number | undefined;
  readonly defId?: string | undefined;
  readonly targetKind?: "player" | "enemy" | undefined;
}

export function resolveVisualTarget(context: VisualEventContext, captured: CapturedTarget) {
  const isSelf = captured.id === context.selfId;
  const snapshot = isSelf ? undefined : context.conn.entities.get(captured.id)?.snap;
  return {
    isSelf,
    position: isSelf ? context.render : capturedPosition(captured) ?? snapshot,
    defId: captured.defId ?? snapshot?.defId,
    direction: selfKnockback(context, isSelf),
  };
}

export function applyDamageImpact(context: VisualEventContext, event: CapturedTarget): void {
  const target = resolveVisualTarget(context, event);
  if (target.position && context.conn.world) {
    context.vfx.spawnBloodHit({
      x: target.position.x,
      y: target.position.y,
      groundHeight: context.conn.world.groundAt(target.position.x, target.position.y),
      defId: target.defId,
      nowMs: context.nowMs,
      direction: target.direction,
    });
    resolveHitAgainstPending(context.pendingSwings, target.position.x, target.position.y);
  }
  if (target.isSelf) context.vfx.onOwnHit(context.nowMs);
}

function capturedPosition(captured: CapturedTarget) {
  if (captured.x === undefined || captured.y === undefined) return undefined;
  return { x: captured.x, y: captured.y };
}

function selfKnockback(context: VisualEventContext, isSelf: boolean) {
  if (!isSelf || !context.conn.body) return undefined;
  return { x: context.conn.body.kx, y: context.conn.body.ky };
}
