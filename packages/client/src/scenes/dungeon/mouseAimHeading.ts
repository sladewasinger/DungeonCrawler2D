import type Phaser from "phaser";
import { cursorWorldTile } from "../../input/pointer.js";
import { aimHeadingDegrees } from "../../worldStatus.js";

export function resolveMouseAimHeading(
  camera: Phaser.Cameras.Scene2D.Camera,
  pointer: Phaser.Input.Pointer,
  tilePx: number,
  body: { x: number; y: number } | null,
  heightAt: (x: number, y: number) => number,
): number {
  if (!body) return 0;
  const target = cursorWorldTile(camera, pointer, tilePx, heightAt);
  return aimHeadingDegrees(body, target);
}
