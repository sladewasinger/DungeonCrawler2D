import Phaser from "phaser";

export class CombatParticles {
  constructor(private readonly scene: Phaser.Scene) {}

  launch(x: number, y: number, dx: number, dy: number): void {
    const particle = this.scene.add.graphics().setDepth(6);
    particle.fillStyle(0xd8ff52, 0.95).fillCircle(x, y, 5);
    particle.fillStyle(0x8dc52d, 0.85).fillCircle(x + dx * 8, y + dy * 8, 3);
    particle.lineStyle(2, 0xeaff87, 0.75).lineBetween(x, y, x + dx * 22, y + dy * 22);
    this.fade(particle, dx * 14, dy * 14, 120, 1.1);
  }

  impact(x: number, y: number, color: number, radius: number): void {
    const particle = this.scene.add.graphics().setDepth(49);
    particle.lineStyle(2, color, 0.9);
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + Math.PI / 8;
      particle.lineBetween(
        x + Math.cos(angle) * radius * 0.35,
        y + Math.sin(angle) * radius * 0.35,
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
      );
    }
    this.fade(particle, 0, 0, 180, 1.5);
  }

  status(x: number, y: number, color: number): void {
    const particle = this.scene.add.graphics().setDepth(49);
    particle.fillStyle(color, 0.85);
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + Math.PI / 6;
      particle.fillCircle(x + Math.cos(angle) * 10, y + Math.sin(angle) * 7, 3);
    }
    this.fade(particle, 0, -14, 240, 1.2);
  }

  private fade(
    particle: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    duration: number,
    scale: number,
  ): void {
    this.scene.tweens.add({
      targets: particle,
      x,
      y,
      alpha: 0,
      scale,
      duration,
      ease: "Quad.Out",
      onComplete: () => particle.destroy(),
    });
  }
}
