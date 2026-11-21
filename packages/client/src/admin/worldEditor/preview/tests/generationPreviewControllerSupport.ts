import type { FloorGenerationRequest, FloorGenerationTrace } from "@dc2d/engine";
import { defaultGenerationPreviewDraft, type GenerationPreviewControls } from "../../controls/generationPreviewControls.js";
import type { GenerationPreviewResult, GenerationTraceJob, GenerationTraceRunner } from "../trace/generationTraceRunner.js";

export class DeferredRunner implements GenerationTraceRunner {
  readonly jobs: DeferredJob[] = [];

  request(request: FloorGenerationRequest): GenerationTraceJob {
    void request;
    const job = new DeferredJob();
    this.jobs.push(job);
    return job;
  }

  dispose(): void {}
}

class DeferredJob implements GenerationTraceJob {
  readonly promise: Promise<GenerationPreviewResult>;
  private resolvePromise!: (value: GenerationPreviewResult) => void;
  private rejectPromise!: (reason: unknown) => void;
  cancelled = false;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    });
  }

  resolve(value: GenerationPreviewResult): void { this.resolvePromise(value); }
  reject(reason: unknown): void { this.rejectPromise(reason); }
  cancel(): void { this.cancelled = true; this.rejectPromise(new Error("cancelled")); }
}

export interface TestRouteOverlay {
  checked: boolean;
  change(): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

export function routeOverlay(): TestRouteOverlay {
  let changeHandler: (() => void) | undefined;
  return {
    checked: false,
    addEventListener: (type, listener) => {
      if (type === "change" && typeof listener === "function") changeHandler = () => listener(new Event("change"));
    },
    removeEventListener: () => { changeHandler = undefined; },
    change: () => changeHandler?.(),
  };
}

export function controls(overlay?: TestRouteOverlay, deltaOverlay?: TestRouteOverlay): GenerationPreviewControls {
  const button = () => {
    let clickHandler: (() => void) | undefined;
    return {
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === "function") clickHandler = () => listener(new Event("click"));
      },
      click: () => clickHandler?.(),
      textContent: "",
      disabled: false,
    } as unknown as HTMLButtonElement;
  };
  const status = { textContent: "" } as HTMLElement;
  return {
    root: {
      querySelectorAll: () => [],
      querySelector: (selector: string) => {
        if (selector === "[data-admin-generation-routes]") return overlay ?? null;
        return selector === "[data-admin-generation-delta]" ? deltaOverlay ?? null : null;
      },
    } as unknown as HTMLElement,
    generate: button(), previous: button(), next: button(), status,
    readDraft: defaultGenerationPreviewDraft,
    setStatus: (value) => { status.textContent = value; },
  };
}

export function result(stageId: string): GenerationPreviewResult {
  const trace = {
    bounds: {
      minX: 0, minY: 0, width: 1, height: 1, maxX: 0, maxY: 0,
      minChunkX: 0, minChunkY: 0, maxChunkX: 0, maxChunkY: 0,
    },
    configurationFingerprint: "config",
    snapshots: [0, 1].map((stageIndex) => ({
      stageId, stageIndex,
      bounds: {
        minX: 0, minY: 0, width: 1, height: 1, maxX: 0, maxY: 0,
        minChunkX: 0, minChunkY: 0, maxChunkX: 0, maxChunkY: 0,
      },
      tiles: new Uint8Array([0]), terrain: new Uint8Array([0]),
      features: new Uint8Array([0]), featureFaces: new Uint8Array([0]),
      featureHeight: new Float32Array([0]), protectedCells: new Uint8Array([1]),
      surfaceValidation: { status: "planning", failures: [] },
      semantic: new Uint8Array([3]), height: new Float32Array([0]),
      roomWallIds: new Int16Array([-1]), territory: new Uint8Array([0]),
      region: new Uint16Array([1]), featureIds: new Int16Array([0]),
      featureStamps: [{ id: "spawn", kind: "spawn-exterior", bounds: { x0: 0, y0: 0, x1: 0, y1: 0 }, ports: [], protectedCells: [], position: { x: 0, y: 0 } }],
      routes: [], rooms: [], connectors: [], territoryLayouts: [], fingerprint: "snapshot",
    })),
  };
  return { trace: trace as unknown as FloorGenerationTrace };
}

export function stagedHoverResult(): GenerationPreviewResult {
  const current = result("mandatory-backbone").trace;
  const next = result("rooms-envelopes").trace.snapshots[0];
  const trace = {
    ...current,
    snapshots: [current.snapshots[0], {
      ...next,
      featureStamps: [], featureIds: new Int16Array([-1]),
      rooms: [{ x0: 0, y0: 0, x1: 0, y1: 0 }],
    }],
  };
  return { trace: trace as unknown as FloorGenerationTrace };
}

export function previewCanvas(input: { readonly clearCalls: number[]; readonly pointerMove: { current: ((event: PointerEvent) => void) | undefined } }): HTMLCanvasElement {
  const context = {
    canvas: { width: 800, height: 480 }, clearRect: () => { input.clearCalls.push(1); },
    fillStyle: "", fillRect: () => {}, strokeStyle: "", lineWidth: 0,
    beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
  } as unknown as CanvasRenderingContext2D;
  return {
    width: 800, height: 480, getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 480 }),
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "pointermove" && typeof listener === "function") input.pointerMove.current = listener as (event: PointerEvent) => void;
    },
    removeEventListener: () => {},
  } as unknown as HTMLCanvasElement;
}
