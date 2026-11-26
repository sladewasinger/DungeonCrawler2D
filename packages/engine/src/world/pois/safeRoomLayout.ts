/** Sanctuary Town Hub (Floor 1 spawn glade) & outer Frontier Safe Room POI layout specs. */
import { PropKind } from "@dc2d/contracts";
import type { ChunkProp, PointLightSpec } from "../types.js";

export interface HubPropPlacement {
  readonly kind: PropKind;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly blocks: boolean;
  readonly light?: {
    readonly id: string;
    readonly kind: "campfire" | "torch" | "firefly";
    readonly color: number;
    readonly radiusPx: number;
    readonly intensity: number;
  } | undefined;
}

/** Fixed dry Floor-1 Sanctuary Hub NPC/service stations inside r <= 14 around spawn (0.5, 0.5). */
export const SPAWN_HUB_FIXTURES: readonly HubPropPlacement[] = [
  { kind: PropKind.NpcGuide, x: -1.5, y: -3.5, radius: 0.36, blocks: true },
  { kind: PropKind.NpcMerchant, x: 4.5, y: 3.5, radius: 0.36, blocks: true },
  { kind: PropKind.NpcBlacksmith, x: 4.5, y: -3.5, radius: 0.36, blocks: true },
  { kind: PropKind.BountyBoard, x: -1.5, y: 2.5, radius: 0.45, blocks: true },
  { kind: PropKind.StashChest, x: 1.5, y: 4.5, radius: 0.42, blocks: true },
  { kind: PropKind.Workbench, x: -5.5, y: -0.5, radius: 0.55, blocks: true },
] as const;

export const OUTER_SAFE_ROOM_PROPS: readonly HubPropPlacement[] = [
  {
    kind: PropKind.Campfire,
    x: -1.5,
    y: -1.5,
    radius: 0.78,
    blocks: true,
    light: { id: "safe-room-fire", kind: "campfire", color: 0xff9a3c, radiusPx: 210, intensity: 1.15 },
  },
  { kind: PropKind.Workbench, x: 1.5, y: -1.5, radius: 0.55, blocks: true },
  { kind: PropKind.StashChest, x: -1.5, y: 1.5, radius: 0.42, blocks: true },
  { kind: PropKind.NpcMerchant, x: 1.5, y: 1.5, radius: 0.36, blocks: true },
] as const;

export function stampSpawnHubFixtures(input: {
  readonly cx: number;
  readonly cy: number;
  readonly props: ChunkProp[];
  readonly lights: PointLightSpec[];
}): void {
  const minX = input.cx * 32;
  const maxX = minX + 32;
  const minY = input.cy * 32;
  const maxY = minY + 32;
  for (const fixture of SPAWN_HUB_FIXTURES) {
    if (fixture.x < minX || fixture.x >= maxX || fixture.y < minY || fixture.y >= maxY) continue;
    input.props.push({
      id: `${fixture.kind}:${Math.round(fixture.x * 10)},${Math.round(fixture.y * 10)}`,
      kind: fixture.kind,
      x: fixture.x,
      y: fixture.y,
      variant: 0,
      elevation: 0,
      radius: fixture.radius,
      blocksMovement: fixture.blocks,
    });
    if (fixture.light) {
      input.lights.push({ ...fixture.light, x: fixture.x, y: fixture.y });
    }
  }
}
