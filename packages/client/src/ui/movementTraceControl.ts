import type { Connection } from "../net/connection.js";
import {
  MOVEMENT_TRACE_MAX_MS,
  type MovementTraceFile,
} from "../net/movementTrace.js";

const IDLE_LABEL = "REC MOVE TRACE";
const RECORDING_COLOR = "#e04a4a";
const IDLE_COLOR = "rgba(18,19,30,.88)";

export class MovementTraceControl {
  private readonly button = document.createElement("button");

  constructor(
    root: HTMLElement,
    private readonly connection: Connection,
    private readonly focusGame: () => void,
  ) {
    this.button.type = "button";
    this.button.textContent = IDLE_LABEL;
    this.button.title =
      `Record movement inputs, snapshots, prediction, and render positions (auto-saves after ${MOVEMENT_TRACE_MAX_MS / 1000}s)`;
    this.button.style.cssText =
      "position:absolute;right:12px;top:60px;z-index:2499;height:28px;padding:0 9px;" +
      "border:1px solid #71758b;background:" + IDLE_COLOR + ";color:#f3f0e9;" +
      "font:10px monospace;letter-spacing:.04em;pointer-events:auto;cursor:pointer";
    this.button.addEventListener("click", this.toggle);
    root.append(this.button);
  }

  update(now = performance.now()): void {
    const recorder = this.connection.movementTrace;
    if (!recorder.recording) return;
    if (recorder.timedOut(now)) {
      this.save("timeout", now);
      return;
    }
    this.button.textContent =
      `STOP + SAVE ${(recorder.elapsedMs(now) / 1000).toFixed(1)}s`;
  }

  dispose(): void {
    this.button.removeEventListener("click", this.toggle);
    this.connection.movementTrace.cancel();
    this.button.remove();
  }

  private readonly toggle = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    if (this.connection.movementTrace.recording) this.save("manual");
    else this.start();
    this.focusGame();
  };

  private start(): void {
    const connection = this.connection;
    if (!connection.movementTrace.start({
      endpoint: connection.url,
      worldSeed: connection.world?.worldSeed ?? null,
      floor: connection.floor,
    })) return;
    this.button.style.background = RECORDING_COLOR;
    this.button.style.borderColor = "#ffb4b4";
    this.button.textContent = "STOP + SAVE 0.0s";
    this.button.setAttribute("aria-pressed", "true");
  }

  private save(
    reason: MovementTraceFile["stopReason"],
    now = performance.now(),
  ): void {
    const trace = this.connection.movementTrace.stop(reason, now);
    if (trace) downloadTrace(trace);
    this.button.style.background = IDLE_COLOR;
    this.button.style.borderColor = "#71758b";
    this.button.textContent = IDLE_LABEL;
    this.button.setAttribute("aria-pressed", "false");
  }
}

function downloadTrace(trace: MovementTraceFile): void {
  const blob = new Blob([JSON.stringify(trace, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = trace.startedAt.replace(/[:.]/g, "-");
  anchor.href = url;
  anchor.download = `dc2d-movement-trace-${stamp}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
