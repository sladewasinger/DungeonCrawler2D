import type Phaser from "phaser";
import { cursorWorldTile } from "../../input/pointer.js";
import { aimHeadingDegrees } from "../../worldStatus.js";

export interface MouseAimInput {
  readonly camera: Phaser.Cameras.Scene2D.Camera;
  readonly pointer: Phaser.Input.Pointer;
  readonly tilePx: number;
  readonly body: { x: number; y: number } | null;
  readonly heightAt: (x: number, y: number) => number;
}

export function resolveMouseAimHeading({ camera, pointer, tilePx, body, heightAt }: MouseAimInput): number {
  if (!body) return 0;
  const target = cursorWorldTile({ camera, pointer, tilePx, heightAt });
  return aimHeadingDegrees(body, target);
}
