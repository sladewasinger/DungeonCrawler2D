import type {
  AdminDebugBox,
  AdminDebugPoint,
} from "./adminDebugGeometry.js";

/** Returns the exact closed world-horizontal base of an authored hurtbox. */
export function boxOutline(box: AdminDebugBox): AdminDebugPoint[] {
  const { center, halfWidth, halfDepth } = box;
  const z = center.z - box.bottomOffset;
  return [
    { x: center.x - halfWidth, y: center.y - halfDepth, z },
    { x: center.x + halfWidth, y: center.y - halfDepth, z },
    { x: center.x + halfWidth, y: center.y + halfDepth, z },
    { x: center.x - halfWidth, y: center.y + halfDepth, z },
    { x: center.x - halfWidth, y: center.y - halfDepth, z },
  ];
}

/** Exact upright hurtbox volume: base/top loops joined at all four corners. */
export function boxWireframe(box: AdminDebugBox): AdminDebugPoint[][] {
  const base = boxOutline(box);
  const top = base.map((point) => ({ ...point, z: point.z + box.height }));
  const corners = base.slice(0, 4).map((point) => [
    point,
    { ...point, z: point.z + box.height },
  ]);
  return [base, top, ...corners];
}
