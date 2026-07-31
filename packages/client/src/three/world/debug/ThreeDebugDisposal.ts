import * as THREE from "three";

type ThreeGroup = InstanceType<typeof THREE.Group>;
type ThreeObject = InstanceType<typeof THREE.Object3D>;

interface DisposableMaterial {
  dispose(): void;
  map?: { dispose(): void };
}

interface DisposableNode {
  readonly material: DisposableMaterial | DisposableMaterial[];
  readonly geometry?: { dispose(): void };
}

export function disposeDebugGroup(group: ThreeGroup): void {
  for (const child of [...group.children]) disposeObject(child as ThreeObject);
  group.clear();
}

function disposeObject(object: ThreeObject): void {
  object.traverse((node: unknown) => disposeNode(node));
}

function disposeNode(node: unknown): void {
  if (!isDisposableNode(node)) return;
  node.geometry?.dispose();
  disposeMaterial(node.material);
}

function isDisposableNode(value: unknown): value is DisposableNode {
  return typeof value === "object" && value !== null && "material" in value;
}

function disposeMaterial(material: DisposableMaterial | DisposableMaterial[] | undefined): void {
  for (const item of Array.isArray(material) ? material : material ? [material] : []) {
    item.map?.dispose();
    item.dispose();
  }
}
