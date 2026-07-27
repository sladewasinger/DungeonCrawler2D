/** Owns the Three camera, renderer, atmosphere, and replicated scene actors. */
import type { World } from "@dc2d/engine";
import type { Connection } from "../../net/connection/connection.js";
import * as THREE from "three";
import { FirstPersonCameraMotion } from "./FirstPersonCameraMotion.js";
import { ThreeAmbientMotes } from "../terrain/core/ThreeAmbientMotes.js";
import { ThreeAreaEffects } from "../terrain/core/ThreeAreaEffects.js";
import { ThreeRemoteActors } from "../world/actors/ThreeRemoteActors.js";
import { ThreeWorldEntities } from "../world/entities/ThreeWorldEntities.js";
import { safeCameraPosition, type PlanarPosition } from "./cameraSafety.js";
import type { FirstPersonState } from "../input/movement.js";
import { environmentProfile } from "../terrain/core/threeEnvironment.js";
import type { ViewDistance } from "../terrain/view/viewDistance.js";

const EYE_HEIGHT = 0.72;
const FOG_COLOR = "#07080d";

export interface ViewportFrame {
  connection: Connection;
  world: World;
  state: FirstPersonState;
  pitch: number;
  yaw: number;
  elapsed: number;
  timeMs: number;
  reducedMotion: boolean;
}

export class ThreeFirstPersonViewport {
  readonly scene = new THREE.Scene();
  readonly renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
  });
  private readonly camera = new THREE.PerspectiveCamera(74, 1, 0.04, 90);
  private readonly remoteActors: ThreeRemoteActors;
  private readonly worldEntities: ThreeWorldEntities;
  private readonly areaEffects: ThreeAreaEffects;
  private readonly ambientMotes: ThreeAmbientMotes;
  private readonly cameraMotion = new FirstPersonCameraMotion();
  private cameraPlanar: PlanarPosition;
  private viewDistance: ViewDistance;

  constructor(start: PlanarPosition, viewDistance: ViewDistance) {
    this.cameraPlanar = start;
    this.viewDistance = viewDistance;
    this.configureRenderer();
    this.configureScene();
    this.remoteActors = new ThreeRemoteActors(this.scene);
    this.worldEntities = new ThreeWorldEntities(this.scene);
    this.areaEffects = new ThreeAreaEffects(this.scene);
    this.ambientMotes = new ThreeAmbientMotes(this.scene);
    this.setViewDistance(viewDistance);
  }

  resize(width: number, height: number, devicePixelRatio: number): void {
    const pixelRatio = environmentProfile(this.viewDistance).maxPixelRatio;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, pixelRatio));
    this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
    this.camera.aspect = Math.max(1, width) / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  render(frame: ViewportFrame): void {
    this.updateCamera(frame);
    this.updateActors(frame);
    this.updateEffects(frame);
    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(frame: ViewportFrame): void {
    this.cameraPlanar = safeCameraPosition({
      world: frame.world,
      current: this.cameraPlanar,
      desired: frame.state,
    });
    const cameraOffset = this.cameraMotion.update({
      state: frame.state,
      elapsed: frame.elapsed,
      reducedMotion: frame.reducedMotion,
    });
    this.camera.position.set(
      this.cameraPlanar.x,
      frame.state.y + EYE_HEIGHT + cameraOffset,
      this.cameraPlanar.z,
    );
    this.camera.rotation.set(frame.pitch, frame.yaw, 0);
  }

  private updateActors(frame: ViewportFrame): void {
    const interpolated = frame.connection.interpolated(frame.timeMs);
    this.remoteActors.update(interpolated, frame.elapsed);
    this.worldEntities.update({
      interpolated,
      timeMs: frame.timeMs,
      reducedMotion: frame.reducedMotion,
      serverTick: frame.connection.serverTick,
      self: { x: frame.state.x, y: frame.state.z },
    });
  }

  private updateEffects(frame: ViewportFrame): void {
    this.areaEffects.update({
      connection: frame.connection,
      world: frame.world,
      timeMs: frame.timeMs,
      reducedMotion: frame.reducedMotion,
    });
    this.ambientMotes.update(
      frame.timeMs,
      this.camera.position,
      frame.reducedMotion,
    );
  }

  setViewDistance(viewDistance: ViewDistance): void {
    this.viewDistance = viewDistance;
    const profile = environmentProfile(viewDistance);
    this.scene.fog = new THREE.Fog(
      FOG_COLOR,
      profile.fogNear,
      profile.fogFar,
    );
    this.ambientMotes.setCount(profile.ambientMotes);
  }

  dispose(): void {
    this.remoteActors.dispose();
    this.worldEntities.dispose();
    this.areaEffects.dispose();
    this.ambientMotes.dispose();
    this.renderer.dispose();
  }

  private configureRenderer(): void {
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.domElement.style.cssText =
      "display:block;width:100%;height:100%;touch-action:none";
  }

  private configureScene(): void {
    this.scene.background = new THREE.Color(FOG_COLOR);
    this.camera.rotation.order = "YXZ";
    const ambient = new THREE.HemisphereLight("#65728d", "#0f0c16", 1.1);
    const moonlight = new THREE.DirectionalLight("#aebde0", 0.6);
    const playerLight = new THREE.PointLight("#fff0d2", 0.55, 3.2, 2);
    playerLight.position.set(0, -0.15, 0);
    this.camera.add(playerLight);
    moonlight.position.set(8, 14, 4);
    this.scene.add(ambient, moonlight, this.camera);
  }
}
