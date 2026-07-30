import type Phaser from "phaser";

const RADIUS = 22;
const RING_COLOR = 0x494956;
const FORWARD_TICK_COLOR = 0x9a9aae;
const STAIRWAY_COLOR = 0xffd23d;
const SAFE_ROOM_COLOR = 0x4ea8ff;
const MINI_BOSS_COLOR = 0xe04a4a;
const LANDMARK_POINT_RADIUS = 2.5;

export const COMPASS_LETTER_RADIUS = RADIUS - 8;
export const COMPASS_MARKER_RADIUS = RADIUS - 2;

export interface CompassPresentation {
  readonly ring: Phaser.GameObjects.Graphics;
  readonly stairway: Phaser.GameObjects.Graphics;
  readonly safeRoom: Phaser.GameObjects.Graphics;
  readonly miniBossArena: Phaser.GameObjects.Graphics;
}

export function createCompassPresentation(
  scene: Phaser.Scene,
): CompassPresentation {
  return {
    ring: createCompassRing(scene),
    stairway: createStairwayTick(scene),
    safeRoom: createLandmarkPoint(scene, SAFE_ROOM_COLOR),
    miniBossArena: createLandmarkPoint(scene, MINI_BOSS_COLOR),
  };
}

function createCompassRing(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.add.graphics()
    .lineStyle(2, RING_COLOR, 1)
    .strokeCircle(0, 0, RADIUS)
    .fillStyle(FORWARD_TICK_COLOR, 1)
    .fillTriangle(-4, -RADIUS - 2, 4, -RADIUS - 2, 0, -RADIUS + 6);
}

function createStairwayTick(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.add.graphics()
    .fillStyle(STAIRWAY_COLOR, 1)
    .fillTriangle(-3, 3, 3, 3, 0, -4)
    .setVisible(false);
}

function createLandmarkPoint(
  scene: Phaser.Scene,
  color: number,
): Phaser.GameObjects.Graphics {
  return scene.add.graphics()
    .fillStyle(color, 1)
    .fillCircle(0, 0, LANDMARK_POINT_RADIUS)
    .setVisible(false);
}
