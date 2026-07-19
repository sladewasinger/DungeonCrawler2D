// Shared per-entity render-state bag: the live Phaser objects for one entity id, kept
// across snapshots so animations, timers, and edge-triggers (hit flash, telegraph
// pulses) don't restart every frame. One EntityVisual per tracked id, owned by the
// EntityRenderer facade (index.ts).
import type Phaser from "phaser";
import type { HpBar } from "./hpBar.js";

interface CombatantParts {
  readonly body: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly hpBar: HpBar;
  readonly nameplate: Phaser.GameObjects.Text;
}

export interface PlayerVisual extends CombatantParts {
  readonly kind: "player";
  readonly weapon: Phaser.GameObjects.Sprite;
  lastHp: number;
  hitFlashStartMs: number | undefined;
  lastX: number;
  lastY: number;
  lastSampleMs: number;
  /** Air-state edge tracking for landing squash (squash.ts). */
  lastAir: boolean;
  squashStartMs: number | undefined;
  /** Slew-limited weapon-orbit angle (weaponOrbit.ts's stepOrbitAngle) — self only; left unused for remote players, whose weapon uses the legacy hand-offset instead. */
  weaponAngle: number;
  /** Attack edge-tracking for the strike-sweep tween's start time. */
  wasAttacking: boolean;
  swingStartMs: number | undefined;
}

export interface MonsterVisual extends CombatantParts {
  readonly kind: "enemy";
  readonly spritePrefix: string;
  lastHp: number;
  lastFx: readonly string[];
  hitFlashStartMs: number | undefined;
  lastAnim: string | undefined;
  telegraphStartMs: number | undefined;
}

export interface ItemVisual {
  readonly kind: "item";
  readonly body: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Ellipse;
}

export interface ProjectileVisual {
  readonly kind: "projectile";
  readonly body: Phaser.GameObjects.Sprite;
  readonly trail: Phaser.GameObjects.Particles.ParticleEmitter;
}

/**
 * A thrown torch's body sprite. Visible only while flying — once placed, its visual
 * identity comes entirely from the flame particle + halo (render/lighting), matching
 * authored world torches, which have no body sprite at all (see torchEntityVisual.ts).
 */
export interface TorchVisual {
  readonly kind: "torch";
  readonly body: Phaser.GameObjects.Sprite;
}

export type EntityVisual = PlayerVisual | MonsterVisual | ItemVisual | ProjectileVisual | TorchVisual;

/** Tears down every Phaser object owned by one tracked entity's visual. */
export function destroyEntityVisual(visual: EntityVisual): void {
  visual.body.destroy();
  if (visual.kind === "player" || visual.kind === "enemy") {
    visual.shadow.destroy();
    visual.hpBar.container.destroy();
    visual.nameplate.destroy();
  }
  if (visual.kind === "player") visual.weapon.destroy();
  if (visual.kind === "item") visual.shadow.destroy();
  if (visual.kind === "projectile") visual.trail.destroy();
}
