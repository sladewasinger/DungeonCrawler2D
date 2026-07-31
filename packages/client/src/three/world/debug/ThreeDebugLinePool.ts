import type { AdminDebugPoint } from "../../../render/debug/adminDebugGeometry.js";
import * as THREE from "three";

const MAX_LINE_POINTS = 25;

type ThreeGroup = InstanceType<typeof THREE.Group>;
type ThreeLine = InstanceType<typeof THREE.Line>;
type ThreeMaterial = InstanceType<typeof THREE.LineBasicMaterial>;

/** Reuses bounded GPU line geometry and one material per diagnostic color. */
export class ThreeDebugLinePool {
  private readonly lines: ThreeLine[] = [];
  private readonly materials = new Map<number, ThreeMaterial>();
  private used = 0;

  constructor(
    private readonly group: ThreeGroup,
    private readonly capacity: number,
  ) {}

  beginFrame(): void {
    this.used = 0;
  }

  line(points: readonly AdminDebugPoint[], color: number, lift = 0.08): void {
    if (points.length < 2 || this.used >= this.capacity) return;
    const line = this.lineAt(this.used);
    this.used += 1;
    line.material = this.materialFor(color);
    updateLineGeometry(line, points, lift);
    line.visible = true;
  }

  endFrame(): void {
    for (let index = this.used; index < this.lines.length; index += 1) {
      this.lines[index]!.visible = false;
    }
  }

  dispose(): void {
    for (const line of this.lines) line.geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    for (const line of this.lines) line.removeFromParent();
    this.lines.length = 0;
    this.materials.clear();
  }

  private lineAt(index: number): ThreeLine {
    const existing = this.lines[index];
    if (existing) return existing;
    const line = createLine(this.materialFor(0xffffff));
    this.lines.push(line);
    this.group.add(line);
    return line;
  }

  private materialFor(color: number): ThreeMaterial {
    const existing = this.materials.get(color);
    if (existing) return existing;
    const material = new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.9, depthTest: false,
    });
    this.materials.set(color, material);
    return material;
  }
}

function createLine(material: ThreeMaterial): ThreeLine {
  const positions = new Float32Array(MAX_LINE_POINTS * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;
  line.visible = false;
  return line;
}

function updateLineGeometry(
  line: ThreeLine,
  points: readonly AdminDebugPoint[],
  lift: number,
): void {
  const count = Math.min(points.length, MAX_LINE_POINTS);
  const position = line.geometry.getAttribute("position");
  for (let index = 0; index < count; index += 1) {
    const point = points[index]!;
    position.setXYZ(index, point.x, point.z + lift, point.y);
  }
  position.needsUpdate = true;
  line.geometry.setDrawRange(0, count);
}
