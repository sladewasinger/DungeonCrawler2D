import { World } from "@dc2d/engine";
import { ThreeActionController } from "./ThreeActionController.js";
import { ThreeFirstPersonViewport } from "./ThreeFirstPersonViewport.js";
import { ThreeHud } from "./ThreeHud.js";
import { ThreeInput } from "./ThreeInput.js";
import { enableMobileDisplay } from "./ThreeMobileDisplay.js";
import type { FirstPersonState } from "./movement.js";
import { ThreeTerrain } from "./ThreeTerrain.js";
import { queryRouteNumber, queryViewDistance, type ThreeRouteOptions } from "./threeRouteConfig.js";
import type { ViewDistance } from "./viewDistance.js";
import { findWalkable } from "./worldSearch.js";

export interface ThreeDungeonSetup {
  world: World;
  viewport: ThreeFirstPersonViewport;
  hud: ThreeHud;
  actions: ThreeActionController;
  input: ThreeInput;
  terrain: ThreeTerrain;
  releaseMobileDisplay(): void;
  terrainOrigin: { x: number; z: number };
  viewDistance: ViewDistance;
  state: FirstPersonState;
}

export const createThreeDungeonSetup = (
  options: ThreeRouteOptions,
  setViewDistance: (viewDistance: ViewDistance) => void,
): ThreeDungeonSetup => {
  const world = new World(queryRouteNumber(options.search, "seed", 228182761), queryRouteNumber(options.search, "floor", 1));
  const viewDistance = queryViewDistance(options.search);
  const spawn = findWalkable({ world, origin: { x: 0, z: 0 } });
  const state = { x: spawn.x, y: spawn.height, z: spawn.z, verticalVelocity: 0, grounded: true };
  const viewport = new ThreeFirstPersonViewport(spawn, viewDistance);
  options.root.replaceChildren(viewport.renderer.domElement);
  const releaseMobileDisplay = enableMobileDisplay(options.root);
  const input = new ThreeInput(options.root, viewport.renderer.domElement);
  const hudRef: { current: ThreeHud | null } = { current: null };
  const actions = new ThreeActionController(options.conn, {
    toggleCraft: () => hudRef.current?.toggleCraft(),
    toggleStash: () => hudRef.current?.toggleStash() ?? false,
  });
  const hud = new ThreeHud({
    root: options.root, connection: options.conn, focusGame: () => input.focusGame(),
    viewDistance, setViewDistance, onSelectHotbar: actions.selectHotbar,
    session: { respawn: () => options.conn.suicide(), quitToTitle: options.onQuitToTitle },
  });
  hudRef.current = hud;
  const setup = {
    world, viewport, hud, actions, input, releaseMobileDisplay, viewDistance, state,
    terrain: new ThreeTerrain(world, viewport.scene, viewDistance),
    terrainOrigin: { x: Math.floor(spawn.x), z: Math.floor(spawn.z) },
  };
  input.setGameplayBlocked(() => hud.blocksGameplay());
  return setup;
};
