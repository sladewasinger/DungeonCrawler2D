import type { AreaSpriteKind, AreaTileView } from "../../../../vfx/system/index.js";

export interface AreaViewRecordInput {
  readonly key: string;
  readonly defId: string;
  readonly cell: Readonly<{ x: number; y: number }>;
  readonly groundHeight: number;
  readonly screen: Readonly<{ x: number; y: number }>;
  readonly sprite: AreaSpriteKind;
  readonly neighborMask: number;
}

export function writeAreaView(
  target: AreaTileView | undefined,
  input: AreaViewRecordInput,
): AreaTileView {
  const view = target ?? {} as AreaTileView;
  view.id = `${input.key}:${input.defId}`;
  view.effectId = input.defId;
  view.x = input.cell.x + 0.5;
  view.y = input.cell.y + 0.5;
  view.groundHeight = input.groundHeight;
  view.screenX = input.screen.x;
  view.screenY = input.screen.y;
  view.sprite = input.sprite;
  view.neighborMask = input.neighborMask;
  return view;
}
