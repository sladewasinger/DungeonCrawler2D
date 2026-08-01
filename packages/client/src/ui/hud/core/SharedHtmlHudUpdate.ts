import type { SharedHtmlHud } from "./SharedHtmlHud.js";
import type { HudUpdate } from "./SharedHtmlHud.js";
import { syncHudLiveState } from "./HudLiveState.js";
import { resolveCompassState } from "../model/HudCompass.js";
import { resolveHudMinimap } from "./HudMinimapSnapshot.js";

interface UpdateHudRequest {
  hud: SharedHtmlHud;
  update: HudUpdate;
  showHealthFeedback: boolean;
}

interface HudPerformance {
  readonly fps: number | undefined;
  readonly latencyMs: number;
}

const telemetryPerformance = (update: HudUpdate): HudPerformance => ({
  fps: update.fps ?? update.snapshot?.fps,
  latencyMs: update.latencyMs ?? update.snapshot?.pingMs ?? update.connection.rttMs,
});

export const updateHud = ({ hud, update, showHealthFeedback }: UpdateHudRequest): void => {
  const frameMetrics = telemetryPerformance(update);
  updatePrimaryHud({ hud, update, showHealthFeedback });
  updateSecondaryHud({ hud, update, performance: frameMetrics });
};

interface PrimaryHudUpdate {
  readonly hud: SharedHtmlHud;
  readonly update: HudUpdate;
  readonly showHealthFeedback: boolean;
}

const updatePrimaryHud = ({ hud, update, showHealthFeedback }: PrimaryHudUpdate): void => {
  const { connection, world, player, yaw } = update;
  const { parts } = hud;
  parts.panels.chat.update();
  hud.adminDebug.update();
  parts.inventory.update();
  parts.status.update(connection, world.floor);
  if (update.updateCompass !== false) {
    const compass = resolveCompassState({ world, player, yaw, snapshot: update.snapshot });
    const minimap = resolveHudMinimap({ connection, world, player, snapshot: update.snapshot });
    parts.compass.update({
      bearingDeg: compass.bearingDeg,
      stairway: compass.stairway,
      landmarks: compass.landmarks,
      minimap,
    });
  }
  parts.hotbar.update(connection, update.snapshot?.selectedSlot);
  parts.buffs.update(connection);
  if (showHealthFeedback) parts.healthFeedback.update(connection, performance.now());
  parts.weapon.update(connection);
  parts.party.update(connection, player, yaw);
};

interface SecondaryHudUpdate {
  readonly hud: SharedHtmlHud;
  readonly update: HudUpdate;
  readonly performance: HudPerformance;
}

const updateSecondaryHud = ({ hud, update, performance }: SecondaryHudUpdate): void => {
  const { connection, world, player, yaw, mouseCaptured } = update;
  const { parts } = hud;
  if (update.updateTelemetry !== false) {
    parts.telemetry.update({ ...performance, connection, world, player, yaw, mouseCaptured });
  }
  parts.downed.update(connection, update.giveUpHoldProgress);
  parts.invite.update();
  parts.sessionMenu.update(connection.status === "connected" && connection.hp > 0);
  const selectedSlot = parts.hotbar.selectedSlot();
  parts.tutorials.update(connection, selectedSlot >= 0 ? selectedSlot : null, globalThis.performance.now());
  parts.touch.update(update.snapshot?.touch ?? null);
  updateOverlays({ hud, update, selectedSlot });
};

interface OverlayUpdate {
  readonly hud: SharedHtmlHud;
  readonly update: HudUpdate;
  readonly selectedSlot: number;
}

const updateOverlays = ({ hud, update, selectedSlot }: OverlayUpdate): void => {
  const { connection, world } = update;
  const { parts } = hud;
  if (update.snapshot) {
    parts.overlays.update(update.snapshot, parts.notices);
    return;
  }
  syncHudLiveState({
    connection,
    world,
    selectedSlot,
    panels: parts.panels,
    notices: parts.notices,
    closeCraft: () => hud.closeCraft(),
    closeStash: () => hud.closeStash(),
  });
};
