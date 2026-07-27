import type { ContentRegistry, World } from "@dc2d/engine";
import type { PlayerStore } from "../store.js";
import type { SimState } from "./state.js";

export interface GameSimOptions {
  world: World;
  content: ContentRegistry;
  store?: PlayerStore;
  rngSeed?: number;
  opts?: SimState["opts"];
}
