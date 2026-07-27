/** Resolves the label and distance-based alpha for one entity-nameplate state. */
export interface NameplatePresentation {
  label: string;
  alpha: number;
}

const NEAR_DISTANCE_TILES = 6;
const DIM_ALPHA = 0.45;
const NEAR_ALPHA = 0.85;

export interface NameplatePresentationInput {
  readonly name: string;
  readonly distanceTiles: number;
  readonly downed: boolean;
  readonly disconnected: boolean;
}

export function resolveNameplatePresentation({
  name,
  distanceTiles,
  downed,
  disconnected,
}: NameplatePresentationInput): NameplatePresentation {
  if (disconnected) return { label: `${name} Disconnected`, alpha: NEAR_ALPHA };
  if (downed) return { label: `${name} · DOWNED`, alpha: NEAR_ALPHA };
  return { label: name, alpha: distanceTiles <= NEAR_DISTANCE_TILES ? NEAR_ALPHA : DIM_ALPHA };
}
