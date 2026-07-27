/** Presents authoritative signed self-health events in the Three.js HUD. */
import type { Connection, VisualEvent } from "../../../net/connection/connection.js";
import { healthFeedback } from "../../../ui/presentation/healthFeedback.js";

const VISIBLE_MS = 900;

function feedbackEvent(event: VisualEvent) {
  if (event.t === "hit") return healthFeedback(event.amount);
  return healthEventFeedback(event);
}

function healthEventFeedback(event: VisualEvent) {
  if (event.t !== "health" || event.source === "automatic") return null;
  return healthFeedback(event.delta, event.kind);
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
    this.showFeedbacks(connection, nowMs);
    if (nowMs >= this.hideAt) this.element.hidden = true;
  }

  private showFeedbacks(connection: Connection, nowMs: number): void {
    for (const feedback of selfFeedbacks(connection)) this.show(feedback, nowMs);
  }

  private show(feedback: NonNullable<ReturnType<typeof feedbackEvent>>, nowMs: number): void {
    this.element.textContent = feedback.label;
    this.element.style.color = feedback.color;
    this.element.hidden = false;
    this.hideAt = nowMs + VISIBLE_MS;
  }
}

const selfFeedbacks = (connection: Connection): NonNullable<ReturnType<typeof feedbackEvent>>[] => {
  const selfId = connection.welcome?.playerId;
  if (!selfId) return [];
  return connection.drainVisualEvents()
    .filter((event) => "id" in event && event.id === selfId)
    .map(feedbackEvent)
    .filter((feedback): feedback is NonNullable<typeof feedback> => feedback !== null);
};
