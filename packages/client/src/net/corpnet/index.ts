/** Public client boundary for the opt-in CorpNet transport profile. */

export {
  DEFAULT_EXPERIMENTAL_CORPNET_SETTINGS,
  loadExperimentalCorpNetSettings,
  parseExperimentalCorpNetSettings,
  saveExperimentalCorpNetSettings,
  type ExperimentalCorpNetSettings,
} from "./corpNetSettings.js";

export {
  flushCorpNetSnapshots,
  queueCorpNetSnapshot,
  setExperimentalCorpNetMode,
  startCorpNetWatchdog,
  stopCorpNetWatchdog,
} from "./corpNetSocket.js";

export {
  CorpNetState,
  type CorpNetPredictionGate,
  type CorpNetWatchdogState,
} from "./corpNetState.js";

export {
  EXPERIMENTAL_CORPNET_TUNING,
} from "./corpNetTuning.js";

export {
  SnapshotCoalescer,
  type QueuedSnapshot,
  type SnapshotMessage,
  type SnapshotQueueResult,
} from "./snapshotCoalescer.js";

export { HTTP_SNAPSHOT_RECOVERY_UNAVAILABLE } from "./httpRecovery.js";
