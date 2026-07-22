/** Owns remote-player models driven by interpolated authoritative connection snapshots. */
import type { Connection } from "../net/connection.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { remoteActorPose } from "./remoteActorPose.js";
import { createEnemyTexture } from "./threeVisuals.js";

const KNIGHT_MODEL_URL = "/assets/three-models/Knight_Animated.fbx";
const KNIGHT_TEXTURE_URL = "/assets/three-models/Texture.png";
const KNIGHT_HEIGHT = 1.1;
const RUN_SPEED = 0.12;

interface ActorObject {
  position: { x: number; y: number; z: number; set(x: number, y: number, z: number): void };
  rotation: { x: number; y: number; z: number };
  scale: { setScalar(value: number): void };
  add(...objects: ActorObject[]): void;
}

interface KnightMesh {
  isMesh?: boolean;
  material?: unknown;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

interface KnightClip {
  name: string;
}

interface KnightModel extends ActorObject {
  animations?: KnightClip[];
  updateMatrixWorld(force?: boolean): void;
  traverse(callback: (object: KnightMesh) => void): void;
}

interface AnimationAction {
  play(): AnimationAction;
  reset(): AnimationAction;
  fadeIn(seconds: number): AnimationAction;
  fadeOut(seconds: number): AnimationAction;
}

interface ActorAnimation {
  mixer: { update(seconds: number): void };
  idle: AnimationAction;
  run: AnimationAction;
  current: "idle" | "run";
  x: number;
  z: number;
}

type VisibleKind = "player" | "enemy";

interface ActiveActor {
  object: ActorObject;
  kind: VisibleKind;
  animation?: ActorAnimation | undefined;
}

export class ThreeRemoteActors {
  private readonly group = new THREE.Group();
  private readonly actors = new Map<string, ActiveActor>();
  private readonly enemyTexture = createEnemyTexture();
  private readonly enemyMaterial = new THREE.SpriteMaterial({ map: this.enemyTexture, transparent: true, depthWrite: false });
  private readonly knightTexture = new THREE.TextureLoader().load(KNIGHT_TEXTURE_URL);
  private readonly knightMaterial = new THREE.MeshStandardMaterial({ map: this.knightTexture, roughness: 0.78, metalness: 0.04 });
  private template: KnightModel | null = null;

  constructor(scene: { add(...objects: unknown[]): void }) {
    this.knightTexture.colorSpace = THREE.SRGBColorSpace;
    scene.add(this.group);
    this.loadTemplate();
  }

  update(connection: Connection, elapsed: number): void {
    const active = new Set<string>();
    for (const actor of connection.interpolated(100)) {
      const kind = visibleKind(actor.snap.kind);
      if (!kind) continue;
      active.add(actor.id);
      this.syncActor(actor.id, actor, kind, elapsed);
    }
    for (const [id, actor] of this.actors) if (!active.has(id)) this.removeActor(id, actor.object);
  }

  dispose(): void {
    this.group.removeFromParent();
    this.actors.clear();
    this.enemyTexture.dispose();
    this.enemyMaterial.dispose();
    this.knightTexture.dispose();
    this.knightMaterial.dispose();
  }

  private loadTemplate(): void {
    new FBXLoader().load(KNIGHT_MODEL_URL, (model) => this.setTemplate(this.prepareTemplate(model as KnightModel)), undefined, () => undefined);
  }

  private prepareTemplate(model: KnightModel): KnightModel {
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model as never);
    const height = bounds.max.y - bounds.min.y;
    if (height > 0) {
      const scale = KNIGHT_HEIGHT / height;
      model.scale.setScalar(scale);
      model.position.y = -bounds.min.y * scale;
    }
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.material = this.knightMaterial;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    return model;
  }

  private setTemplate(template: KnightModel): void {
    this.template = template;
    for (const [id, actor] of this.actors) if (actor.kind === "player") this.replaceFallback(id, actor.object);
  }

  private syncActor(
    id: string,
    player: ReturnType<Connection["interpolated"]>[number],
    kind: VisibleKind,
    elapsed: number,
  ): void {
    const active = this.actors.get(id) ?? this.addActor(id, kind);
    const pose = remoteActorPose(player);
    active.object.position.set(pose.x, pose.y + (kind === "enemy" ? 0.5 : 0), pose.z);
    active.object.rotation.y = pose.yaw;
    this.updateAnimation(active.animation, pose.x, pose.z, elapsed);
  }

  private addActor(id: string, kind: VisibleKind): ActiveActor {
    const object = this.createActor(kind);
    const active: ActiveActor = { object, kind, ...(kind === "player" ? { animation: this.createAnimation(object) } : {}) };
    this.group.add(object);
    this.actors.set(id, active);
    return active;
  }

  private createActor(kind: VisibleKind): ActorObject {
    if (kind === "enemy") return this.createEnemySprite();
    if (this.template) return cloneSkinned(this.template as never) as unknown as ActorObject;
    return this.createFallback();
  }

  private createAnimation(object: ActorObject): ActorAnimation | undefined {
    const clips = this.template?.animations;
    const idleClip = clips?.find((clip) => clip.name.startsWith("Idle"));
    const runClip = clips?.find((clip) => clip.name === "Running");
    if (!idleClip || !runClip) return undefined;
    const mixer = new THREE.AnimationMixer(object as never);
    const idle = mixer.clipAction(idleClip as never).play() as unknown as AnimationAction;
    const run = mixer.clipAction(runClip as never) as unknown as AnimationAction;
    return { mixer, idle, run, current: "idle", x: object.position.x, z: object.position.z };
  }

  private updateAnimation(animation: ActorAnimation | undefined, x: number, z: number, elapsed: number): void {
    if (!animation) return;
    const seconds = Math.max(elapsed, 0.001);
    const speed = Math.hypot(x - animation.x, z - animation.z) / seconds;
    const next = speed > RUN_SPEED ? "run" : "idle";
    if (next !== animation.current) {
      const incoming = next === "run" ? animation.run : animation.idle;
      const outgoing = next === "run" ? animation.idle : animation.run;
      outgoing.fadeOut(0.12);
      incoming.reset().fadeIn(0.12).play();
      animation.current = next;
    }
    animation.x = x;
    animation.z = z;
    animation.mixer.update(elapsed);
  }

  private createFallback(): ActorObject {
    return new THREE.Mesh(
      new THREE.CapsuleGeometry(0.2, 0.55, 4, 8),
      new THREE.MeshStandardMaterial({ color: "#d8b38b", emissive: "#563d2c", emissiveIntensity: 0.3 }),
    );
  }

  private createEnemySprite(): ActorObject {
    const sprite = new THREE.Sprite(this.enemyMaterial);
    sprite.scale.set(0.74, 0.99, 1);
    return sprite;
  }

  private replaceFallback(id: string, actor: ActorObject): void {
    this.group.remove(actor);
    const replacement = this.addActor(id, "player");
    replacement.object.position.set(actor.position.x, actor.position.y, actor.position.z);
    replacement.object.rotation.x = actor.rotation.x;
    replacement.object.rotation.y = actor.rotation.y;
    replacement.object.rotation.z = actor.rotation.z;
  }

  private removeActor(id: string, actor: ActorObject): void {
    this.group.remove(actor);
    this.actors.delete(id);
  }
}

const visibleKind = (kind: string): VisibleKind | null => {
  if (kind === "player" || kind === "enemy") return kind;
  return null;
};
