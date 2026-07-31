import type { DinoBehaviorVisual } from "../types.js";

const CHASE_PERIOD_MS = 820;
const CHASE_RADIUS_X_PX = 7;
const CHASE_RADIUS_Y_PX = 3;

export function createDouxBehaviorVisual(): DinoBehaviorVisual {
  let lastEvent = 0;
  let startedAtMs: number | undefined;
  return {
    sync(input): void {
      if (input.view.petBehaviorEvent !== lastEvent) {
        lastEvent = input.view.petBehaviorEvent;
        startedAtMs = input.nowMs;
      }
      if (input.view.petBehavior !== "tail_chase") {
        startedAtMs = undefined;
        input.body.setAngle(0);
        return;
      }
      const start = startedAtMs ?? input.nowMs;
      startedAtMs = start;
      const offset = tailChaseOffset(input.nowMs - start);
      input.body.setPosition(input.body.x + offset.x, input.body.y + offset.y);
      input.body.setAngle(offset.angle);
    },
    destroy: () => undefined,
  };
}

export function tailChaseOffset(elapsedMs: number): {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
} {
  const phase = ((elapsedMs % CHASE_PERIOD_MS) / CHASE_PERIOD_MS) * Math.PI * 2;
  return {
    x: Math.cos(phase) * CHASE_RADIUS_X_PX,
    y: Math.sin(phase) * CHASE_RADIUS_Y_PX,
    angle: Math.sin(phase) * 8,
  };
}
