import { expect, it } from "vitest";
import { GenerationPreviewController } from "../generationPreviewController.js";
import {
  DeferredRunner, controls, previewCanvas, result, routeOverlay,
} from "./generationPreviewControllerSupport.js";

it("redraws the local stage delta without regenerating the trace", async () => {
  const runner = new DeferredRunner();
  const delta = routeOverlay();
  delta.checked = true;
  const clearCalls: number[] = [];
  const controller = new GenerationPreviewController({
    controls: controls(undefined, delta),
    canvas: previewCanvas({ clearCalls, pointerMove: { current: undefined } }),
    runner,
  });
  controller.generate();
  runner.jobs[0]?.resolve(result("region-connectivity"));
  await Promise.resolve();
  await Promise.resolve();
  const drawsBeforeToggle = clearCalls.length;
  delta.checked = false;
  delta.change();
  expect(clearCalls.length).toBeGreaterThan(drawsBeforeToggle);
  expect(runner.jobs).toHaveLength(1);
  controller.dispose();
});
