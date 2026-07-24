/** Applies reconnect state to a Three actor's model materials and disconnected label. */
import * as THREE from "three";
import {
  applyRemoteActorPresentation,
  remoteActorPresentation,
  type RemoteActorMaterialView,
  type RemoteActorLabelView,
} from "./remoteActorPresentation.js";

export interface ReconnectActor {
  add(...objects: unknown[]): void;
  traverse(callback: (node: ReconnectNode) => void): void;
}

export interface ReconnectNode {
  isMesh?: boolean;
  material?: unknown;
  userData: Record<string, unknown>;
}

export interface ReconnectMaterial extends RemoteActorMaterialView {
  clone(): ReconnectMaterial;
}

export interface DisconnectedActorLabel extends RemoteActorLabelView {
  parent?: unknown;
  position: { set(x: number, y: number, z: number): void };
  scale: { set(x: number, y: number, z: number): void };
}

export function syncReconnectPresentation(
  actor: ReconnectActor,
  existingLabel: DisconnectedActorLabel | undefined,
  disconnected: boolean,
  height: number,
): DisconnectedActorLabel {
  const label = existingLabel ?? createDisconnectedLabel(height);
  actor.traverse((node) => applyReconnectMaterial(node, label, disconnected));
  if (!label.parent) actor.add(label);
  label.visible = remoteActorPresentation(disconnected).labelVisible;
  return label;
}

function applyReconnectMaterial(
  node: ReconnectNode,
  label: DisconnectedActorLabel,
  disconnected: boolean,
): void {
  if (!node.isMesh) return;
  applyRemoteActorPresentation(actorMaterial(node), label, disconnected);
}

function actorMaterial(node: ReconnectNode): ReconnectMaterial {
  const stored = node.userData.reconnectMaterial as ReconnectMaterial | undefined;
  if (stored) return stored;
  const source = Array.isArray(node.material) ? node.material[0] : node.material;
  const material = isReconnectMaterial(source)
    ? source.clone()
    : new THREE.MeshStandardMaterial({ color: "#ffffff" });
  node.material = material;
  node.userData.reconnectMaterial = material;
  return material;
}

function createDisconnectedLabel(height: number): DisconnectedActorLabel {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 48;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create disconnected actor label.");
  context.font = "bold 28px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#b6b6bf";
  context.fillText("DISCONNECTED", canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  label.position.set(0, height + 0.25, 0);
  label.scale.set(1.5, 0.28, 1);
  return label as unknown as DisconnectedActorLabel;
}

function isReconnectMaterial(value: unknown): value is ReconnectMaterial {
  return typeof value === "object" && value !== null && "clone" in value && "color" in value && "emissive" in value;
}
