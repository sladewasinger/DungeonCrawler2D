import { World } from "@dc2d/engine";
import { ThreeActionController } from "./ThreeActionController.js";
import { ThreeFirstPersonViewport } from "../viewport/ThreeFirstPersonViewport.js";
import { SharedHtmlHud } from "../../ui/hud/core/SharedHtmlHud.js";
import { ThreeInput } from "../input/ThreeInput.js";
import { enableMobileDisplay } from "../viewport/ThreeMobileDisplay.js";
import type { FirstPersonState } from "../input/movement.js";
import { ThreeTerrain } from "../terrain/core/ThreeTerrain.js";
import { queryRouteNumber, queryViewDistance, type ThreeRouteOptions } from "./threeRouteConfig.js";
import type { ViewDistance } from "../terrain/view/viewDistance.js";
import { findWalkable } from "../world/entities/worldSearch.js";

export interface ThreeDungeonSetup {
  world: World;
  viewport: ThreeFirstPersonViewport;
  hud: SharedHtmlHud;
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
  const hudRef: { current: SharedHtmlHud | null } = { current: null };
  const actions = new ThreeActionController(options.conn, {
    toggleCraft: () => hudRef.current?.toggleCraft(),
    toggleStash: () => hudRef.current?.toggleStash() ?? false,
  });
  const hud = new SharedHtmlHud({
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
