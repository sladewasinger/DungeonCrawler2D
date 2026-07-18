// Placeholder scene: renders "DC2D v2" so the client boot path is verifiable;
// replaced by real scene orchestration (docs/ARCHITECTURE.md's client/scenes) later.
import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, "DC2D v2", {
        fontFamily: "monospace",
        fontSize: "48px",
        color: "#e8e8e8",
      })
      .setOrigin(0.5, 0.5);
  }
}
