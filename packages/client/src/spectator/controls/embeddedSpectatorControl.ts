import type { Connection } from "../../net/connection/connection.js";
import type { SpectatorControlMessage } from "../spectatorControlMessage.js";

export interface EmbeddedSpectatorControlHandlers {
  readonly focusCamera: () => void;
  readonly centerCamera: () => void;
  readonly zoomCamera: (direction: "in" | "out") => void;
  readonly resetCameraZoom: () => void;
}

interface EmbeddedSpectatorControlInput {
  readonly connection: Connection;
  readonly handlers: EmbeddedSpectatorControlHandlers;
  readonly message: Exclude<SpectatorControlMessage, { readonly action: "hud" }>;
}

export function applyEmbeddedSpectatorControl(
  input: EmbeddedSpectatorControlInput,
): void {
  switch (input.message.action) {
    case "target":
      input.connection.selectSpectatorTarget(input.message.playerId);
      return;
    case "mode":
      input.connection.setSpectatorMode(input.message.mode);
      if (input.message.mode === "free") input.handlers.focusCamera();
      return;
    case "center":
      input.handlers.centerCamera();
      return;
    case "zoom":
      input.handlers.zoomCamera(input.message.direction);
      return;
    case "zoom-reset":
      input.handlers.resetCameraZoom();
      return;
  }
}
