/** Phased startup preloader baking sprites, icons, gore masks, and hero portraits before the title opens. */
import { BODY_STYLES, HAIR_STYLES, type ArmorEquipment, type CharacterAppearance } from "@dc2d/engine";
import { getCharacterPortraitUrl, getCharacterSpriteSet } from "../../render/character/characterSprites.js";
import {
  getGrippingHandTexture, getInHandTorchFrames, getShieldTexture, getWaistLanternFrames,
} from "../../render/character/heldWeapons.js";
import { preloadPlayerAssets } from "../../render/character/playerAssets.js";
import { getGoreTextures } from "../../render/combat/gore/goreTextures.js";
import { preloadSpriteManifest } from "../../render/textures/spriteManifest.js";
import { prebakeAllItemIcons } from "../icons/itemIcons.js";
import { LoadingScreen } from "./loadingScreen.js";

const EMPTY_ARMOR: ArmorEquipment = { head: null, chest: null, legs: null, feet: null, offhand: null };

export type BootProgressCallback = (fraction: number, label: string) => void;

export function computeWeightedProgress(range: readonly [number, number], ratio: number): number {
  const safe = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  return range[0] + (range[1] - range[0]) * safe;
}

function yieldToPaint(): Promise<void> {
  if (typeof requestAnimationFrame === "function") {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
  return Promise.resolve();
}

async function preloadCoreGameAssets(onProgress: BootProgressCallback): Promise<void> {
  let manifestDone = 0;
  let manifestTotal = 0;
  let playerDone = 0;
  let playerTotal = 0;
  const emit = (): void => {
    const total = manifestTotal + playerTotal;
    if (total <= 0) return;
    const done = manifestDone + playerDone;
    onProgress(computeWeightedProgress([0.06, 0.64], done / total), `Loading world & hero sprites (${done}/${total})...`);
  };
  await Promise.all([
    preloadSpriteManifest({
      includePlayer: false,
      onProgress: (done, total) => { manifestDone = done; manifestTotal = total; emit(); },
    }),
    preloadPlayerAssets((done, total) => { playerDone = done; playerTotal = total; emit(); }),
  ]);
  onProgress(0.64, "Sprites loaded.");
}

function warmCombatAndGearTextures(): void {
  if (typeof document === "undefined") return;
  getGoreTextures();
  prebakeAllItemIcons();
  getInHandTorchFrames();
  getWaistLanternFrames();
  getShieldTexture();
  getGrippingHandTexture(false);
  getGrippingHandTexture(true);
}

function warmHeroSpritesAndPortraits(appearance: CharacterAppearance): void {
  if (typeof document === "undefined") return;
  getCharacterSpriteSet(appearance, EMPTY_ARMOR);
  for (const body of BODY_STYLES) {
    for (const hairStyle of HAIR_STYLES) {
      getCharacterPortraitUrl({ ...appearance, body, hairStyle }, EMPTY_ARMOR);
    }
  }
}

async function warmGameplayTexturesAndHero(opts: {
  readonly appearance: CharacterAppearance;
  readonly onProgress: BootProgressCallback;
}): Promise<void> {
  opts.onProgress(0.78, "Baking combat & item textures...");
  await yieldToPaint();
  warmCombatAndGearTextures();
  opts.onProgress(0.88, "Baking hero sprites & portraits...");
  await yieldToPaint();
  warmHeroSpritesAndPortraits(opts.appearance);
  opts.onProgress(1, "Ready!");
  await yieldToPaint();
}

export interface BootPreloadFlowOptions {
  readonly host: HTMLElement;
  readonly isSandbox: boolean;
  readonly onSandbox: () => Promise<void>;
  readonly onMountWorld: () => Promise<{ readonly appearance: CharacterAppearance; readonly onBeforeReveal: () => void }>;
}

export async function runBootPreloadFlow(opts: BootPreloadFlowOptions): Promise<void> {
  const loading = new LoadingScreen(opts.host);
  loading.setProgress(0.06, "Engine loaded — fetching sprites...");
  await preloadCoreGameAssets((p, label) => loading.setProgress(p, label));
  if (opts.isSandbox) {
    loading.setProgress(1, "Opening Asset Sandbox...");
    await loading.dismiss();
    await opts.onSandbox();
    return;
  }
  loading.setProgress(0.66, "Preparing terrain & shaders...");
  await yieldToPaint();
  const mounted = await opts.onMountWorld();
  await warmGameplayTexturesAndHero({
    appearance: mounted.appearance,
    onProgress: (p, label) => loading.setProgress(p, label),
  });
  mounted.onBeforeReveal();
  await loading.dismiss();
}
