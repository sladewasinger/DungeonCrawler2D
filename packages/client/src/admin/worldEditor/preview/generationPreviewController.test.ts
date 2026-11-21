import { describe, expect, it } from "vitest";
import { GenerationPreviewController } from "./generationPreviewController.js";
import { GenerationPreviewBudgetError } from "./trace/generationTraceRunner.js";
import { DeferredRunner, controls, previewCanvas, result, routeOverlay, stagedHoverResult } from "./tests/generationPreviewControllerSupport.js";

const EMPTY_PREVIEW = "No usable preview.";

describe("generation preview controller", () => {
  it("redraws a local route overlay without regenerating the trace", async () => {
    const runner = new DeferredRunner();
    const overlay = routeOverlay();
    const clearCalls: number[] = [];
    const controller = new GenerationPreviewController({
      controls: controls(overlay),
      canvas: previewCanvas({ clearCalls, pointerMove: { current: undefined } }),
      runner,
    });
    controller.generate();
    runner.jobs[0]?.resolve(result("region-connectivity"));
    await Promise.resolve();
    await Promise.resolve();
    const drawsBeforeToggle = clearCalls.length;
    overlay.checked = true;
    overlay.change();
    expect(clearCalls.length).toBeGreaterThan(drawsBeforeToggle);
    expect(runner.jobs).toHaveLength(1);
    controller.dispose();
  });

  it("ignores a stale trace after a newer request", async () => {
    const runner = new DeferredRunner();
    const control = controls();
    const controller = new GenerationPreviewController({
      controls: control,
      canvas: previewCanvas({ clearCalls: [], pointerMove: { current: undefined } }),
      runner,
    });
    controller.generate();
    controller.generate();
    expect(runner.jobs[0]?.cancelled).toBe(true);
    runner.jobs[0]?.resolve(result("stale"));
    runner.jobs[1]?.resolve(result("current"));
    await Promise.resolve();
    await Promise.resolve();
    expect(control.status.textContent).toContain("Ready");
    controller.dispose();
  });

  it("cancels the active request and ignores completion after disposal", async () => {
    const runner = new DeferredRunner();
    const control = controls();
    const controller = new GenerationPreviewController({
      controls: control,
      canvas: previewCanvas({ clearCalls: [], pointerMove: { current: undefined } }),
      runner,
    });
    controller.generate();
    controller.dispose();
    expect(runner.jobs[0]?.cancelled).toBe(true);
    runner.jobs[0]?.resolve(result("disposed"));
    await Promise.resolve();
    expect(control.status.textContent).toContain("Generating");
  });

  it("shows the hover prompt after a successful preview without a cursor", async () => {
    const runner = new DeferredRunner();
    const control = controls();
    const hover = { textContent: EMPTY_PREVIEW } as HTMLElement;
    const controller = new GenerationPreviewController({
      controls: control,
      canvas: previewCanvas({ clearCalls: [], pointerMove: { current: undefined } }),
      hover,
      runner,
    });
    controller.generate();
    runner.jobs[0]?.resolve(result("rooms-envelopes"));
    await Promise.resolve();
    await Promise.resolve();
    expect(control.status.textContent).toContain("Ready");
    expect(hover.textContent).toBe("Hover a map cell for details.");
    controller.dispose();
  });

  it("clears an existing preview when a later generation fails", async () => {
    const runner = new DeferredRunner();
    const control = controls();
    const hover = { textContent: "" } as HTMLElement;
    const clearCalls: number[] = [];
    const pointerMove = { current: undefined as ((event: PointerEvent) => void) | undefined };
    const controller = new GenerationPreviewController({
      controls: control,
      canvas: previewCanvas({ clearCalls, pointerMove }),
      hover,
      runner,
    });
    controller.generate();
    runner.jobs[0]?.resolve(result("rooms-envelopes"));
    await Promise.resolve();
    await Promise.resolve();
    expect(control.status.textContent).toContain("Ready");
    expect(control.next.disabled).toBe(false);
    pointerMove.current?.({ clientX: 400, clientY: 240 } as PointerEvent);
    expect(hover.textContent).toContain("Spawn");
    controller.generate();
    runner.jobs[1]?.reject(new Error("authored structure failed"));
    await Promise.resolve();
    await Promise.resolve();
    expect(control.status.textContent).toContain("no usable preview");
    expect(control.previous.disabled).toBe(true);
    expect(control.next.disabled).toBe(true);
    expect(hover.textContent).toBe(EMPTY_PREVIEW);
    pointerMove.current?.({ clientX: 400, clientY: 240 } as PointerEvent);
    expect(hover.textContent).toBe(EMPTY_PREVIEW);
    expect(clearCalls.length).toBeGreaterThanOrEqual(2);
    controller.dispose();
  });

  it("refreshes stationary hover metadata after stage navigation", async () => {
    const runner = new DeferredRunner();
    const control = controls();
    const hover = { textContent: "" } as HTMLElement;
    const pointerMove = { current: undefined as ((event: PointerEvent) => void) | undefined };
    const controller = new GenerationPreviewController({
      controls: control,
      canvas: previewCanvas({ clearCalls: [], pointerMove }),
      hover,
      runner,
    });
    controller.generate();
    runner.jobs[0]?.resolve(stagedHoverResult());
    await Promise.resolve();
    await Promise.resolve();
    pointerMove.current?.({ clientX: 400, clientY: 240 } as PointerEvent);
    expect(hover.textContent).toContain("Spawn");
    (control.next as unknown as { click: () => void }).click();
    expect(hover.textContent).toContain("Ordinary room");
    controller.dispose();
  });

  it("surfaces a typed preview budget failure and clears stale output", async () => {
    const runner = new DeferredRunner();
    const control = controls();
    const clearCalls: number[] = [];
    const controller = new GenerationPreviewController({
      controls: control,
      canvas: previewCanvas({ clearCalls, pointerMove: { current: undefined }}),
      runner,
    });
    controller.generate();
    runner.jobs[0]?.reject(new GenerationPreviewBudgetError());
    await Promise.resolve();
    await Promise.resolve();
    expect(control.status.textContent).toContain("generation-budget-exhausted");
    expect(control.next.disabled).toBe(true);
    expect(clearCalls.length).toBeGreaterThan(0);
    controller.dispose();
  });
});
