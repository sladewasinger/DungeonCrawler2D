// Combines the melee-swing wedge telegraph and its whiff arc-fade counter-cue
// (panel round 3b item 5) behind one object: both take the exact same geometry inputs
// (worldX/Y/z/angleRad/depth/tilePx), fired from two different trigger points (the swing
// starting vs. its correlation window elapsing with no connect — see meleeConnect.ts)
// but otherwise sharing one lifecycle, so VfxSystem's own facade only needs one field.
import type Phaser from "phaser";
import { MeleeWedgePool } from "./meleeWedge.js";
import { WhiffFadePool } from "./whiffFade.js";
import type { MeleeVfxInput } from "./vfxSystemTypes.js";

export class MeleeSwingFx {
  private readonly wedge: MeleeWedgePool;
  private readonly whiff: WhiffFadePool;

  constructor(scene: Phaser.Scene) {
    this.wedge = new MeleeWedgePool(scene);
    this.whiff = new WhiffFadePool(scene);
  }

  spawnSwing(input: MeleeVfxInput): void {
    this.wedge.spawn(input);
  }

  /** The whiff arc-fade — fired once a swing's correlation window elapses with no connect. */
  spawnWhiff(input: MeleeVfxInput): void {
    this.whiff.spawn(input);
  }

  update(nowMs: number): void {
    this.wedge.update(nowMs);
    this.whiff.update(nowMs);
  }

  dispose(): void {
    this.wedge.dispose();
    this.whiff.dispose();
  }
}
