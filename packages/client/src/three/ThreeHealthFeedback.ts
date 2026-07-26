/** Presents authoritative signed self-health events in the Three.js HUD. */
import type { Connection, VisualEvent } from "../net/connection.js";
import { healthFeedback } from "../ui/healthFeedback.js";

const VISIBLE_MS = 900;

function feedbackEvent(event: VisualEvent) {
  if (event.t === "health") {
    if (event.source === "automatic") return null;
    return healthFeedback(event.delta, event.kind);
  }
  if (event.t === "hit") return healthFeedback(event.amount);
  return null;
}

export class ThreeHealthFeedback {
  readonly element = document.createElement("div");
  private hideAt = 0;

  constructor() {
    this.element.hidden = true;
    this.element.style.cssText =
      "position:absolute;left:50%;top:44%;translate:-50% -50%;" +
      "font-size:24px;font-weight:800;text-shadow:0 2px 3px #000;" +
      "pointer-events:none;z-index:1090";
  }

  update(connection: Connection, nowMs: number): void {
    const selfId = connection.welcome?.playerId;
    for (const event of connection.drainVisualEvents()) {
      if (!selfId || !("id" in event) || event.id !== selfId) continue;
      const feedback = feedbackEvent(event);
      if (!feedback) continue;
      this.element.textContent = feedback.label;
      this.element.style.color = feedback.color;
      this.element.hidden = false;
      this.hideAt = nowMs + VISIBLE_MS;
    }
    if (nowMs >= this.hideAt) this.element.hidden = true;
  }
}
