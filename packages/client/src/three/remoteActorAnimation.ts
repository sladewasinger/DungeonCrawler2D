/** Selects and advances remote knight idle and running animation clips. */
import * as THREE from "three";

const RUN_SPEED = 0.12;

interface AnimationAction {
  play(): AnimationAction;
  reset(): AnimationAction;
  fadeIn(seconds: number): AnimationAction;
  fadeOut(seconds: number): AnimationAction;
}

export interface RemoteActorAnimation {
  mixer: { update(seconds: number): void };
  idle: AnimationAction;
  run: AnimationAction;
  current: "idle" | "run";
  x: number;
  z: number;
}

export interface AnimationModel {
  animations?: Array<{ name: string }>;
}

export interface AnimatedActor {
  position: { x: number; z: number };
}

export function createRemoteActorAnimation(
  object: AnimatedActor,
  model: AnimationModel | null,
): RemoteActorAnimation | undefined {
  const idleClip = model?.animations?.find((clip) => clip.name.startsWith("Idle"));
  const runClip = model?.animations?.find((clip) => clip.name === "Running");
  if (!idleClip || !runClip) return undefined;
  const mixer = new THREE.AnimationMixer(object as never);
  const idle = mixer.clipAction(idleClip).play() as unknown as AnimationAction;
  const run = mixer.clipAction(runClip) as unknown as AnimationAction;
  return { mixer, idle, run, current: "idle", x: object.position.x, z: object.position.z };
}

export function updateRemoteActorAnimation(
  animation: RemoteActorAnimation | undefined,
  x: number,
  z: number,
  elapsed: number,
): void {
  if (!animation) return;
  const speed = Math.hypot(x - animation.x, z - animation.z) / Math.max(elapsed, 0.001);
  const next = speed > RUN_SPEED ? "run" : "idle";
  if (next !== animation.current) swapAnimation(animation, next);
  animation.x = x;
  animation.z = z;
  animation.mixer.update(elapsed);
}

function swapAnimation(animation: RemoteActorAnimation, next: "idle" | "run"): void {
  const incoming = next === "run" ? animation.run : animation.idle;
  const outgoing = next === "run" ? animation.idle : animation.run;
  outgoing.fadeOut(0.12);
  incoming.reset().fadeIn(0.12).play();
  animation.current = next;
}
