import type { AdminDebugPoint } from "../../../render/debug/adminDebugGeometry.js";

export interface ThreeDebugPrimitiveWriter {
  line(
    points: readonly AdminDebugPoint[],
    color: number,
    lift?: number,
  ): void;
  behaviorLabel(
    id: string,
    text: string,
    point: AdminDebugPoint,
  ): void;
}
