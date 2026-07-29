import Phaser from "phaser";
import { ASSET_KEYS } from "../../../boot/assetManifest.js";
import {
  emberVerticalOffset,
  oilVerticalOffset,
  particleAlpha,
  particleProgress,
  statusParticleNoise,
  type StatusParticleKind,
} from "./statusParticleMotion.js";
import type { StatusVisualBudget } from "./statusVisualBudget.js";
import type { StatusVisualFrame } from "./statusVisualFrame.js";

const PARTICLE_FRAME = "particle_soft";
const EMBER_DURATION_MS = 560;
const OIL_DURATION_MS = 720;
const EMBER_COLOR = 0xff9e3d;
const OIL_COLOR = 0x17121b;

interface StatusParticle {
  readonly sprite: Phaser.GameObjects.Sprite;
  active: boolean;
  kind: StatusParticleKind;
  startedAtMs: number;
  durationMs: number;
  offsetX: number;
  driftX: number;
}

export class EntityStatusParticles {
  private readonly slots: StatusParticle[] = [];
  private nextEmberAtMs = 0;
  private nextOilAtMs = 0;
  private sequence = 0;
  private seed = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly budget: StatusVisualBudget,
  ) {
    for (let index = 0; index < budget.particleSlotsPerRig; index++) {
      this.slots.push(createParticle(scene));
    }
  }

  activate(seed: number): void {
    this.reset();
    this.seed = seed;
  }

  sync(body: Phaser.GameObjects.Sprite, frame: StatusVisualFrame): void {
    this.syncSpawning(body, frame);
    if (!frame.burning) this.clearKind("ember");
    if (!frame.oiled) this.clearKind("oil");
    for (const slot of this.slots) this.updateSlot(slot, body, frame);
  }

  private syncSpawning(
    body: Phaser.GameObjects.Sprite,
    frame: StatusVisualFrame,
  ): void {
    if (frame.burning && frame.nowMs >= this.nextEmberAtMs) {
      this.spawn("ember", body, frame.nowMs);
      this.nextEmberAtMs = frame.nowMs + this.budget.emberIntervalMs;
    } else if (!frame.burning) this.nextEmberAtMs = 0;
    if (frame.oiled && frame.nowMs >= this.nextOilAtMs) {
      this.spawn("oil", body, frame.nowMs);
      this.nextOilAtMs = frame.nowMs + this.budget.oilDropIntervalMs;
    } else if (!frame.oiled) this.nextOilAtMs = 0;
  }

  private spawn(
    kind: StatusParticleKind,
    body: Phaser.GameObjects.Sprite,
    nowMs: number,
  ): void {
    const slot = availableSlot(this.slots);
    if (!slot) return;
    const noise = statusParticleNoise(this.seed, this.sequence++);
    configureParticle(slot, kind, nowMs);
    configureParticleGeometry(slot, body.displayWidth, noise);
  }

  private updateSlot(
    slot: StatusParticle,
    body: Phaser.GameObjects.Sprite,
    frame: StatusVisualFrame,
  ): void {
    if (!slot.active) return;
    const progress = particleProgress(frame.nowMs, slot.startedAtMs, slot.durationMs);
    if (progress >= 1) return void deactivate(slot);
    const groundDistance = frame.groundScreenY - body.y;
    const offset = slot.kind === "ember"
      ? emberVerticalOffset(progress, body.displayHeight)
      : oilVerticalOffset(progress, body.displayHeight, groundDistance);
    const y = body.y + offset;
    const drift = slot.kind === "ember" ? slot.driftX * progress : 0;
    slot.sprite.setPosition(body.x + slot.offsetX + drift, y);
    slot.sprite.setDepth(body.depth + 0.06);
    slot.sprite.setAlpha(particleAlpha(slot.kind, progress));
  }

  private clearKind(kind: StatusParticleKind): void {
    for (const slot of this.slots) {
      if (slot.active && slot.kind === kind) deactivate(slot);
    }
  }

  reset(): void {
    this.nextEmberAtMs = 0;
    this.nextOilAtMs = 0;
    this.sequence = 0;
    for (const slot of this.slots) deactivate(slot);
  }

  destroy(): void {
    for (const slot of this.slots) slot.sprite.destroy();
    this.slots.length = 0;
  }
}

function createParticle(scene: Phaser.Scene): StatusParticle {
  const sprite = scene.add.sprite(0, 0, ASSET_KEYS.atlas, PARTICLE_FRAME)
    .setOrigin(0.5)
    .setVisible(false)
    .setActive(false);
  return {
    sprite,
    active: false,
    kind: "ember",
    startedAtMs: 0,
    durationMs: EMBER_DURATION_MS,
    offsetX: 0,
    driftX: 0,
  };
}

function availableSlot(slots: readonly StatusParticle[]): StatusParticle | null {
  for (const slot of slots) {
    if (!slot.active) return slot;
  }
  return null;
}

function configureParticle(slot: StatusParticle, kind: StatusParticleKind, nowMs: number): void {
  slot.active = true;
  slot.kind = kind;
  slot.startedAtMs = nowMs;
  slot.durationMs = kind === "ember" ? EMBER_DURATION_MS : OIL_DURATION_MS;
  slot.sprite.setTint(kind === "ember" ? EMBER_COLOR : OIL_COLOR);
  slot.sprite.setBlendMode(kind === "ember" ? Phaser.BlendModes.ADD : Phaser.BlendModes.MULTIPLY);
  slot.sprite.setScale(kind === "ember" ? 0.1 : 0.08, kind === "ember" ? 0.1 : 0.15);
  slot.sprite.setVisible(true).setActive(true);
}

function configureParticleGeometry(slot: StatusParticle, bodyWidth: number, noise: number): void {
  slot.offsetX = (noise - 0.5) * bodyWidth * 0.55;
  slot.driftX = (0.5 - noise) * bodyWidth * 0.35;
}

function deactivate(slot: StatusParticle): void {
  slot.active = false;
  slot.sprite.setVisible(false).setActive(false).setAlpha(0);
}
