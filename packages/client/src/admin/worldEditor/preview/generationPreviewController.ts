import {
  currentGenerationPreviewSnapshot,
  emptyGenerationPreviewReplay,
  nextGenerationPreviewStage,
  previousGenerationPreviewStage,
  setGenerationPreviewTrace,
  type GenerationPreviewReplayState,
} from "./generationPreviewReplay.js";
import {
  drawGenerationPreview,
  generationPreviewCellFromClient,
  fitGenerationPreview,
  generationPreviewCellDescription,
  type GenerationPreviewProjection,
} from "./generationPreviewProjection.js";
import { generationPreviewStageStatus } from "./generationPreviewStage.js";
import { refreshGenerationPreviewHover } from "./generationPreviewHover.js";
import { serializeGenerationPreviewRequest, type GenerationPreviewControls } from "../controls/generationPreviewControls.js";
import { createGenerationTraceRunner, type GenerationTraceJob, type GenerationTraceRunner } from "./trace/generationTraceRunner.js";
import { createGenerationPreviewRouteOverlay, type GenerationPreviewRouteOverlay } from "./controls/generationPreviewRouteOverlay.js";
import { createGenerationPreviewDeltaOverlay, type GenerationPreviewDeltaOverlay } from "./controls/generationPreviewDeltaOverlay.js";
import { generationPreviewDeltaDrawInput, updateGenerationPreviewStageButtons } from "./controls/generationPreviewControllerState.js";

export interface GenerationPreviewControllerOptions {
  readonly controls: GenerationPreviewControls;
  readonly canvas: HTMLCanvasElement;
  readonly hover?: HTMLElement;
  readonly runner?: GenerationTraceRunner;
}

export class GenerationPreviewController {
  private readonly context: CanvasRenderingContext2D | null;
  private readonly runner: GenerationTraceRunner;
  private readonly routeOverlay: GenerationPreviewRouteOverlay;
  private readonly deltaOverlay: GenerationPreviewDeltaOverlay;
  private replay: GenerationPreviewReplayState = emptyGenerationPreviewReplay();
  private projection: GenerationPreviewProjection | null = null;
  private cursorCell: { readonly x: number; readonly y: number } | null = null;
  private currentJob: GenerationTraceJob | null = null;
  private generationToken = 0;
  private disposed = false;

  constructor(private readonly options: GenerationPreviewControllerOptions) {
    this.context = options.canvas.getContext("2d");
    this.runner = options.runner ?? createGenerationTraceRunner();
    this.routeOverlay = createGenerationPreviewRouteOverlay(options.controls.root, () => this.renderSnapshot());
    this.deltaOverlay = createGenerationPreviewDeltaOverlay(options.controls.root, () => this.renderSnapshot());
    this.bindControls();
    this.bindHover();
    updateGenerationPreviewStageButtons(this.options.controls, this.replay);
  }

  generate(): void {
    if (this.disposed) return;
    const token = ++this.generationToken;
    this.currentJob?.cancel();
    this.clearPreview();
    const request = serializeGenerationPreviewRequest(this.options.controls.readDraft());
    this.options.controls.setStatus("Generating local preview…");
    this.currentJob = this.runner.request(request);
    void this.currentJob.promise.then((result) => {
      if (token !== this.generationToken) return;
      this.currentJob = null;
      this.replay = setGenerationPreviewTrace(this.replay, result.trace);
      this.projection = fitGenerationPreview(result.trace.bounds, this.options.canvas);
      this.renderSnapshot();
      this.options.controls.setStatus(`Ready · ${generationPreviewStageStatus(this.replay)}`);
      updateGenerationPreviewStageButtons(this.options.controls, this.replay);
    }).catch((error: unknown) => {
      if (token !== this.generationToken) return;
      this.currentJob = null;
      this.clearPreview();
      const reason = error instanceof Error ? error.message : "Generation preview failed.";
      this.options.controls.setStatus(`Generation failed — no usable preview. ${reason}`);
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generationToken++;
    this.currentJob?.cancel();
    this.currentJob = null;
    if (typeof this.options.canvas.removeEventListener === "function") {
      this.options.canvas.removeEventListener("pointermove", this.handlePointerMove);
      this.options.canvas.removeEventListener("pointerleave", this.handlePointerLeave);
    }
    this.routeOverlay.dispose();
    this.deltaOverlay.dispose();
    this.runner.dispose();
  }

  private bindControls(): void {
    this.options.controls.generate.addEventListener("click", () => this.generate());
    this.options.controls.previous.addEventListener("click", () => this.selectPreviousStage());
    this.options.controls.next.addEventListener("click", () => this.selectNextStage());
  }

  private bindHover(): void {
    if (typeof this.options.canvas.addEventListener !== "function") return;
    this.options.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.options.canvas.addEventListener("pointerleave", this.handlePointerLeave);
  }

  private selectPreviousStage(): void {
    this.replay = previousGenerationPreviewStage(this.replay);
    this.renderSnapshot();
    updateGenerationPreviewStageButtons(this.options.controls, this.replay);
  }

  private selectNextStage(): void {
    this.replay = nextGenerationPreviewStage(this.replay);
    this.renderSnapshot();
    updateGenerationPreviewStageButtons(this.options.controls, this.replay);
  }

  private handlePointerMove = (event: PointerEvent): void => {
    const hover = this.options.hover;
    if (!hover || !this.projection) return;
    const rect = this.options.canvas.getBoundingClientRect();
    const cell = generationPreviewCellFromClient({ projection: this.projection, canvas: this.options.canvas, rect, clientX: event.clientX, clientY: event.clientY });
    this.cursorCell = cell;
    this.renderSnapshot();
    const snapshot = currentGenerationPreviewSnapshot(this.replay);
    hover.textContent = cell && snapshot
      ? generationPreviewCellDescription(snapshot, cell.x, cell.y)
      : "Outside the finite floor bounds.";
  }

  private handlePointerLeave = (): void => {
    this.cursorCell = null;
    this.renderSnapshot();
    if (this.options.hover) this.options.hover.textContent = "Hover a map cell for details.";
  }

  private renderSnapshot(): void {
    const snapshot = currentGenerationPreviewSnapshot(this.replay);
    if (!snapshot || !this.context || !this.projection) return;
    drawGenerationPreview({
      context: this.context,
      snapshot,
      projection: this.projection,
      cursor: this.cursorCell,
      showRoutes: this.routeOverlay.shown,
      ...generationPreviewDeltaDrawInput(this.replay, this.deltaOverlay.shown, snapshot),
    });
    this.options.controls.setStatus(generationPreviewStageStatus(this.replay));
    refreshGenerationPreviewHover({ hover: this.options.hover, snapshot, cell: this.cursorCell });
  }

  private clearPreview(): void {
    this.replay = emptyGenerationPreviewReplay();
    this.projection = null;
    this.cursorCell = null;
    if (this.context) {
      this.context.clearRect(0, 0, this.options.canvas.width, this.options.canvas.height);
    }
    updateGenerationPreviewStageButtons(this.options.controls, this.replay);
    if (this.options.hover) this.options.hover.textContent = "No usable preview.";
  }
}
