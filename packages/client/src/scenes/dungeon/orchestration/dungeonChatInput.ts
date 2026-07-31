import type Phaser from "phaser";
import { ChatInputBox } from "../../../ui/chat/chatInput.js";

export interface DungeonChatInputOptions {
  readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;
  readonly onSubmit: (text: string) => void;
}

export function createDungeonChatInputBox(options: DungeonChatInputOptions): ChatInputBox {
  return new ChatInputBox({
    onSubmit: options.onSubmit,
    onFocusChange: (focused) => toggleGameplayKeyCapture(options.keyboard, focused),
  });
}

function toggleGameplayKeyCapture(
  keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null,
  focused: boolean,
): void {
  if (!keyboard) return;
  if (focused) keyboard.disableGlobalCapture();
  else keyboard.enableGlobalCapture();
}
