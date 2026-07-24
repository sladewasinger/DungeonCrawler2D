/** Owns Three.js client composition, lifecycle, frame order, and renderer configuration. */
import { World } from "@dc2d/engine";
import type { Connection } from "../net/connection.js";
import * as THREE from "three";
import { ThreeHud } from "./ThreeHud.js";
import { ThreeInput } from "./ThreeInput.js";
import { enableMobileDisplay } from "./ThreeMobileDisplay.js";
import { ThreeRemoteActors } from "./ThreeRemoteActors.js";
import { advanceInputClock, firstPersonMoveInput } from "./firstPersonNetworking.js";
import { presentFirstPerson } from "./firstPersonPresentation.js";
import type { FirstPersonState } from "./movement.js";
import { DEFAULT_TERRAIN_VIEW_RADIUS, ThreeTerrain } from "./ThreeTerrain.js";
import { needsTerrainRefresh } from "./terrainStreaming.js";
import { isViewDistance, type ViewDistance } from "./viewDistance.js";
import { findWalkable } from "./worldSearch.js";

const EYE_HEIGHT = 0.72;
const FOG_COLOR = "#07080d";
const FOG_NEAR = 14;

interface ThreeRouteOptions {
  conn: Connection;
  root: HTMLElement;
  search: URLSearchParams;
}

const queryNumber = (search: URLSearchParams, key: string, fallback: number) => {
  const value = Number(search.get(key));
  return Number.isFinite(value) ? value : fallback;
};

const queryViewDistance = (search: URLSearchParams): ViewDistance => {
  const value = queryNumber(search, "viewDistance", DEFAULT_TERRAIN_VIEW_RADIUS);
  return isViewDistance(value) ? value : DEFAULT_TERRAIN_VIEW_RADIUS;
};

export const startThreeDungeon = (options: ThreeRouteOptions) => new ThreeDungeonClient(options).start();

class ThreeDungeonClient {
  private world: World;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(74, 1, 0.05, 90);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  private readonly hud: ThreeHud;
  private readonly input: ThreeInput;
  private terrain: ThreeTerrain;
  private readonly remoteActors: ThreeRemoteActors;
  private readonly releaseMobileDisplay: () => void;
  private terrainOrigin: { x: number; z: number };
  private viewDistance: ViewDistance;
  private state: FirstPersonState;
  private previousTime = performance.now();
  private frame = 0;
  private inputClock = 0;
  private active = false;

  constructor(private readonly options: ThreeRouteOptions) {
    this.world = new World(queryNumber(options.search, "seed", 228182761), queryNumber(options.search, "floor", 1));
    this.viewDistance = queryViewDistance(options.search);
    const spawn = findWalkable(this.world, 0, 0);
    this.state = { x: spawn.x, y: spawn.height, z: spawn.z, verticalVelocity: 0, grounded: true };
    this.terrainOrigin = { x: Math.floor(spawn.x), z: Math.floor(spawn.z) };
    this.configureRenderer();
    options.root.replaceChildren(this.renderer.domElement);
    this.releaseMobileDisplay = enableMobileDisplay(options.root);
    this.input = new ThreeInput(options.root, this.renderer.domElement);
    this.hud = new ThreeHud({
      root: options.root,
      connection: options.conn,
      focusGame: () => this.input.focusGame(),
      viewDistance: this.viewDistance,
      setViewDistance: this.setViewDistance,
    });
    this.terrain = new ThreeTerrain(this.world, this.scene, this.viewDistance);
    this.configureScene();
    this.remoteActors = new ThreeRemoteActors(this.scene);
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

  private configureRenderer(): void {
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none";
  }

  private configureScene(): void {
    this.scene.background = new THREE.Color(FOG_COLOR);
    this.applyFogDistance();
    this.camera.rotation.order = "YXZ";
    const ambient = new THREE.HemisphereLight("#65728d", "#0f0c16", 1.1);
    const moonlight = new THREE.DirectionalLight("#aebde0", 0.6);
    moonlight.position.set(8, 14, 4);
    this.scene.add(ambient, moonlight);
  }

  private readonly resize = () => {
    const width = Math.max(1, this.options.root.clientWidth);
    const height = Math.max(1, this.options.root.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private readonly tick = (time: number) => {
    if (!this.active) return;
    this.syncAuthoritativeWorld();
    const elapsed = this.elapsed(time);
    const sampled = this.input.sample(elapsed);
    this.publishActions(sampled.yaw, sampled.attack, sampled.interact, sampled.giveUp);
    this.publishInput(sampled.input, elapsed);
    this.syncPlayerPresentation(elapsed);
    this.refreshTerrain();
    this.camera.position.set(this.state.x, this.state.y + EYE_HEIGHT, this.state.z);
    this.camera.rotation.set(sampled.pitch, sampled.yaw, 0);
    this.terrain.update(time);
    this.remoteActors.update(this.options.conn, elapsed);
    this.hud.update({ connection: this.options.conn, world: this.world, player: this.state, yaw: sampled.yaw, mouseCaptured: sampled.mouseCaptured });
    this.renderer.render(this.scene, this.camera);
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

  private publishActions(yaw: number, attack: boolean, interact: boolean, giveUp: boolean): void {
    if (attack) this.options.conn.attack(-Math.sin(yaw), -Math.cos(yaw));
    if (interact) this.options.conn.interact();
    if (giveUp && this.options.conn.downed) this.options.conn.suicide();
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
    if (!needsTerrainRefresh(this.terrainOrigin, origin, this.viewDistance)) return;
    this.terrainOrigin = origin;
    this.terrain.rebuild(origin);
  }

  private syncAuthoritativeWorld(): void {
    const serverWorld = this.options.conn.world;
    if (!serverWorld || serverWorld === this.world) return;
    this.world = serverWorld;
    this.terrain.dispose();
    this.terrain = new ThreeTerrain(this.world, this.scene, this.viewDistance);
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
    this.applyFogDistance();
  };

  private applyFogDistance(): void {
    this.scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, this.viewDistance + 2);
  }

  private readonly stop = () => {
    cancelAnimationFrame(this.frame);
    this.dispose();
  };

  private readonly dispose = () => {
    if (!this.active) return;
    this.active = false;
    window.removeEventListener("resize", this.resize);
    this.input.dispose();
    this.terrain.dispose();
    this.remoteActors.dispose();
    this.releaseMobileDisplay();
    this.options.conn.disconnect();
    this.renderer.dispose();
  };
}
