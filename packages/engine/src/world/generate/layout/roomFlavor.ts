import type { Flavor, Rect } from "../types.js";
import { WORLD_GENERATION_TUNING } from "../tuning.js";
import { DISTRICT, type DistrictKind } from "./district.js";
import { rectH, rectW } from "./geometry.js";
import { rectHash } from "./hash.js";

const FLAVOR_TUNING = WORLD_GENERATION_TUNING.roomFlavor;
const GALLERY_ASPECT_RATIO =
  WORLD_GENERATION_TUNING.roomLayout.galleryAspectRatio;

interface DistrictBias {
  readonly kind: DistrictKind;
  readonly threshold: number;
  readonly flavor: Flavor;
  readonly minimumArea?: number;
}

interface ConfiguredFlavorBias {
  readonly threshold: number;
  readonly flavor: string;
  readonly minimumArea?: number;
}

const DISTRICT_BIASES: readonly DistrictBias[] = [
  districtBias(DISTRICT.PillarForest, FLAVOR_TUNING.districtBiases.pillarForest),
  districtBias(DISTRICT.Ruins, FLAVOR_TUNING.districtBiases.ruins),
  districtBias(DISTRICT.Plaza, FLAVOR_TUNING.districtBiases.plaza),
  districtBias(DISTRICT.Flooded, FLAVOR_TUNING.districtBiases.flooded),
  districtBias(DISTRICT.Arena, FLAVOR_TUNING.districtBiases.arena),
];

export function pickRoomFlavor(
  seed: number,
  rect: Rect,
  district: DistrictKind,
): Flavor {
  const width = rectW(rect);
  const height = rectH(rect);
  const area = width * height;
  const aspect = Math.max(width, height) / Math.max(1, Math.min(width, height));
  if (aspect >= GALLERY_ASPECT_RATIO) return "gallery";
  const roll = rectHash(seed, rect, 0x4a01) % 100;
  return districtFlavor(district, area, roll) ?? areaFlavor(area, roll);
}

function districtBias(
  kind: DistrictKind,
  configured: ConfiguredFlavorBias,
): DistrictBias {
  return {
    kind,
    threshold: configured.threshold,
    flavor: asFlavor(configured.flavor),
    ...(configured.minimumArea === undefined
      ? {}
      : { minimumArea: configured.minimumArea }),
  };
}

function districtFlavor(
  district: DistrictKind,
  area: number,
  roll: number,
): Flavor | null {
  const match = DISTRICT_BIASES.find((bias) =>
    bias.kind === district &&
    (bias.minimumArea === undefined || area >= bias.minimumArea) &&
    roll < bias.threshold);
  return match?.flavor ?? null;
}

function areaFlavor(area: number, roll: number): Flavor {
  const biases = FLAVOR_TUNING.areaBiases;
  if (matchesAreaBias(area, roll, biases.pillarHall)) return "pillarHall";
  if (matchesAreaBias(area, roll, biases.plaza)) return "plaza";
  if (matchesAreaBias(area, roll, biases.grotto)) return "grotto";
  return "chamber";
}

function matchesAreaBias(
  area: number,
  roll: number,
  bias: { readonly minimumArea: number; readonly threshold: number },
): boolean {
  return area >= bias.minimumArea && roll < bias.threshold;
}

function asFlavor(value: string): Flavor {
  if (value === "chamber" || value === "gallery" ||
      value === "pillarHall" || value === "plaza" ||
      value === "grotto") return value;
  throw new Error(`Invalid configured room flavor: ${value}`);
}
