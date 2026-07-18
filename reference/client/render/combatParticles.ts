import Phaser from "phaser";

export class CombatParticles {
  private readonly active = new Set<Phaser.GameObjects.Graphics>();

  constructor(private readonly scene: Phaser.Scene) {}

  launch(x: number, y: number, dx: number, dy: number, depth = 4.1): void {
    const particle = this.create(depth);
    if (!particle) return;
    particle.fillStyle(0xd8ff52, 0.95).fillCircle(x, y, 5);
    particle.fillStyle(0x8dc52d, 0.85).fillCircle(x + dx * 8, y + dy * 8, 3);
    particle.lineStyle(2, 0xeaff87, 0.75).lineBetween(x, y, x + dx * 22, y + dy * 22);
    this.fade(particle, dx * 14, dy * 14, 120, 1.1);
  }

  impact(x: number, y: number, color: number, radius: number, depth = 4.2): void {
    const particle = this.create(depth);
    if (!particle) return;
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

  status(x: number, y: number, color: number, depth = 4.2): void {
    const particle = this.create(depth);
    if (!particle) return;
    particle.fillStyle(color, 0.85);
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + Math.PI / 6;
      particle.fillCircle(x + Math.cos(angle) * 10, y + Math.sin(angle) * 7, 3);
    }
    this.fade(particle, 0, -14, 240, 1.2);
  }

  takeoff(x: number, y: number, depth: number): void {
    const particle = this.create(depth);
    if (!particle) return;
    particle.lineStyle(2, 0xc6b992, 0.55).strokeEllipse(x, y, 20, 8);
    this.fade(particle, 0, 2, 120, 1.35);
  }

  landing(x: number, y: number, depth: number): void {
    const particle = this.create(depth);
    if (!particle) return;
    particle.lineStyle(2, 0xd8c99e, 0.72).strokeEllipse(x, y, 26, 10);
    particle.fillStyle(0xb8aa84, 0.5).fillCircle(x - 13, y - 1, 2);
    particle.fillCircle(x + 13, y - 1, 2);
    this.fade(particle, 0, 1, 160, 1.45);
  }

  private create(depth: number): Phaser.GameObjects.Graphics | null {
    if (this.active.size >= 48) return null;
    const particle = this.scene.add.graphics().setDepth(depth);
    this.active.add(particle);
    return particle;
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
      onComplete: () => {
        this.active.delete(particle);
        particle.destroy();
      },
    });
  }
}
