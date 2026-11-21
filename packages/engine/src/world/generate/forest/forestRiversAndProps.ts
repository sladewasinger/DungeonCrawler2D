import { ensureForestConnectivity } from "./forestConnectivity.js";
import { placeForestProps } from "./forestProps.js";
import { placeForestRivers, type ForestLayoutInput } from "./forestRivers.js";

export type { ForestLayoutInput } from "./forestRivers.js";

export function applyForestRiversAndProps(input: ForestLayoutInput): void {
  placeForestRivers(input);
  placeForestProps(input);
  ensureForestConnectivity({
    buffers: input.buffers,
    bounds: input.bounds,
    spawn: input.spawn,
    sealedArenas: input.sealedArenas,
  });
}
