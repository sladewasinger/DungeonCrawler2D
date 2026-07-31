import type { AdminMapEntity, DebugFlags } from "@dc2d/engine";
import * as THREE from "three";
import { addThreeEntityDebug } from "./threeDebugDrawing.js";
import { ThreeDebugOverlayPool } from "./ThreeDebugOverlayPool.js";

/** Private diagnostic geometry for the active admin's first-person world. */
export class ThreeAdminDebugOverlay {
  private readonly group = new THREE.Group();
  private readonly pool: ThreeDebugOverlayPool;
  private revision = "";

  constructor(scene: InstanceType<typeof THREE.Scene>) {
    scene.add(this.group);
    this.pool = new ThreeDebugOverlayPool(this.group);
  }

  update(input: ThreeDebugOverlayInput): void {
    const revision = overlayRevision(input);
    if (revision === this.revision) return;
    this.revision = revision;
    if (!input.active || !hasEnabledFlag(input.flags)) return this.pool.clear();
    this.pool.beginFrame();
    for (const entity of input.entities) addThreeEntityDebug(this.pool, input.flags, entity);
    this.pool.endFrame();
  }

  dispose(): void {
    this.pool.dispose();
    this.group.removeFromParent();
  }
}

interface ThreeDebugOverlayInput {
  readonly active: boolean;
  readonly flags: DebugFlags;
  readonly entities: readonly AdminMapEntity[];
  readonly tick: number;
}

function overlayRevision(input: ThreeDebugOverlayInput): string {
  return `${input.active}:${input.tick}:${Object.values(input.flags).join("")}`;
}

function hasEnabledFlag(flags: DebugFlags): boolean {
  return Object.values(flags).some(Boolean);
}
