// Wall cell rendering by contour role. Faces (below entities) exist only where
// the wall actually drops to open ground; each mass gets ONE rim of edge-kit
// pieces (above entities, so bodies tuck behind rims); interior is flat
// near-black fill; isolated cells are freestanding columns. A face with open
// ground behind it projects its cap sprite one tile north (the pack's two-tall
// wall look — and the real occlusion mechanism, replacing all rectangle bands).
import { TILE, type World } from "@dc2d/engine";
import type Phaser from "phaser";
import { hasSouthFace } from "./faces.js";
import { heightTint, WALL_FILL_COLOR } from "./heightShade.js";
import { placeFillRect, placeSprite } from "./placeSprite.js";
import { classifyWallCell } from "./wallContour.js";

const FACE_TO_CAP: Readonly<Record<string, string>> = {
  wall_left: "wall_top_left",
  wall_mid: "wall_top_mid",
  wall_right: "wall_top_right",
};

export function drawWallTile(
  scene: Phaser.Scene,
  world: World,
  wx: number,
  wy: number,
  below: Phaser.GameObjects.Container,
  above: Phaser.GameObjects.Container,
): void {
  const tint = heightTint(world.heightAt(wx, wy));
  const solid = (dx: number, dy: number): boolean => world.tileAt(wx + dx, wy + dy) === TILE.Wall;
  const role = classifyWallCell(
    solid,
    hasSouthFace(world, wx, wy),
    (dx) => hasSouthFace(world, wx + dx, wy),
  );

  switch (role.kind) {
    case "pillar":
      // Freestanding obstacle: never wall-run art. Bottom-anchored so the column
      // rises out of its tile; below entities (bodies always draw in front).
      placeSprite(scene, below, wx, wy, "column", { tint, originY: 1 });
      return;
    case "face": {
      placeSprite(scene, below, wx, wy, role.frame, { tint });
      // The pack's cap-dash line always sits on the cell above the face: over
      // black fill inside a mass, overlapping open floor on a 1-thick wall
      // (which is also the occlusion overhang bodies tuck behind).
      placeSprite(scene, above, wx, wy - 1, FACE_TO_CAP[role.frame] ?? "wall_top_mid", { tint });
      return;
    }
    case "rim": {
      // Thin outline pieces sit OVER the mass fill; opaque ridge pieces ARE the art.
      if (!role.art.opaque) placeFillRect(scene, above, wx, wy, WALL_FILL_COLOR);
      placeSprite(scene, above, wx, wy, role.art.frame, {
        tint,
        ...(role.art.flip ? { flipY: true } : {}),
      });
      return;
    }
    case "fill":
      placeFillRect(scene, above, wx, wy, WALL_FILL_COLOR);
      return;
  }
}
