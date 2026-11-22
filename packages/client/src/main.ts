/** Client boot entry: mounts PixiJS v8 shader scene, networking, input, and HUD. */
import { InputController } from "./input/controller.js";
import { WorldClient } from "./net/worldClient.js";
import { WorldScene } from "./render/world/worldScene.js";
import { AtmosphereToolbar } from "./ui/atmosphereToolbar.js";

function renderTick(ctx: {
  readonly scene: WorldScene;
  readonly client: WorldClient;
  readonly input: InputController;
  readonly toolbar: AtmosphereToolbar;
  readonly nowMs: number;
  readonly dt: number;
}): void {
  ctx.client.stepInput(ctx.input.movement(), ctx.dt);
  const view = ctx.client.snapshot();
  ctx.scene.renderFrame({
    dt: ctx.dt,
    timeSec: ctx.nowMs / 1000,
    dayPhase: view.dayPhase,
    cache: view.cache,
    players: view.players,
    localPlayerId: view.localPlayerId,
  });
  const local = view.players.find((p) => p.id === view.localPlayerId);
  ctx.toolbar.sync({
    mode: view.mode,
    dayPhase: view.dayPhase,
    dayPaused: view.dayPaused,
    torchLit: Boolean(local?.torchLit),
    quality: ctx.scene.qualityPreset(),
  });
}

async function bootOverworldClient(): Promise<void> {
  const host = document.getElementById("app");
  if (!host) throw new Error("Missing #app mount node");
  const scene = await WorldScene.mount(host);
  const client = new WorldClient();
  const input = new InputController(host, {
    onToggleTorch: () => client.toggleTorch(),
    onZoom: (factor) => scene.adjustZoom(factor),
  });
  const toolbar = new AtmosphereToolbar(host, {
    onToggleTorch: () => client.toggleTorch(),
    onSetDayPhase: (phase, paused) => client.setDayPhase(phase, paused),
    onSetQuality: (preset) => scene.setQualityPreset(preset),
  });
  let prevMs = performance.now();
  const loop = (nowMs: number): void => {
    const dt = Math.min(0.05, Math.max(0.001, (nowMs - prevMs) / 1000));
    prevMs = nowMs;
    renderTick({ scene, client, input, toolbar, nowMs, dt });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

void bootOverworldClient();
