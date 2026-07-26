import type Phaser from "phaser";
import { PageBudget, type PageBudgetSnapshot } from "./pageBudget.js";
import { PagePool } from "./pagePool.js";
import { MAX_STRIP_PAGE_HEIGHT_BAKE_PX } from "./stripAtlas.js";
import type { TerrainDeviceProfile } from "./terrainDeviceProfile.js";
import {
  assertTerrainTextureDimensions,
  TERRAIN_BAKE_CHUNK_PX,
  terrainPageBytes,
} from "./terrainMetrics.js";

const TERRAIN_NEAREST_FILTER_MODE: Phaser.Textures.FilterMode = 1;
let pageGeneration = 0;

const PAGE_CLASSES = {
  strip: { height: MAX_STRIP_PAGE_HEIGHT_BAKE_PX },
  base: { height: TERRAIN_BAKE_CHUNK_PX },
} as const;

export type PageClass = keyof typeof PAGE_CLASSES;
type TerrainPage = Phaser.Textures.DynamicTexture;
type TerrainPools = Record<PageClass, PagePool<TerrainPage>>;

interface TerrainPageState {
  readonly profile: TerrainDeviceProfile;
  readonly budget: PageBudget;
  readonly pools: TerrainPools;
}

const pageStates = new WeakMap<Phaser.Textures.TextureManager, TerrainPageState>();

export function configureTerrainPages(
  textures: Phaser.Textures.TextureManager,
  profile: TerrainDeviceProfile,
): TerrainDeviceProfile {
  const existing = pageStates.get(textures);
  if (existing) return existing.profile;
  pageStates.set(textures, makeState(textures, profile));
  return profile;
}

export function terrainPageProfileFor(textures: Phaser.Textures.TextureManager): TerrainDeviceProfile {
  return stateFor(textures).profile;
}

export function terrainPageMemoryFor(textures: Phaser.Textures.TextureManager): PageBudgetSnapshot {
  return stateFor(textures).budget.snapshot();
}

export function pagePoolFor(
  textures: Phaser.Textures.TextureManager,
  cls: PageClass,
): PagePool<TerrainPage> {
  return stateFor(textures).pools[cls];
}

export function acquireStripPage(
  textures: Phaser.Textures.TextureManager,
  height: number,
): TerrainPage | undefined {
  if (height <= MAX_STRIP_PAGE_HEIGHT_BAKE_PX) return pagePoolFor(textures, "strip").acquire();
  const state = stateFor(textures);
  const bytes = terrainPageBytes(TERRAIN_BAKE_CHUNK_PX, height);
  if (!state.budget.activateNew(bytes)) return undefined;
  try {
    return createPage(textures, height, state.profile.maximumPreferredPagePx);
  } catch (error) {
    state.budget.releaseAndDestroy(bytes);
    throw error;
  }
}

export function releasePage(page: TerrainPage, cls: PageClass): void {
  if (cls === "strip" && page.height > MAX_STRIP_PAGE_HEIGHT_BAKE_PX) {
    stateFor(page.manager).budget.releaseAndDestroy(terrainPageBytes(page.width, page.height));
    page.manager.remove(page);
    return;
  }
  pagePoolFor(page.manager, cls).release(page);
}

function stateFor(textures: Phaser.Textures.TextureManager): TerrainPageState {
  const state = pageStates.get(textures);
  if (!state) throw new Error("terrain pages must be configured before use");
  return state;
}

function makeState(
  textures: Phaser.Textures.TextureManager,
  profile: TerrainDeviceProfile,
): TerrainPageState {
  const budget = new PageBudget(profile);
  return {
    profile,
    budget,
    pools: {
      strip: makePool(textures, "strip", profile, budget),
      base: makePool(textures, "base", profile, budget),
    },
  };
}

function makePool(
  textures: Phaser.Textures.TextureManager,
  cls: PageClass,
  profile: TerrainDeviceProfile,
  budget: PageBudget,
): PagePool<TerrainPage> {
  const dimensions = PAGE_CLASSES[cls];
  return new PagePool({
    create: () => createPage(textures, dimensions.height, profile.maximumPreferredPagePx),
    recycle: recyclePage,
    destroy: (page) => textures.remove(page),
    bytesPerPage: terrainPageBytes(TERRAIN_BAKE_CHUNK_PX, dimensions.height),
    budget,
  });
}

function createPage(
  textures: Phaser.Textures.TextureManager,
  height: number,
  maximumPreferredPagePx: number,
): TerrainPage {
  assertTerrainTextureDimensions(TERRAIN_BAKE_CHUNK_PX, height, maximumPreferredPagePx);
  const page = textures.addDynamicTexture(
    `terrain-page:${pageGeneration++}`,
    TERRAIN_BAKE_CHUNK_PX,
    height,
  );
  if (!page) throw new Error("terrain page texture key collision");
  page.setFilter(TERRAIN_NEAREST_FILTER_MODE);
  return page;
}

function recyclePage(page: TerrainPage): void {
  for (const name of page.getFrameNames()) {
    if (name !== "__BASE") page.remove(name);
  }
  page.clear();
}
