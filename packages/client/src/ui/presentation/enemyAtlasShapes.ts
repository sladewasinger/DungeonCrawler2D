/** Procedural pixel-art enemy sprite frames (idle_f0..3 & run_f0..3) for forest wildlife. */
import type { PixelRect } from "./itemIconShapes.js";

export interface ProceduralEnemySpriteSpec {
  readonly prefix: string;
  readonly width: number;
  readonly height: number;
  readonly frameRects: (anim: "idle" | "run", frame: number) => readonly PixelRect[];
}

const WOLF_STRIDES = [
  [-2, 1, 2, -1],
  [0, -1, 0, 1],
  [2, -1, -2, 1],
  [0, 1, 0, -1],
] as const;

function wolfFrame(anim: "idle" | "run", frame: number): readonly PixelRect[] {
  const bob = anim === "idle" ? (frame === 1 || frame === 2 ? 1 : 0) : (frame % 2 === 0 ? -1 : 0);
  const [hlFar, hlNear, flFar, flNear] = anim === "run" ? WOLF_STRIDES[frame % 4]! : [0, 0, 0, 0];
  const tailWag = anim === "idle" && frame % 2 === 1 ? -1 : 0;
  return [
    // Connected legs (start at y=12 inside the torso y=9..16 so zero gap is possible)
    [6 + hlFar, 12, 3, 5, "#334155"], [6 + hlFar, 17, 2, 4, "#334155"], [6 + hlFar, 20, 3, 2, "#475569"],
    [14 + flFar, 12, 3, 5, "#334155"], [14 + flFar, 17, 2, 4, "#334155"], [14 + flFar, 20, 3, 2, "#475569"],
    [8 + hlNear, 12, 4, 5, "#475569"], [9 + hlNear, 17, 2, 4, "#64748b"], [9 + hlNear, 20, 3, 2, "#cbd5e1"],
    [16 + flNear, 12, 3, 5, "#475569"], [16 + flNear, 17, 2, 4, "#64748b"], [16 + flNear, 20, 3, 2, "#cbd5e1"],
    // Bushy two-tone wolf tail
    [2, 10 + bob + tailWag, 4, 3, "#334155"], [1, 11 + bob + tailWag, 3, 3, "#475569"], [1, 13 + bob + tailWag, 2, 2, "#cbd5e1"],
    // Muscular torso, dorsal shading, fur tufts & silver underbelly
    [5, 9 + bob, 12, 7, "#475569"], [6, 9 + bob, 10, 2, "#334155"],
    [6, 11 + bob, 10, 4, "#64748b"], [8, 12 + bob, 6, 2, "#94a3b8"],
    [7, 15 + bob, 9, 2, "#cbd5e1"], [9, 11 + bob, 1, 2, "#334155"], [12, 11 + bob, 1, 2, "#334155"],
    // Thick silver-gray chest ruff / mane
    [13, 8 + bob, 5, 8, "#64748b"], [14, 9 + bob, 4, 6, "#94a3b8"], [15, 11 + bob, 3, 5, "#e2e8f0"],
    // Pointed ears, skull, snout, fang & glowing amber eye
    [15, 4 + bob, 2, 3, "#334155"], [16, 5 + bob, 1, 2, "#94a3b8"],
    [18, 4 + bob, 2, 3, "#334155"], [18, 5 + bob, 1, 2, "#94a3b8"],
    [15, 7 + bob, 5, 5, "#64748b"], [16, 8 + bob, 3, 3, "#94a3b8"],
    [19, 8 + bob, 4, 3, "#475569"], [19, 10 + bob, 3, 2, "#cbd5e1"],
    [22, 8 + bob, 1, 1, "#0f172a"], [20, 11 + bob, 1, 1, "#f8fafc"],
    [18, 7 + bob, 2, 1, "#1e293b"], [18, 8 + bob, 1, 1, "#fbbf24"],
  ];
}

const BEAR_STRIDES = [
  [-2, 2, 2, -2],
  [0, 1, -1, 0],
  [2, -2, -2, 2],
  [0, -1, 1, 0],
] as const;

function grizzlyFrame(anim: "idle" | "run", frame: number): readonly PixelRect[] {
  const bob = anim === "idle" ? (frame === 1 || frame === 2 ? 1 : 0) : (frame % 2 === 0 ? -1 : 0);
  const [hlFar, hlNear, flFar, flNear] = anim === "run" ? BEAR_STRIDES[frame % 4]! : [0, 0, 0, 0];
  return [
    // 4 Massive pillar legs (start at y=18 deep inside torso y=9..25 so legs never detach)
    [6 + hlFar, 18, 4, 15, "#3b1706"], [7 + hlFar, 20, 2, 11, "#5c240a"], [8 + hlFar, 32, 3, 2, "#d6d3d1"],
    [17 + flFar, 18, 4, 15, "#3b1706"], [18 + flFar, 20, 2, 11, "#5c240a"], [19 + flFar, 32, 3, 2, "#d6d3d1"],
    [10 + hlNear, 18, 5, 9, "#5c240a"], [10 + hlNear, 25, 4, 8, "#5c240a"],
    [11 + hlNear, 19, 3, 12, "#78350f"], [12 + hlNear, 20, 2, 6, "#92400e"], [12 + hlNear, 32, 3, 2, "#f5f5f4"],
    [21 + flNear, 18, 5, 9, "#5c240a"], [21 + flNear, 25, 4, 8, "#5c240a"],
    [22 + flNear, 19, 3, 12, "#78350f"], [23 + flNear, 20, 2, 6, "#92400e"], [23 + flNear, 32, 3, 2, "#f5f5f4"],
    // Stub tail, massive humped back, textured fur coat & shaggy belly fringe
    [3, 14 + bob, 3, 4, "#3b1706"],
    [4, 10 + bob, 20, 15, "#5c240a"], [14, 8 + bob, 8, 5, "#5c240a"],
    [6, 10 + bob, 17, 13, "#78350f"], [15, 9 + bob, 6, 4, "#9a471d"],
    [8, 11 + bob, 13, 8, "#92400e"], [10, 11 + bob, 8, 3, "#b45309"],
    [9, 14 + bob, 2, 3, "#5c240a"], [14, 15 + bob, 2, 3, "#5c240a"], [18, 13 + bob, 2, 3, "#5c240a"],
    [6, 22 + bob, 16, 3, "#3b1706"], [8, 24 + bob, 12, 2, "#3b1706"],
    // Rounded ears, heavy skull, tan muzzle, fangs & glowing eye
    [20, 8 + bob, 3, 3, "#3b1706"], [21, 9 + bob, 1, 1, "#92400e"],
    [24, 8 + bob, 3, 3, "#3b1706"], [25, 9 + bob, 1, 1, "#92400e"],
    [20, 10 + bob, 8, 10, "#5c240a"], [21, 11 + bob, 6, 8, "#78350f"], [22, 11 + bob, 4, 3, "#9a471d"],
    [26, 13 + bob, 4, 5, "#b45309"], [27, 13 + bob, 3, 3, "#d97706"],
    [29, 13 + bob, 2, 2, "#0f172a"], [25, 18 + bob, 4, 2, "#3b1706"],
    [27, 17 + bob, 2, 2, "#991b1b"], [28, 17 + bob, 1, 1, "#f8fafc"], [28, 18 + bob, 1, 1, "#f8fafc"],
    [24, 12 + bob, 2, 2, "#ef4444"], [25, 12 + bob, 1, 1, "#fef08a"],
  ];
}

function spiderFrame(anim: "idle" | "run", frame: number): readonly PixelRect[] {
  const step = (anim === "run" ? 2 : 1) * (frame % 2 === 0 ? 1 : -1);
  const alt = -step;
  return [
    // 8 Connected jointed legs rooted in the central thorax (x=11..16, y=11..16)
    [5, 9 + step, 7, 2, "#1e293b"], [3, 10 + step, 2, 5, "#0f172a"], [2, 14 + step, 2, 6, "#1e293b"],
    [6, 12 + alt, 7, 2, "#334155"], [4, 13 + alt, 2, 5, "#1e293b"], [3, 17 + alt, 2, 4, "#0f172a"],
    [13, 12 + step, 6, 2, "#334155"], [18, 13 + step, 2, 5, "#1e293b"], [19, 17 + step, 2, 4, "#0f172a"],
    [14, 9 + alt, 6, 2, "#1e293b"], [19, 10 + alt, 2, 5, "#0f172a"], [20, 14 + alt, 2, 6, "#1e293b"],
    // Bulbous abdomen with crimson hourglass & specular highlight
    [4, 6, 10, 10, "#1e1b4b"], [5, 7, 8, 8, "#312e81"], [6, 7, 5, 2, "#4338ca"],
    [7, 9, 4, 2, "#dc2626"], [8, 11, 2, 1, "#ef4444"], [7, 12, 4, 2, "#dc2626"],
    // Cephalothorax, 4 glowing red eyes & ivory chelicerae fangs
    [12, 9, 7, 7, "#0f172a"], [13, 10, 5, 5, "#1e293b"],
    [17, 10, 2, 1, "#ef4444"], [17, 13, 2, 1, "#ef4444"], [18, 11, 1, 1, "#fef08a"],
    [19, 11, 3, 2, "#e2e8f0"], [20, 13, 2, 2, "#cbd5e1"],
  ];
}

function boarFrame(anim: "idle" | "run", frame: number): readonly PixelRect[] {
  const bob = anim === "run" && frame % 2 === 1 ? -1 : 0;
  const [hlFar, hlNear, flFar, flNear] = anim === "run" ? WOLF_STRIDES[frame % 4]! : [0, 0, 0, 0];
  return [
    // 4 Connected legs rooted at y=14 inside torso (y=9..17)
    [6 + hlFar, 14, 3, 7, "#29150a"], [8 + hlNear, 14, 3, 7, "#451a03"], [8 + hlNear, 20, 3, 2, "#1c0d06"],
    [14 + flFar, 14, 3, 7, "#29150a"], [16 + flNear, 14, 3, 7, "#451a03"], [16 + flNear, 20, 3, 2, "#1c0d06"],
    // Jagged dorsal bristle mane, stocky russet body & fur texture
    [5, 7 + bob, 13, 3, "#29150a"], [3, 11 + bob, 2, 3, "#29150a"],
    [4, 9 + bob, 15, 8, "#5c2d16"], [6, 10 + bob, 12, 6, "#7c3f1d"],
    [8, 11 + bob, 8, 3, "#9a4e24"], [10, 13 + bob, 2, 2, "#5c2d16"], [14, 12 + bob, 2, 2, "#5c2d16"],
    // Wedge head, nasal snout disk, angry eye & curved white tusks
    [16, 10 + bob, 6, 7, "#5c2d16"], [17, 11 + bob, 4, 5, "#7c3f1d"],
    [21, 12 + bob, 2, 4, "#d97706"], [22, 13 + bob, 1, 2, "#78350f"],
    [18, 11 + bob, 2, 1, "#fbbf24"],
    [20, 15 + bob, 3, 2, "#f8fafc"], [21, 13 + bob, 2, 2, "#f8fafc"],
  ];
}

export const PROCEDURAL_ENEMY_SPECS: readonly ProceduralEnemySpriteSpec[] = [
  { prefix: "wolf", width: 24, height: 24, frameRects: wolfFrame },
  { prefix: "grizzly_bear", width: 32, height: 36, frameRects: grizzlyFrame },
  { prefix: "forest_spider", width: 24, height: 24, frameRects: spiderFrame },
  { prefix: "wild_boar", width: 24, height: 24, frameRects: boarFrame },
];
