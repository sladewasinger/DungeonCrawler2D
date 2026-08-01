import Phaser from "phaser";
import { attachDevelopmentMovementTrace } from "../ui/movement/developmentMovementTrace.js";
import type { MovementTraceControl } from "../ui/movement/movementTraceControl.js";
import type { Connection } from "../net/connection/connection.js";
import { SharedHtmlHud } from "../ui/hud/core/SharedHtmlHud.js";
import { createLiveHtmlHud } from "./hudHtml.js";
import type { HudSceneData } from "./hudSceneData.js";
import type { HudFakeSnapshot } from "../ui/widgets/hud/core/fakeData.js";
import { TERRAIN_RUNTIME_TUNING } from "../render/terrain/terrainRuntimeTuning.js";

export interface HtmlHudLifecycle {
  readonly hud: SharedHtmlHud;
  update(snapshot: HudFakeSnapshot): void;
  dispose(): void;
}

interface HtmlHudLifecycleRequest {
  readonly connection: Connection;
  readonly canvas: HTMLCanvasElement;
  readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | undefined;
  readonly onSelectHotbar?: (index: number | null) => void;
  readonly session?: HudSceneData["session"];
}

export function createHtmlHudLifecycle(request: HtmlHudLifecycleRequest): HtmlHudLifecycle {
  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app root for HTML HUD.");
  request.keyboard?.removeCapture("F12");
  const options = htmlHudOptions(root, request);
  const hud = createLiveHtmlHud(options);
  // The title's name field is focused by design. Restore the canvas only after
  // the HUD has mounted its own focusable controls, otherwise `isTypingInInput`
  // can continue to suppress movement until the player presses Tab.
  options.focusGame();
  const trace = createMovementTrace(root, request.connection, request.canvas);
  const cadence = new HtmlHudCadence();
  return {
    hud,
    update: (snapshot) => updateHtmlHud({ hud, trace, cadence, connection: request.connection, snapshot }),
    dispose: () => { trace?.dispose(); hud.dispose(); },
  };
}

class HtmlHudCadence {
  private nextCompassMs = 0;
  private nextTelemetryMs = 0;

  consume(nowMs: number): { readonly compass: boolean; readonly telemetry: boolean } {
    return {
      compass: this.consumeAt("nextCompassMs", nowMs, TERRAIN_RUNTIME_TUNING.mobilePerformance.compassUpdatesPerSecond),
      telemetry: this.consumeAt("nextTelemetryMs", nowMs, TERRAIN_RUNTIME_TUNING.mobilePerformance.telemetryUpdatesPerSecond),
    };
  }

  private consumeAt(field: "nextCompassMs" | "nextTelemetryMs", nowMs: number, rate: number): boolean {
    if (nowMs < this[field]) return false;
    this[field] = nowMs + 1000 / rate;
    return true;
  }
}

function htmlHudOptions(root: HTMLElement, request: HtmlHudLifecycleRequest): Parameters<typeof createLiveHtmlHud>[0] {
  const focusGame = () => { request.canvas.tabIndex = -1; request.canvas.focus({ preventScroll: true }); };
  return {
    root, connection: request.connection, focusGame,
    setTextInputFocused: (focused) => focused ? request.keyboard?.disableGlobalCapture() : request.keyboard?.enableGlobalCapture(),
    ...(request.onSelectHotbar ? { onSelectHotbar: request.onSelectHotbar } : {}),
    session: request.session ?? { respawn: () => {}, rescue: () => {}, quitToTitle: () => {} },
  };
}

function createMovementTrace(root: HTMLElement, connection: Connection, canvas: HTMLCanvasElement): MovementTraceControl | undefined {
  let trace: MovementTraceControl | undefined;
  attachDevelopmentMovementTrace({ root, connection, focusGame: () => { canvas.tabIndex = -1; canvas.focus({ preventScroll: true }); }, active: () => true, attach: (control) => { trace = control; } });
  return trace;
}

function updateHtmlHud({ hud, trace, cadence, connection, snapshot }: { hud: SharedHtmlHud; trace: MovementTraceControl | undefined; cadence: HtmlHudCadence; connection: Connection; snapshot: HudFakeSnapshot }): void {
  if (!connection.world) return;
  const expensive = cadence.consume(performance.now());
  hud.update({ connection, world: connection.world, player: { x: snapshot.coords.x, y: snapshot.coords.z, z: snapshot.coords.y, verticalVelocity: 0, grounded: true }, yaw: -(snapshot.compassBearingDeg * Math.PI) / 180, mouseCaptured: true, snapshot, updateCompass: expensive.compass, updateTelemetry: expensive.telemetry });
  trace?.update();
}
