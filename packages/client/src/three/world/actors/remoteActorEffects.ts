/** Selects a readable ground aura from authoritative remote actor state. */
export interface RemoteActorEffects {
  visible: boolean;
  color: string;
  opacity: number;
}

const statusEffects = (status: string): RemoteActorEffects => {
  if (status.includes("fire") || status.includes("burn")) {
    return { visible: true, color: "#ff7838", opacity: 0.72 };
  }
  if (status.includes("bleed")) {
    return { visible: true, color: "#c83f4d", opacity: 0.72 };
  }
  if (status.includes("bandage") || status.includes("heal")) {
    return { visible: true, color: "#66c78a", opacity: 0.7 };
  }
  return { visible: true, color: "#9b76c7", opacity: 0.62 };
};

export const remoteActorEffects = (
  fx: readonly string[] = [],
  blocking = false,
  downed = false,
): RemoteActorEffects => {
  if (downed) return { visible: true, color: "#b94a58", opacity: 0.82 };
  if (blocking) return { visible: true, color: "#61b9df", opacity: 0.76 };
  const status = fx[0];
  if (!status) return { visible: false, color: "#ffffff", opacity: 0 };
  return statusEffects(status);
};
