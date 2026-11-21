import { FLOOR_SEMANTIC } from "@dc2d/engine";

export interface PreviewCellColorInput {
  readonly semantic: number;
  readonly height: number;
  readonly region: number;
  readonly featureId: number;
}

export function previewCellColor(input: PreviewCellColorInput): string {
  const [red, green, blue] = previewCellChannels(input);
  return `rgb(${red},${green},${blue})`;
}

export function previewCellChannels(input: PreviewCellColorInput): readonly [number, number, number, number] {
  const base = input.featureId >= 0
    ? "#d6a958"
    : blendRegionTint(semanticColor(input.semantic), input.region);
  const brightness = Math.max(0.45, Math.min(1.2, 0.75 + input.height * 0.12));
  const [red = 0, green = 0, blue = 0] = adjustedChannels(base, brightness);
  return [red, green, blue, 255];
}

function semanticColor(semantic: number): string {
  if (semantic === FLOOR_SEMANTIC.RoomWall) return "#626d7c";
  if (semantic === FLOOR_SEMANTIC.Room) return "#5b83ad";
  if (semantic === FLOOR_SEMANTIC.Corridor) return "#31506d";
  if (semantic === FLOOR_SEMANTIC.Transition) return "#d6a958";
  if (semantic >= FLOOR_SEMANTIC.SpawnExterior && semantic <= FLOOR_SEMANTIC.BossArena) return "#b96a68";
  return "#182332";
}

function blendRegionTint(base: string, region: number): string {
  if (region <= 0) return base;
  const tint = ["#2c75a8", "#4f8a68", "#8067a6", "#a27443"][region % 4] ?? "#2c75a8";
  return blendColors(base, tint, 0.2);
}

function blendColors(first: string, second: string, amount: number): string {
  const left = colorChannels(first);
  const right = colorChannels(second);
  const channels = left.map((channel, index) => Math.round(channel * (1 - amount) + (right[index] ?? channel) * amount));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function colorChannels(hex: string): number[] {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function adjustedChannels(hex: string, multiplier: number): number[] {
  const channels = colorChannels(hex);
  return channels.map((channel) => Math.min(255, Math.round(channel * multiplier)));
}
