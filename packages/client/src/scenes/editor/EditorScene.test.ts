// Editor-scene renderer seam coverage verifies active bench projectiles reach the shared renderer.
import { describe, expect, it, vi } from "vitest";
import { EditorScene } from "./EditorScene.js";
import { benchProjectileViews, stepBenchTick } from "./bench/index.js";
import { paintEnemy } from "./bench/paint.js";
import { createBenchState } from "./bench/state.js";
import { EditableWorld } from "./EditableWorld.js";

vi.mock("phaser", () => ({ default: { Scene: class {} } }));

describe("EditorScene bench renderer seam", () => {
  it("forwards every active projectile view to EntityRenderer.syncProjectiles", () => {
    const bench = createBenchState(new EditableWorld());
    const dummyTile = Math.floor(bench.dummy.body.x);
    paintEnemy(bench, dummyTile - 3, dummyTile, "spitter");
    stepBenchTick(bench);
    const syncProjectiles = vi.fn();
    const scene = Object.create(EditorScene.prototype) as EditorScene;
    Object.assign(scene, {
      store: { bench },
      vfx: { syncAreas: vi.fn(), update: vi.fn() },
      entityRenderer: {
        syncMonsters: vi.fn(),
        syncItems: vi.fn(),
        syncProjectiles,
      },
    });

    scene.update(100, 16);

    expect(syncProjectiles).toHaveBeenCalledExactlyOnceWith(benchProjectileViews(bench));
  });
});
