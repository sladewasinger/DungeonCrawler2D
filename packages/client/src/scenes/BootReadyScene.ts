// Minimal post-boot placeholder: confirms the pixel font + atlas pipeline works until DungeonScene lands.
import Phaser from "phaser";
import { pixelTextStyle } from "../ui/font.js";

export class BootReadyScene extends Phaser.Scene {
  constructor() {
    super("boot-ready");
  }

  create(): void {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, "DC2D v2 — boot ready", pixelTextStyle(24))
      .setOrigin(0.5, 0.5);
  }
}
