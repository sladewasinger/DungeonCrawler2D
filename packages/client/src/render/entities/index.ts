// EntityRenderer facade: owns every tracked entity's Phaser visual, keyed by id, and
// syncs it against a fresh frame of views. Consumers (scenes) call the per-kind sync
// methods once per frame; this is the only file outside this folder that should import
// its siblings directly.
import type Phaser from "phaser";
import { createItemVisual, updateItemVisual } from "./itemVisual.js";
import { createMonsterVisual, updateMonsterVisual } from "./monsterVisual.js";
import { createPlayerVisual, updatePlayerVisual } from "./playerVisual.js";
import { createProjectileVisual, updateProjectileVisual } from "./projectileEntityVisual.js";
import { monsterSpriteFor, playerSkinFor } from "./spriteMap.js";
import { destroyEntityVisual, type EntityVisual } from "./state.js";
import { createTorchVisual, updateTorchVisual } from "./torchEntityVisual.js";
import type { ItemEntityView, MonsterEntityView, PlayerEntityView, ProjectileEntityView, RenderContext, TorchEntityView } from "./view.js";

export type { RenderContext, PlayerEntityView, MonsterEntityView, ItemEntityView, ProjectileEntityView, TorchEntityView } from "./view.js";

export class EntityRenderer {
  private readonly visuals = new Map<string, EntityVisual>();
  private readonly seen = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {}

  syncPlayers(views: readonly PlayerEntityView[], ctx: RenderContext): void {
    const seen = this.stepKind(views, (view) => {
      const visual = this.getOrCreate(view.id, "player", () => createPlayerVisual(this.scene, ctx.nowMs));
      updatePlayerVisual(visual, playerSkinFor(view.playerId), view, ctx);
    });
    this.gc(seen, "player");
  }

  syncMonsters(views: readonly MonsterEntityView[], ctx: RenderContext): void {
    const seen = this.stepKind(views, (view) => {
      const visual = this.getOrCreate(view.id, "enemy", () => createMonsterVisual(this.scene, monsterSpriteFor(view.defId)));
      updateMonsterVisual(visual, view, ctx);
    });
    this.gc(seen, "enemy");
  }

  syncItems(views: readonly ItemEntityView[], nowMs: number): void {
    const seen = this.stepKind(views, (view) => {
      const visual = this.getOrCreate(view.id, "item", () => createItemVisual(this.scene));
      updateItemVisual(visual, view, nowMs);
    });
    this.gc(seen, "item");
  }

  syncProjectiles(views: readonly ProjectileEntityView[]): void {
    const seen = this.stepKind(views, (view) => {
      const visual = this.getOrCreate(view.id, "projectile", () => createProjectileVisual(this.scene));
      updateProjectileVisual(visual, view);
    });
    this.gc(seen, "projectile");
  }

  syncTorches(views: readonly TorchEntityView[], ctx: RenderContext): void {
    const seen = this.stepKind(views, (view) => {
      const visual = this.getOrCreate(view.id, "torch", () => createTorchVisual(this.scene));
      updateTorchVisual(visual, view, ctx);
    });
    this.gc(seen, "torch");
  }

  /** Runs `apply` over every view of one kind, returning the set of ids present this frame. */
  private stepKind<T extends { id: string }>(views: readonly T[], apply: (view: T) => void): Set<string> {
    const seen = this.seen;
    seen.clear();
    for (const view of views) {
      seen.add(view.id);
      apply(view);
    }
    return seen;
  }

  /** Reuses the tracked visual for `id` if it's still the right kind (so anims/timers survive), else rebuilds it. */
  private getOrCreate<T extends EntityVisual>(id: string, kind: T["kind"], build: () => T): T {
    const existing = this.visuals.get(id);
    if (existing && existing.kind === kind) return existing as T;
    if (existing) destroyEntityVisual(existing);
    const created = build();
    this.visuals.set(id, created);
    return created;
  }

  /** Destroys and forgets any tracked visual of `kind` that wasn't in this frame's view list. */
  private gc(seenIds: ReadonlySet<string>, kind: EntityVisual["kind"]): void {
    for (const [id, visual] of this.visuals) {
      if (visual.kind !== kind || seenIds.has(id)) continue;
      destroyEntityVisual(visual);
      this.visuals.delete(id);
    }
  }

  dispose(): void {
    for (const visual of this.visuals.values()) destroyEntityVisual(visual);
    this.visuals.clear();
  }
}
