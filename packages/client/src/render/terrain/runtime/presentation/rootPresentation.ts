import type Phaser from "phaser";
import { ASSET_KEYS } from "../../../../boot/assetManifest.js";
import type {
  WorldPresentationVisibility,
} from "../../../visibility/worldPresentationVisibility.js";
import { TERRAIN_PRESENTATION_MODES } from "../../geometry/terrainPlannerModel.js";
import {
  appendVisibleChunkPlans,
  emptyTerrainBatches,
  type TerrainChunkPlanCache,
} from "../../planning/chunkCache.js";
import type {
  TerrainBatchSelectionMetrics,
} from "../../planning/visibility/visibleTerrainBatches.js";
import type { TerrainRect, TerrainSource } from "../../planning/terrainPlanner.js";
import type { TerrainDeviceProfile } from "../../streaming/terrainDeviceProfile.js";
import { syncTerrainProps } from "../props.js";
import { recordTerrainRenderDebug } from "./terrainRenderDebug.js";
import {
  materialsFor,
  screenProjection,
  worldBiomeAt,
} from "../renderSupport.js";
import type { TerrainRoot } from "../root.js";
import type { TerrainWorld } from "../world.js";
import type { ViewOrientation } from "../../../view/orientation/viewOrientation.js";

export function renderTerrainRoot(input: {
  readonly scene: Phaser.Scene;
  readonly root: TerrainRoot;
  readonly bounds: TerrainRect;
  readonly cache: TerrainChunkPlanCache;
  readonly source: TerrainSource;
  readonly world: TerrainWorld;
  readonly profile: TerrainDeviceProfile;
  readonly visibility: WorldPresentationVisibility | null;
  readonly debug: boolean;
  readonly maxNewChunkPlans?: number;
}): { readonly metrics: TerrainBatchSelectionMetrics; readonly pendingChunkPlans: number } {
  const { plan, metrics, pendingChunkPlans } = selectTerrainPlan(input);
  renderTerrainPlan(input, plan);
  syncTerrainProps({ scene: input.scene, root: input.root, props: plan.props });
  recordTerrainRenderDebug({
    orientation: input.root.orientation,
    bounds: input.bounds,
    tileRevision: input.world.tileRevision,
    pendingChunkPlans,
    batches: plan,
    selection: metrics,
    atlas: input.root.atlas.debugState(),
  });
  return { metrics, pendingChunkPlans };
}

function selectTerrainPlan(input: Parameters<typeof renderTerrainRoot>[0]): {
  readonly plan: ReturnType<typeof emptyTerrainBatches>;
  readonly metrics: TerrainBatchSelectionMetrics;
  readonly pendingChunkPlans: number;
} {
  const plan = emptyTerrainBatches();
  let pendingChunkPlans = 0;
  const metrics = appendVisibleChunkPlans({
    target: plan,
    cache: input.cache,
    source: input.source,
    bounds: input.bounds,
    orientation: input.root.orientation,
    revision: input.world.tileRevision,
    visibility: input.visibility,
    maxNewPlans: input.maxNewChunkPlans,
    onPendingPlan: () => { pendingChunkPlans += 1; },
  });
  return { plan, metrics, pendingChunkPlans };
}

function renderTerrainPlan(
  input: Parameters<typeof renderTerrainRoot>[0],
  plan: ReturnType<typeof emptyTerrainBatches>,
): void {
  if (hasAtlasAssets(input.scene, input.debug)) return renderAtlasRoot(input, plan);
  input.root.batch.render(
    plan,
    screenProjection,
    materialsFor(input.world, input.bounds, input.profile.visuals),
  );
}

function renderAtlasRoot(
  input: Parameters<typeof renderTerrainRoot>[0],
  plan: ReturnType<typeof emptyTerrainBatches>,
): void {
  input.root.atlas.render(plan, {
    projection: screenProjection,
    biomeAt: (tile) => worldBiomeAt(input.world, tile.x, tile.y),
    territoryAt: (tile) => input.source.territoryAt?.(tile.x, tile.y) ?? null,
    biomeTintAt: (tile) => biomeTintAt(input, tile),
    debug: input.debug,
  });
  input.root.graphics.setVisible(false);
}

function biomeTintAt(
  input: Parameters<typeof renderTerrainRoot>[0],
  tile: Readonly<{ x: number; y: number }>,
) {
  const presentation = input.source.presentationAt?.(tile.x, tile.y);
  return presentation?.mode === TERRAIN_PRESENTATION_MODES.Inside
    ? null
    : worldBiomeAt(input.world, tile.x, tile.y);
}

export function hasAtlasAssets(
  scene: Phaser.Scene,
  debug: boolean,
): boolean {
  const key = debug ? ASSET_KEYS.debugAtlas : ASSET_KEYS.sharedAtlas;
  return scene.textures.exists(key);
}

export function terrainPresentationPlanKey(input: {
  readonly orientation: ViewOrientation;
  readonly bounds: TerrainRect;
  readonly tileRevision: number;
  readonly visibilityRevision: number | null;
}): string {
  const { orientation, bounds, tileRevision, visibilityRevision } = input;
  return [
    orientation,
    `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`,
    tileRevision,
    visibilityRevision ?? "all",
  ].join(":");
}

export function pruneTerrainWorldChunks(input: {
  readonly world: TerrainWorld;
  readonly bounds: TerrainRect;
  readonly capacity: number;
}): void {
  const { world, bounds, capacity } = input;
  world.pruneChunkCache?.(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
    capacity,
  );
}
