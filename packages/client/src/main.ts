/** Client boot entry: mounts PixiJS v8 shader scene, networking, input, and HUD. */
import { InputController } from "./input/controller.js";
import { WorldClient } from "./net/worldClient.js";
import { WorldScene } from "./render/world/worldScene.js";
import { AtmosphereToolbar } from "./ui/atmosphereToolbar.js";
import { installMobileAutoFullscreen } from "./ui/fullscreen.js";
import { HudRoot } from "./ui/hud/hudRoot.js";

interface AppCtx {
  readonly scene: WorldScene;
  readonly client: WorldClient;
  readonly input: InputController;
  readonly toolbar: AtmosphereToolbar;
  readonly hud: HudRoot;
}

function resolveAimVector(ctx: AppCtx & { readonly nowMs: number }, moving: boolean): { readonly x: number; readonly y: number } | undefined {
  const mouse = ctx.input.mouseAim(ctx.nowMs);
  if (!mouse || (moving && !mouse.recent)) return undefined;
  const me = ctx.client.localPose();
  const target = ctx.scene.screenToWorldTile(mouse.x, mouse.y);
  const dx = target.x - me.x;
  const dy = target.y - (me.y - me.elevation * 0.625 - 0.6);
  const mag = Math.hypot(dx, dy);
  return mag > 0.05 ? { x: dx / mag, y: dy / mag } : undefined;
}

function renderTick(ctx: AppCtx & { readonly nowMs: number; readonly dt: number }): void {
  const move = ctx.input.movement();
  const moving = Math.hypot(move.x, move.y) > 0.05;
  ctx.client.stepInput({ move, dt: ctx.dt, aim: resolveAimVector(ctx, moving), jump: ctx.input.consumeJump() });
  const view = ctx.client.snapshot();
  ctx.scene.renderFrame({
    dt: ctx.dt, timeSec: ctx.nowMs / 1000, dayPhase: view.dayPhase,
    cache: view.cache, players: view.players, localPlayerId: view.localPlayerId,
  });
  const local = view.players.find((p) => p.id === view.localPlayerId);
  ctx.hud.sync({ inventory: view.inventory, name: view.localName, appearance: view.localAppearance });
  ctx.toolbar.sync({
    mode: view.mode, dayPhase: view.dayPhase, dayPaused: view.dayPaused,
    torchLit: Boolean(local?.torchLit), quality: ctx.scene.qualityPreset(), activePanel: ctx.hud.activePanel(),
  });
}

function startRenderLoop(ctx: AppCtx): void {
  let prevMs = performance.now();
  const loop = (nowMs: number): void => {
    const dt = Math.min(0.05, Math.max(0.001, (nowMs - prevMs) / 1000));
    prevMs = nowMs;
    renderTick({ ...ctx, nowMs, dt });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function bootOverworldClient(): Promise<void> {
  const host = document.getElementById("app");
  if (!host) throw new Error("Missing #app mount node");
  installMobileAutoFullscreen(host);
  const scene = await WorldScene.mount(host);
  const client = new WorldClient();
  const hud = new HudRoot(host, {
    onSelectHotbar: (slot) => client.selectHotbar(slot),
    onMoveSlot: (move) => client.moveSlot(move),
    onEquipArmor: (req) => client.equipArmor(req),
    onUnequipArmor: (req) => client.unequipArmor(req),
    onCraft: (recipeId) => client.craftRecipe(recipeId),
    onSetCharacter: (req) => client.setCharacter(req),
  });
  const input = new InputController(host, {
    onToggleTorch: () => client.toggleTorch(),
    onZoom: (factor) => scene.adjustZoom(factor),
    onSelectHotbar: (slot) => client.selectHotbar(slot),
    onToggleInventory: () => hud.toggleInventory(),
    onToggleCrafting: () => hud.toggleCrafting(),
    onToggleCharacter: () => hud.toggleCharacter(),
    onClosePanels: () => hud.closePanels(),
  });
  const toolbar = new AtmosphereToolbar(host, {
    onToggleTorch: () => client.toggleTorch(),
    onSetDayPhase: (phase, paused) => client.setDayPhase(phase, paused),
    onSetQuality: (preset) => scene.setQualityPreset(preset),
    onToggleInventory: () => hud.toggleInventory(),
    onToggleCrafting: () => hud.toggleCrafting(),
    onToggleCharacter: () => hud.toggleCharacter(),
    onZoom: (factor) => scene.adjustZoom(factor),
  });
  startRenderLoop({ scene, client, input, toolbar, hud });
}

void bootOverworldClient();
