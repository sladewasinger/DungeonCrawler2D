// Wall rendering by contour role. Caps stay on logical wall cells, faces project
// south onto lower ground, and row depth decides whether an overlapping body is
// behind or in front. Boundary tops retain quiet stone texture; deep mass is flat.
import { TILE, type World } from "@dc2d/engine";
import type Phaser from "phaser";
import { hasSouthFace } from "./faces.js";
import { heightTint, WALL_FILL_COLOR } from "./heightShade.js";
import { placeBottomBand, placeFillRect, placeSprite } from "./placeSprite.js";
import { classifyWallCell } from "./wallContour.js";

const WALL_TOP_TINT = 0x505064;
const OCCLUSION_SHADOW = 0x09090f;
const OCCLUSION_FRACTION = 0.35;

const FACE_TO_CAP: Readonly<Record<string, string>> = {
  wall_left: "wall_top_left",
  wall_mid: "wall_top_mid",
  wall_right: "wall_top_right",
};

/** The south perimeter of a sanctuary cavity: render it as a real foreground wall. */
export function isSanctuaryFrontWall(world: World, wx: number, wy: number): boolean {
  return world.tileAt(wx, wy) === TILE.Wall && world.isSanctuary(wx, wy - 1);
}

export function drawWallTile(
  scene: Phaser.Scene,
  world: World,
  wx: number,
  wy: number,
  occluder: Phaser.GameObjects.Container,
  faceSuppressed: (wx: number, wy: number) => boolean,
): void {
  const tint = heightTint(world.heightAt(wx, wy));
  const solid = (dx: number, dy: number): boolean => world.tileAt(wx + dx, wy + dy) === TILE.Wall;
  const isFace = (x: number, y: number): boolean =>
    !faceSuppressed(x, y) && (hasSouthFace(world, x, y) || isSanctuaryFrontWall(world, x, y));
  const role = classifyWallCell(
    solid,
    isFace(wx, wy),
    (dx) => isFace(wx + dx, wy),
  );

  switch (role.kind) {
    case "pillar":
      // Freestanding obstacle: never wall-run art. Row sorting handles pass-behind.
      placeSprite(scene, occluder, wx, wy, "column", { tint, originY: 1 });
      return;
    case "face": {
      const frontWall = isSanctuaryFrontWall(world, wx, wy);
      const capY = frontWall ? wy - 1 : wy;
      if (!frontWall) placeSprite(scene, occluder, wx, capY, "floor_5", { tint: WALL_TOP_TINT });
      placeSprite(scene, occluder, wx, capY, FACE_TO_CAP[role.frame] ?? "wall_top_mid", { tint });
      placeSprite(scene, occluder, wx, capY + 1, role.frame, { tint });
      if (!frontWall && !solid(0, -1)) {
        placeBottomBand(scene, occluder, wx, wy - 1, OCCLUSION_SHADOW, 0.9, OCCLUSION_FRACTION);
      }
      return;
    }
    case "rim": {
      // Thin outline pieces sit OVER the mass fill; opaque ridge pieces ARE the art.
      if (!role.art.opaque) placeFillRect(scene, occluder, wx, wy, WALL_FILL_COLOR);
      placeSprite(scene, occluder, wx, wy, role.art.frame, {
        tint,
        ...(role.art.flip ? { flipY: true } : {}),
      });
      return;
    }
    case "fill":
      placeFillRect(scene, occluder, wx, wy, WALL_FILL_COLOR);
      return;
  }
}
