import type { World } from "@dc2d/engine";
import { ThreeActionController } from "./ThreeActionController.js";
import { ThreeFirstPersonViewport } from "../viewport/ThreeFirstPersonViewport.js";
import { SharedHtmlHud } from "../../ui/hud/core/SharedHtmlHud.js";
import { ThreeInput } from "../input/ThreeInput.js";
import { enableMobileDisplay } from "../viewport/ThreeMobileDisplay.js";
import type { FirstPersonState } from "../input/movement.js";
import { ThreeTerrain } from "../terrain/core/ThreeTerrain.js";
import { queryViewDistance, type ThreeRouteOptions } from "./threeRouteConfig.js";
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
  const world = readyConnectionWorld(options);
  const viewDistance = queryViewDistance(options.search);
  const spawn = spawnForReadyConnection(options.conn, world);
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
    session: {
      respawn: () => options.conn.suicide(),
      rescue: () => options.conn.rescue(),
      quitToTitle: options.onQuitToTitle,
    },
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

function readyConnectionWorld(options: ThreeRouteOptions): World {
  const world = options.conn.world;
  if (world) return world;
  throw new Error("Three dungeon setup requires a ready connection world");
}

function spawnForReadyConnection(
  connection: ThreeRouteOptions["conn"],
  world: World,
): { x: number; z: number; height: number } {
  const body = connection.body;
  if (body) return { x: body.x, z: body.y, height: body.z };
  return findWalkable({ world, origin: { x: 0, z: 0 } });
}
