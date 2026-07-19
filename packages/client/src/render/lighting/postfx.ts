// Camera post-processing: a soft vignette (frame the dungeon, not the display) plus a
// faint bloom so lit pixels bleed a little — subtle enough the palette itself never
// shifts (verified by screenshot: same accent hexes, just glowing at the edges).
import type Phaser from "phaser";

const VIGNETTE_RADIUS = 0.82;
const VIGNETTE_STRENGTH = 0.35;
const BLOOM_STRENGTH = 0.5;
const BLOOM_STEPS = 3;

/** Adds the acceptance-bar's vignette + subtle bloom to a camera. */
export function applyLightingPostFX(camera: Phaser.Cameras.Scene2D.Camera): void {
  camera.postFX.addVignette(0.5, 0.5, VIGNETTE_RADIUS, VIGNETTE_STRENGTH);
  camera.postFX.addBloom(0xffffff, 1, 1, 0.6, BLOOM_STRENGTH, BLOOM_STEPS);
}
