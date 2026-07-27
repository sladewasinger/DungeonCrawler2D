import type { SharedHtmlHud } from "./SharedHtmlHud.js";
import type { HudUpdate } from "./SharedHtmlHud.js";
import { syncHudLiveState } from "./HudLiveState.js";
import { resolveCompassState } from "../model/HudCompass.js";

interface UpdateHudRequest {
  hud: SharedHtmlHud;
  update: HudUpdate;
  showHealthFeedback: boolean;
}

export const updateHud = ({ hud, update, showHealthFeedback }: UpdateHudRequest): void => {
  const { connection, world, player, yaw, mouseCaptured } = update;
  const { parts } = hud;
  parts.panels.chat.update();
  parts.inventory.update();
  parts.status.update(connection, world.floor);
  const compass = resolveCompassState({ world, player, yaw, snapshot: update.snapshot });
  parts.compass.update(compass.bearingDeg, compass.stairway);
  parts.hotbar.update(connection, update.snapshot?.selectedSlot);
  parts.buffs.update(connection);
  if (showHealthFeedback) parts.healthFeedback.update(connection, performance.now());
  parts.weapon.update(connection);
  parts.party.update(connection, player, yaw);
  parts.telemetry.update({ connection, world, player, yaw, mouseCaptured });
  parts.downed.update(connection, update.giveUpHoldProgress);
  parts.invite.update();
  parts.sessionMenu.update(connection.status === "connected" && connection.hp > 0);
  const selectedSlot = parts.hotbar.selectedSlot();
  parts.tutorials.update(connection, selectedSlot >= 0 ? selectedSlot : null, performance.now());
  parts.touch.update(update.snapshot?.touch ?? null);
  if (update.snapshot) parts.overlays.update(update.snapshot, parts.notices);
  else syncHudLiveState({ connection, world, selectedSlot, panels: parts.panels, notices: parts.notices, closeCraft: () => hud.closeCraft(), closeStash: () => hud.closeStash() });
};
