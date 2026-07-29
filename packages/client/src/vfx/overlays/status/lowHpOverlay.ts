// Low-HP vignette overlay: a red-tinted full-screen frame whose alpha throbs at
// heartbeat tempo (lowHpVignette.ts's pure curve) once self hp drops below 30%.
// A soft-edged frame, not a flat rectangle — four edge-anchored bars read as a
// vignette closing in, rather than a flat color wash over the whole screen.
import type Phaser from "phaser";

const VIGNETTE_COLOR = 0xe04a4a;
const DEPTH = 480_000;
/** Each edge bar's thickness as a fraction of the shorter viewport axis. */
const EDGE_FRACTION = 0.14;

export class LowHpOverlay {
  private readonly edges: Phaser.GameObjects.Rectangle[];

  constructor(private readonly scene: Phaser.Scene) {
    // Fill alpha 1 (opaque red), fully transparent, only the GameObject-level alpha
    // update() drives below controls visibility — a Rectangle's rendered opacity is
    // fillAlpha * object.alpha, so a 0 fillAlpha here would make every later
    // setAlpha() a no-op (the bug this comment replaced: the vignette never showed).
    this.edges = [0, 1, 2, 3].map(() =>
      scene.add.rectangle(0, 0, 0, 0, VIGNETTE_COLOR, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH).setAlpha(0),
    );
    this.resize(scene.scale.width, scene.scale.height);
  }

  /** Sets every edge bar's alpha for this frame (0 hides them entirely). Re-fits the
   * geometry to the current viewport every call — cheap, and needs no external
   * resize hook since a live window resize is otherwise invisible to this system. */
  update(alpha: number): void {
    this.resize(this.scene.scale.width, this.scene.scale.height);
    for (const edge of this.edges) edge.setAlpha(alpha);
  }

  private resize(width: number, height: number): void {
    const thickness = Math.round(Math.min(width, height) * EDGE_FRACTION);
    const [top, bottom, left, right] = this.edges as [
      Phaser.GameObjects.Rectangle,
      Phaser.GameObjects.Rectangle,
      Phaser.GameObjects.Rectangle,
      Phaser.GameObjects.Rectangle,
    ];
    top.setPosition(0, 0).setSize(width, thickness);
    bottom.setPosition(0, height - thickness).setSize(width, thickness);
    left.setPosition(0, 0).setSize(thickness, height);
    right.setPosition(width - thickness, 0).setSize(thickness, height);
  }

  dispose(): void {
    for (const edge of this.edges) edge.destroy();
  }
}
