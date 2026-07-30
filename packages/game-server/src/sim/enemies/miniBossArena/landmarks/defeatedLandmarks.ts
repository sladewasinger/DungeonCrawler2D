import {
  miniBossArenaKey,
  type DefeatedMiniBossArenaWindow,
} from "@dc2d/engine";
import type { PlayerSlot, SimState } from "../../../state/state.js";
import { defeatedMiniBossArenaRevision } from "../defeatedArenaState.js";
import { chunkAt, compassWindowChunks } from "./nearbyChunks.js";

interface CachedDefeatedArenaWindow {
  readonly floor: number;
  readonly revision: number;
  readonly value: DefeatedMiniBossArenaWindow;
}

interface DefeatedArenaWindowIdentity {
  readonly floor: number;
  readonly center: { readonly cx: number; readonly cy: number };
  readonly revision: number;
}

const cachedWindows = new WeakMap<PlayerSlot, CachedDefeatedArenaWindow>();

/** Complete authoritative defeat state for the receiver's bounded compass search. */
export function defeatedMiniBossArenaWindowForSlot(
  sim: SimState,
  slot: PlayerSlot,
): DefeatedMiniBossArenaWindow {
  const center = chunkAt(slot.entity.body);
  const revision = defeatedMiniBossArenaRevision(sim);
  const cached = cachedWindows.get(slot);
  if (cachedWindowMatches(cached, {
    floor: sim.world.floor,
    center,
    revision,
  })) {
    return cached.value;
  }
  const value = {
    center,
    arenas: compassWindowChunks(center)
      .filter(({ cx, cy }) => sim.defeatedMiniBossArenas.has(miniBossArenaKey({
        floor: sim.world.floor,
        cx,
        cy,
      }))),
  };
  cachedWindows.set(slot, { floor: sim.world.floor, revision, value });
  return value;
}

function cachedWindowMatches(
  cached: CachedDefeatedArenaWindow | undefined,
  identity: DefeatedArenaWindowIdentity,
): cached is CachedDefeatedArenaWindow {
  return cached !== undefined &&
    cached.floor === identity.floor &&
    cached.revision === identity.revision &&
    cached.value.center.cx === identity.center.cx &&
    cached.value.center.cy === identity.center.cy;
}
