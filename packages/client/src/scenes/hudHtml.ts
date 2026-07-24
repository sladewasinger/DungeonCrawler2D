/** Constructs the shared live HTML HUD from renderer-specific focus callbacks. */
import type { Connection } from "../net/connection.js";
import { ThreeHud } from "../three/ThreeHud.js";

export interface LiveHtmlHudOptions {
  root: HTMLElement;
  connection: Connection;
  focusGame(): void;
  setTextInputFocused(focused: boolean): void;
  onSelectHotbar?: (index: number | null) => void;
  session: {
    respawn(): void;
    quitToTitle(): void;
  };
}

export const createLiveHtmlHud = (options: LiveHtmlHudOptions): ThreeHud =>
  new ThreeHud({
    root: options.root,
    connection: options.connection,
    focusGame: options.focusGame,
    setTextInputFocused: options.setTextInputFocused,
    showReticle: false,
    ...(options.onSelectHotbar
      ? { onSelectHotbar: options.onSelectHotbar }
      : {}),
    session: options.session,
  });
