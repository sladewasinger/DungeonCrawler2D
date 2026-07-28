/* eslint-disable max-lines -- frame-loop ownership requires a cohesive client facade. */
/** Owns Three.js client composition, lifecycle, frame order, and renderer configuration. */
import type { World } from "@dc2d/engine";
import { ThreeActionController } from "./ThreeActionController.js";
import { ThreeFirstPersonViewport } from "../viewport/ThreeFirstPersonViewport.js";
import { SharedHtmlHud } from "../../ui/hud/core/SharedHtmlHud.js";
import { ThreeInput } from "../input/ThreeInput.js";
import { advanceInputClock, firstPersonMoveInput } from "../viewport/firstPersonNetworking.js";
import { presentFirstPerson } from "../viewport/firstPersonPresentation.js";
import type { FirstPersonState } from "../input/movement.js";
import { ThreeTerrain } from "../terrain/core/ThreeTerrain.js";
import { needsTerrainRefresh } from "../terrain/core/terrainStreaming.js";
import type { ThreeRouteOptions } from "./threeRouteConfig.js";
import type { ViewDistance } from "../terrain/view/viewDistance.js";
import { createThreeDungeonSetup } from "./ThreeDungeonClientSetup.js";

export const startThreeDungeon = (options: ThreeRouteOptions) => new ThreeDungeonClient(options).start();

class ThreeDungeonClient {
  private world: World;
  private readonly viewport: ThreeFirstPersonViewport;
  private readonly hud: SharedHtmlHud;
  private readonly actions: ThreeActionController;
  private readonly input: ThreeInput;
  private terrain: ThreeTerrain;
  private readonly releaseMobileDisplay: () => void;
  private terrainOrigin: { x: number; z: number };
  private viewDistance: ViewDistance;
  private state: FirstPersonState;
  private previousTime = performance.now();
  private frame = 0;
  private inputClock = 0;
  private terrainRevision: number;
  private active = false;

  constructor(private readonly options: ThreeRouteOptions) {
    const setup = createThreeDungeonSetup(options, this.setViewDistance);
    this.world = setup.world;
    this.viewport = setup.viewport;
    this.hud = setup.hud;
    this.actions = setup.actions;
    this.input = setup.input;
    this.terrain = setup.terrain;
    this.releaseMobileDisplay = setup.releaseMobileDisplay;
    this.terrainOrigin = setup.terrainOrigin;
    this.viewDistance = setup.viewDistance;
    this.state = setup.state;
    this.terrainRevision = setup.world.tileRevision;
  }

  start(): () => void {
    this.active = true;
    this.terrain.rebuild(this.terrainOrigin);
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("pagehide", this.dispose, { once: true });
    this.frame = requestAnimationFrame(this.tick);
    return this.stop;
  }

  private readonly resize = () => {
    this.viewport.resize(
      this.options.root.clientWidth,
      this.options.root.clientHeight,
      window.devicePixelRatio,
    );
  };

  private readonly tick = (time: number) => {
    if (!this.active) return;
    this.syncAuthoritativeWorld();
    const elapsed = this.elapsed(time);
    const sampled = this.input.sample(elapsed);
    this.actions.publish(this.world, sampled);
    this.publishInput(sampled.input, elapsed);
    this.syncPlayerPresentation(elapsed);
    this.refreshTerrain();
    const reducedMotion = this.options.root.dataset.reducedMotion === "true";
    this.terrain.update(time, reducedMotion);
    this.hud.update({ connection: this.options.conn, world: this.world, player: this.state, yaw: sampled.yaw, mouseCaptured: sampled.mouseCaptured, fps: elapsed > 0 ? 1 / elapsed : 0, latencyMs: this.options.conn.rttMs, giveUpHoldProgress: this.actions.giveUpHoldProgress() });
    this.viewport.render({
      connection: this.options.conn,
      world: this.world,
      state: this.state,
      pitch: sampled.pitch,
      yaw: sampled.yaw,
      elapsed,
      timeMs: time,
      reducedMotion,
    });
    this.frame = requestAnimationFrame(this.tick);
  };

  private elapsed(time: number): number {
    const seconds = Math.min(0.05, Math.max(0, (time - this.previousTime) / 1000));
    this.previousTime = time;
    return seconds;
  }

  private publishInput(input: Parameters<typeof firstPersonMoveInput>[0], elapsed: number): void {
    const clock = advanceInputClock(elapsed, this.inputClock);
    this.inputClock = clock.pending;
    const jumpPressed = this.input.consumeJumpPress();
    if (jumpPressed && clock.ticks === 0) {
      this.options.conn.sampleInput(firstPersonMoveInput({ ...input, jump: true }));
      return;
    }
    for (let tick = 0; tick < clock.ticks; tick += 1) {
      this.options.conn.sampleInput(firstPersonMoveInput({ ...input, jump: input.jump || (tick === 0 && jumpPressed) }));
    }
  }

  private syncPlayerPresentation(elapsed: number): void {
    const body = this.options.conn.body;
    if (!body) return;
    const target = this.stateFromBody(body);
    if (this.options.conn.teleported) {
      this.state = target;
      this.options.conn.teleported = false;
      return;
    }
    this.state = presentFirstPerson(this.state, target, elapsed);
  }

  private refreshTerrain(): void {
    const origin = { x: Math.floor(this.state.x), z: Math.floor(this.state.z) };
    const tilesChanged = this.terrainRevision !== this.world.tileRevision;
    if (!tilesChanged &&
      !needsTerrainRefresh(this.terrainOrigin, origin, this.viewDistance)) return;
    this.terrainRevision = this.world.tileRevision;
    this.terrainOrigin = origin;
    this.terrain.rebuild(origin);
  }

  private syncAuthoritativeWorld(): void {
    const serverWorld = this.options.conn.world;
    if (!serverWorld || serverWorld === this.world) return;
    this.world = serverWorld;
    this.terrainRevision = this.world.tileRevision;
    this.terrain.dispose();
    this.terrain = new ThreeTerrain(
      this.world,
      this.viewport.scene,
      this.viewDistance,
    );
    const body = this.options.conn.body;
    if (body) this.state = this.stateFromBody(body);
    this.terrainOrigin = { x: Math.floor(this.state.x), z: Math.floor(this.state.z) };
    this.terrain.rebuild(this.terrainOrigin);
  }

  private stateFromBody(body: { x: number; y: number; z: number; zVel: number; grounded: boolean }): FirstPersonState {
    return { x: body.x, y: body.z, z: body.y, verticalVelocity: body.zVel, grounded: body.grounded };
  }

  private readonly setViewDistance = (viewDistance: ViewDistance) => {
    this.viewDistance = viewDistance;
    this.terrain.setViewRadius(viewDistance);
    this.terrain.rebuild(this.terrainOrigin);
    this.viewport.setViewDistance(viewDistance);
    this.resize();
  };

  private readonly stop = () => {
    cancelAnimationFrame(this.frame);
    this.dispose();
  };

  private readonly dispose = () => {
    if (!this.active) return;
    this.active = false;
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("pagehide", this.dispose);
    this.hud.dispose();
    this.input.dispose();
    this.terrain.dispose();
    this.viewport.dispose();
    this.releaseMobileDisplay();
    this.options.conn.disconnect();
  };
}
