import type Phaser from "phaser";
import type { InputController } from "../../../input/index.js";
import type { Connection } from "../../../net/connection/connection.js";
import { FistbumpRing } from "./fistbumpRing.js";
import { syncFistbumpRing } from "./fistbumpRingSync.js";
import { syncReviveIndicator } from "./revive/reviveIndicatorSync.js";
import type { ThrowArcPoint } from "./throw/throwTrajectoryGeometry.js";
import { ThrowTrajectoryPreview } from "./throw/throwTrajectoryPreview.js";

/** Owns the pooled world-space visuals driven directly by held input gestures. */
export class InputGestureVisuals {
  private readonly fistbump: FistbumpRing;
  private readonly revive: FistbumpRing;
  private readonly throwTrajectory: ThrowTrajectoryPreview;

  constructor(scene: Phaser.Scene) {
    this.fistbump = new FistbumpRing(scene);
    this.revive = new FistbumpRing(scene);
    this.throwTrajectory = new ThrowTrajectoryPreview(scene);
  }

  syncFistbump(input: InputController, conn: Connection): void {
    syncFistbumpRing(this.fistbump, input, conn);
  }

  syncRevive(input: InputController, conn: Connection): void {
    syncReviveIndicator(this.revive, input, conn);
  }

  syncThrow(
    input: InputController,
    conn: Connection,
    origin: ThrowArcPoint,
  ): void {
    if (!conn.world) {
      this.throwTrajectory.hide();
      return;
    }
    this.throwTrajectory.sync({
      preview: input.throwPreview(),
      origin,
      world: conn.world,
    });
  }

  hide(): void {
    this.fistbump.update(null);
    this.revive.update(null);
    this.throwTrajectory.hide();
  }

  dispose(): void {
    this.fistbump.dispose();
    this.revive.dispose();
    this.throwTrajectory.dispose();
  }
}
