/** Owns the Three mesh used to display authoritative remote actor effects. */
import * as THREE from "three";
import { remoteActorEffects } from "./remoteActorEffects.js";

export interface RemoteActorAura {
  object: {
    geometry: { dispose(): void };
    material: {
      color: { set(value: string): void };
      opacity: number;
      dispose(): void;
    };
    position: { y: number };
    rotation: { x: number };
    visible: boolean;
  };
}

export const createRemoteActorAura = (
  enemy: boolean,
): RemoteActorAura => {
  const object = new THREE.Mesh(
    new THREE.RingGeometry(0.25, 0.31, 24),
    new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  ) as RemoteActorAura["object"];
  object.rotation.x = -Math.PI / 2;
  object.position.y = enemy ? -0.48 : 0.025;
  object.visible = false;
  return { object };
};

export const syncRemoteActorAura = (
  aura: RemoteActorAura,
  snapshot: {
    fx?: string[] | undefined;
    blocking?: boolean | undefined;
    downed?: boolean | undefined;
  },
): void => {
  const effects = remoteActorEffects(
    snapshot.fx,
    snapshot.blocking,
    snapshot.downed,
  );
  aura.object.visible = effects.visible;
  aura.object.material.color.set(effects.color);
  aura.object.material.opacity = effects.opacity;
};

export const disposeRemoteActorAura = (aura: RemoteActorAura): void => {
  aura.object.geometry.dispose();
  aura.object.material.dispose();
};
