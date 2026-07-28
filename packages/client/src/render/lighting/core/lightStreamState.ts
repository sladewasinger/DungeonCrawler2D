export interface LightStreamState {
  window: string;
  revision: number;
}

export function createLightStreamState(): LightStreamState {
  return { window: "", revision: -1 };
}

export function invalidateLightStream<T>(
  state: LightStreamState,
  chunks: Map<string, T>,
): void {
  chunks.clear();
  state.window = "";
  state.revision = -1;
}

export function refreshLightStreamRevision<T>(
  state: LightStreamState,
  chunks: Map<string, T>,
  revision: number,
): void {
  if (state.revision === revision) return;
  chunks.clear();
  state.window = "";
  state.revision = revision;
}
