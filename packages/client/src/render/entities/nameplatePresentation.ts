/** Resolves the label, color, and alpha for one player-nameplate state. */
export interface NameplatePresentation {
  label: string;
  color: string;
  alpha: number;
}

const NEAR_DISTANCE_TILES = 6;
const PARTY_COLOR = "#3dd6c3";
const STRANGER_COLOR = "#9a9aae";
const DOWNED_COLOR = "#e04a4a";
const DISCONNECTED_COLOR = "#777780";
const DIM_ALPHA = 0.35;
const NEAR_ALPHA = 0.95;

export function resolveNameplatePresentation(name: string, distanceTiles: number, isParty: boolean, downed: boolean, disconnected: boolean): NameplatePresentation {
  if (disconnected) return { label: `${name} Disconnected`, color: DISCONNECTED_COLOR, alpha: NEAR_ALPHA };
  if (downed) return { label: `${name} · DOWNED`, color: DOWNED_COLOR, alpha: NEAR_ALPHA };
  return { label: name, color: isParty ? PARTY_COLOR : STRANGER_COLOR, alpha: distanceTiles <= NEAR_DISTANCE_TILES ? NEAR_ALPHA : DIM_ALPHA };
}
