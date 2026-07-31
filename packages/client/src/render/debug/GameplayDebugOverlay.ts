import type Phaser from "phaser";
import type { AdminMapEntity, DebugFlags } from "@dc2d/engine";
import { worldToScreen } from "../entities/geometry/worldToScreen.js";
import { drawGameplayEntityDebug } from "./gameplayDebugDrawing.js";
import { pruneGameplayDebugLabels } from "./gameplayDebugLabels.js";
import { GameplayAttackDebugLifetime } from "./attack/gameplayAttackDebugLifetime.js";
import { attackStrikeHeights } from "./attack/adminDebugAttackPosition.js";

/** Renders the server's private, authoritative admin diagnostics over the 2D world. */
export class GameplayDebugOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labels = new Map<string, Phaser.GameObjects.Text>();
  private readonly attackLifetime = new GameplayAttackDebugLifetime();

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(100_000);
  }

  update(input: GameplayDebugOverlayInput): void {
    const { flags, entities, active, nowMs } = input;
    this.graphics.clear();
    if (!active || !hasEnabledFlag(flags)) {
      this.attackLifetime.clear();
      pruneGameplayDebugLabels(this.labels, new Set());
      return;
    }
    const visibleEntities = this.attackLifetime.visibleEntities(entities, nowMs);
    const strikeHeights = attackStrikeHeights(visibleEntities);
    for (const entity of visibleEntities) {
      drawGameplayEntityDebug({
        graphics: this.graphics,
        flags,
        entity,
        hurtboxStrikeHeights: strikeHeights,
      });
    }
    const activeLabels = this.drawBehaviorLabels(flags, entities);
    pruneGameplayDebugLabels(this.labels, activeLabels);
  }

  dispose(): void {
    this.graphics.destroy();
    for (const label of this.labels.values()) label.destroy();
    this.labels.clear();
    this.attackLifetime.clear();
  }

  private drawBehaviorLabels(
    flags: DebugFlags,
    entities: readonly AdminMapEntity[],
  ): Set<string> {
    const activeIds = new Set<string>();
    if (!flags.behavior) return activeIds;
    for (const entity of entities) {
      if (!entity.debug?.behavior) continue;
      activeIds.add(entity.id);
      this.drawBehaviorLabel(entity);
    }
    return activeIds;
  }

  private drawBehaviorLabel(entity: AdminMapEntity): void {
    const behavior = entity.debug?.behavior;
    if (!behavior) return;
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
}

export interface GameplayDebugOverlayInput {
  readonly flags: DebugFlags;
  readonly entities: readonly AdminMapEntity[];
  readonly active: boolean;
  readonly nowMs: number;
}

function hasEnabledFlag(flags: DebugFlags): boolean {
  return Object.values(flags).some(Boolean);
}
