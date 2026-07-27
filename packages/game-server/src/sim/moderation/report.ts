import type { PlayerSlot, SimState } from "../state/state.js";

const MAX_REPORTS = 500;

export function recordReport({ sim, reporter, target, reason, profileId }: {
  sim: SimState;
  reporter: PlayerSlot;
  target: PlayerSlot["stored"];
  reason?: string;
  profileId: (stored: PlayerSlot["stored"]) => string;
}): void {
  sim.moderationReports.push({
    tick: sim.tickCount,
    reporterId: reporter.entity.id,
    targetId: profileId(target),
    reason: reason?.trim() || "Player report",
  });
  if (sim.moderationReports.length > MAX_REPORTS) sim.moderationReports.shift();
  reporter.outbox.push({ t: "toast", msg: `Reported ${target.name}` });
}
