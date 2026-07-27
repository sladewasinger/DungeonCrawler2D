/** Presents authoritative signed self-health events in the shared HTML HUD. */
import type { Connection, VisualEvent } from "../../../net/connection/connection.js";
import { healthFeedback } from "../../../ui/presentation/healthFeedback.js";
import { createHudTemplate } from "../styles/hudTemplate.js";

const VISIBLE_MS = 900;

function feedbackEvent(event: VisualEvent) {
  if (event.t === "hit") return healthFeedback(event.amount);
  return healthEventFeedback(event);
}

function healthEventFeedback(event: VisualEvent) {
  if (event.t !== "health" || event.source === "automatic") return null;
  return healthFeedback(event.delta, event.kind);
}

export class HealthFeedback {
  readonly element = createHudTemplate<HTMLDivElement>("hud-health-feedback-template");
  private hideAt = 0;

  constructor() {
    this.element.hidden = true;
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
    if (typeof this.element.style.setProperty === "function") {
      this.element.style.setProperty("--hud-feedback-color", feedback.color);
    } else {
      this.element.style.color = feedback.color;
    }
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
