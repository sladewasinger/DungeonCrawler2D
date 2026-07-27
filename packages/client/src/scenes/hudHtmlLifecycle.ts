import Phaser from "phaser";
import { attachDevelopmentMovementTrace } from "../ui/movement/developmentMovementTrace.js";
import type { MovementTraceControl } from "../ui/movement/movementTraceControl.js";
import type { Connection } from "../net/connection/connection.js";
import { SharedHtmlHud } from "../ui/hud/core/SharedHtmlHud.js";
import { createLiveHtmlHud } from "./hudHtml.js";
import type { HudSceneData } from "./hudSceneData.js";
import type { HudFakeSnapshot } from "../ui/widgets/hud/core/fakeData.js";

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
  const hud = createLiveHtmlHud(htmlHudOptions(root, request));
  const trace = createMovementTrace(root, request.connection, request.canvas);
  return { hud, update: (snapshot) => updateHtmlHud({ hud, trace, connection: request.connection, snapshot }), dispose: () => { trace?.dispose(); hud.dispose(); } };
}

function htmlHudOptions(root: HTMLElement, request: HtmlHudLifecycleRequest): Parameters<typeof createLiveHtmlHud>[0] {
  const focusGame = () => { request.canvas.tabIndex = -1; request.canvas.focus({ preventScroll: true }); };
  return {
    root, connection: request.connection, focusGame,
    setTextInputFocused: (focused) => focused ? request.keyboard?.disableGlobalCapture() : request.keyboard?.enableGlobalCapture(),
    ...(request.onSelectHotbar ? { onSelectHotbar: request.onSelectHotbar } : {}),
    session: request.session ?? { respawn: () => {}, quitToTitle: () => {} },
  };
}

function createMovementTrace(root: HTMLElement, connection: Connection, canvas: HTMLCanvasElement): MovementTraceControl | undefined {
  let trace: MovementTraceControl | undefined;
  attachDevelopmentMovementTrace({ root, connection, focusGame: () => { canvas.tabIndex = -1; canvas.focus({ preventScroll: true }); }, active: () => true, attach: (control) => { trace = control; } });
  return trace;
}

function updateHtmlHud({ hud, trace, connection, snapshot }: { hud: SharedHtmlHud; trace: MovementTraceControl | undefined; connection: Connection; snapshot: HudFakeSnapshot }): void {
  if (!connection.world) return;
  hud.update({ connection, world: connection.world, player: { x: snapshot.coords.x, y: snapshot.coords.z, z: snapshot.coords.y, verticalVelocity: 0, grounded: true }, yaw: -(snapshot.compassBearingDeg * Math.PI) / 180, mouseCaptured: true, snapshot });
  trace?.update();
}
