/** Unified compile-time-exhaustive PropKind specification registry. */
import type { PropKind, PropSpec } from "@dc2d/contracts";
import { FLORA_AND_ROCK_PROP_SPECS } from "./propSpecsFlora.js";
import { STRUCTURE_AND_POI_PROP_SPECS } from "./propSpecsStructures.js";

const EXHAUSTIVE_PROP_SPECS = {
  ...FLORA_AND_ROCK_PROP_SPECS,
  ...STRUCTURE_AND_POI_PROP_SPECS,
} as const satisfies Record<PropKind, PropSpec>;

export const PROP_SPECS: Readonly<Record<PropKind, PropSpec>> = EXHAUSTIVE_PROP_SPECS;

export function getPropSpec(kind: PropKind): PropSpec {
  return PROP_SPECS[kind];
}
