import type { AdminDebugPoint } from "../../../render/debug/adminDebugGeometry.js";
import * as THREE from "three";
import { ThreeDebugLabelPool } from "./ThreeDebugLabelPool.js";
import { ThreeDebugLinePool } from "./ThreeDebugLinePool.js";
import type { ThreeDebugPrimitiveWriter } from "./threeDebugPrimitives.js";

const MAX_DEBUG_LINES = 2048;
const MAX_DEBUG_LABELS = 256;

type ThreeGroup = InstanceType<typeof THREE.Group>;

export class ThreeDebugOverlayPool implements ThreeDebugPrimitiveWriter {
  private readonly lines: ThreeDebugLinePool;
  private readonly labels: ThreeDebugLabelPool;

  constructor(group: ThreeGroup) {
    this.lines = new ThreeDebugLinePool(group, MAX_DEBUG_LINES);
    this.labels = new ThreeDebugLabelPool(group, MAX_DEBUG_LABELS);
  }

  beginFrame(): void {
    this.lines.beginFrame();
    this.labels.beginFrame();
  }

  line(points: readonly AdminDebugPoint[], color: number, lift?: number): void {
    this.lines.line(points, color, lift);
  }

  behaviorLabel(id: string, text: string, point: AdminDebugPoint): void {
    this.labels.label(id, text, point);
  }

  endFrame(): void {
    this.lines.endFrame();
    this.labels.endFrame();
  }

  clear(): void {
    this.beginFrame();
    this.endFrame();
  }

  dispose(): void {
    this.lines.dispose();
    this.labels.dispose();
  }
}
