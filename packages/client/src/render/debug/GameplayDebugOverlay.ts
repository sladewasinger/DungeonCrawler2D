import type Phaser from "phaser";
import type { AdminMapEntity, DebugFlags } from "@dc2d/engine";
import { worldToScreen } from "../entities/geometry/worldToScreen.js";

const RADIUS_PX = 10;
const COLORS = {
  hurtbox: 0xf7c55c,
  attack: 0xf3727d,
  guard: 0x78c6e8,
  lineOfSight: 0xe9c46a,
  navigation: 0x76d7ea,
};

/** Renders the server's private admin debug feed directly over the 2D world. */
export class GameplayDebugOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labels = new Map<string, Phaser.GameObjects.Text>();

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(100_000);
  }

  update(flags: DebugFlags, entities: readonly AdminMapEntity[], active: boolean): void {
    this.graphics.clear();
    this.hideLabels();
    if (!active || !hasEnabledFlag(flags)) return;
    drawEntityOverlays(this.graphics, flags, entities);
    this.drawBehaviorLabels(flags, entities);
  }

  dispose(): void {
    this.graphics.destroy();
    for (const label of this.labels.values()) label.destroy();
    this.labels.clear();
  }

  private drawBehaviorLabels(flags: DebugFlags, entities: readonly AdminMapEntity[]): void {
    if (!flags.behavior && !flags.search) return;
    for (const entity of entities) this.drawBehaviorLabel(flags, entity);
  }

  private drawBehaviorLabel(flags: DebugFlags, entity: AdminMapEntity): void {
    const behavior = entity.debug?.behavior;
    if (!behavior || (!flags.behavior && behavior !== "searching")) return;
    const label = this.labelFor(entity.id);
    const screen = worldToScreen(entity.x, entity.y);
    label.setText(behavior.toUpperCase());
    label.setPosition(screen.x, screen.y - 34);
    label.setVisible(true);
  }

  private labelFor(id: string): Phaser.GameObjects.Text {
    const existing = this.labels.get(id);
    if (existing) return existing;
    const label = this.scene.add.text(0, 0, "", {
      color: "#eaf4ff", fontSize: "10px", fontStyle: "bold",
      stroke: "#07101d", strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(100_001);
    this.labels.set(id, label);
    return label;
  }

  private hideLabels(): void {
    for (const label of this.labels.values()) label.setVisible(false);
  }
}

function hasEnabledFlag(flags: DebugFlags): boolean {
  return Object.values(flags).some(Boolean);
}

function drawEntityOverlays(
  graphics: Phaser.GameObjects.Graphics,
  flags: DebugFlags,
  entities: readonly AdminMapEntity[],
): void {
  for (const entity of entities) drawEntityOverlay(graphics, flags, entity);
}

function drawEntityOverlay(
  graphics: Phaser.GameObjects.Graphics,
  flags: DebugFlags,
  entity: AdminMapEntity,
): void {
  const point = worldToScreen(entity.x, entity.y);
  drawHurtboxIfEnabled(graphics, point, flags.hurtboxes);
  drawFacingIfEnabled({ graphics, point, entity, enabled: flags.attacks });
  drawGuardIfEnabled({ graphics, point, entity, enabled: flags.guards });
  drawDebugLinks({ graphics, point, entity, flags });
}

function drawHurtboxIfEnabled(
  graphics: Phaser.GameObjects.Graphics,
  point: { x: number; y: number },
  enabled: boolean,
): void {
  if (enabled) drawHurtbox(graphics, point);
}

function drawHurtbox(
  graphics: Phaser.GameObjects.Graphics,
  point: { x: number; y: number },
): void {
  graphics.lineStyle(1, COLORS.hurtbox, 0.9);
  graphics.strokeCircle(point.x, point.y, RADIUS_PX);
}

function drawFacingIfEnabled(input: {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly point: { x: number; y: number };
  readonly entity: AdminMapEntity;
  readonly enabled: boolean;
}): void {
  const { graphics, point, entity, enabled } = input;
  const facing = enabled ? entity.facing : undefined;
  if (!facing) return;
  graphics.lineStyle(2, COLORS.attack, 0.9);
  graphics.lineBetween(point.x, point.y, point.x + facing.x * 22, point.y + facing.y * 22);
}

function drawGuardIfEnabled(input: {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly point: { x: number; y: number };
  readonly entity: AdminMapEntity;
  readonly enabled: boolean;
}): void {
  const { graphics, point, entity, enabled } = input;
  const facing = enabled && entity.blocking ? entity.facing ?? { x: 1, y: 0 } : null;
  if (!facing) return;
  const angle = Math.atan2(facing.y, facing.x);
  graphics.lineStyle(1, COLORS.guard, 0.95);
  graphics.beginPath();
  graphics.arc(point.x, point.y, 18, angle - 0.55, angle + 0.55);
  graphics.strokePath();
}

function drawDebugLinks(input: {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly point: { x: number; y: number };
  readonly entity: AdminMapEntity;
  readonly flags: DebugFlags;
}): void {
  const { graphics, point, entity, flags } = input;
  if (flags.lineOfSight && entity.debug?.target) drawLink({ graphics, source: point, target: entity.debug.target, color: COLORS.lineOfSight });
  if (flags.navigation && entity.debug?.waypoint) drawLink({ graphics, source: point, target: entity.debug.waypoint, color: COLORS.navigation });
}

function drawLink(input: {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly source: { x: number; y: number };
  readonly target: { x: number; y: number };
  readonly color: number;
}): void {
  const { graphics, source, target, color } = input;
  const end = worldToScreen(target.x, target.y);
  graphics.lineStyle(1, color, 0.85);
  graphics.lineBetween(source.x, source.y, end.x, end.y);
}
