import { describe, expect, it } from "vitest";
import { areaVisualDepthsForRow } from "../presentation/areaVisualDepth.js";
import {
  activateAreaEmitters,
  type AreaEmitterControl,
} from "./areaEmitterLifecycle.js";

class LayerProbe implements AreaEmitterControl {
  depth = 0;
  active = false;
  visible = false;
  starts = 0;

  setPosition(): this { return this; }
  setDepth(depth: number): this { this.depth = depth; return this; }
  setActive(active: boolean): this { this.active = active; return this; }
  setVisible(visible: boolean): this { this.visible = visible; return this; }
  start(): this { this.starts++; return this; }
  stop(): this { return this; }
  killAll(): this { return this; }
  destroy(): void {}
}

describe("active fire particle layers", () => {
  it("keeps all three emitters running above the layered flame stack", () => {
    const depths = areaVisualDepthsForRow(12);
    const emitters = [new LayerProbe(), new LayerProbe(), new LayerProbe()];
    activateAreaEmitters(emitters, {
      screen: { x: 20, y: 30 },
      depth: depths.cloud,
    }, true);
    for (const emitter of emitters) {
      expect(emitter).toMatchObject({
        active: true,
        visible: true,
        starts: 1,
        depth: depths.cloud,
      });
      expect(emitter.depth).toBeGreaterThan(depths.fireCore);
    }
  });
});
