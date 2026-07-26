import type { PlayerEntityView } from "./view.js";

export function shouldRenderLivePlayer(
  view: Pick<PlayerEntityView, "hp">,
): boolean {
  return view.hp > 0;
}
