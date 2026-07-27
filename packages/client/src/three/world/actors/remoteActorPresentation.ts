/** Defines and applies the reconnect appearance used by rendered Three player actors. */
export interface RemoteActorPresentation {
  color: string;
  emissive: string;
  emissiveIntensity: number;
  labelVisible: boolean;
}

export interface RemoteActorMaterialView {
  color: { set(value: string): void };
  emissive: { set(value: string): void };
  emissiveIntensity: number;
}

export interface RemoteActorLabelView {
  visible: boolean;
}

export function remoteActorPresentation(disconnected: boolean): RemoteActorPresentation {
  return disconnected
    ? { color: "#55555a", emissive: "#111116", emissiveIntensity: 0.35, labelVisible: true }
    : { color: "#ffffff", emissive: "#000000", emissiveIntensity: 0, labelVisible: false };
}

export function applyRemoteActorPresentation(
  material: RemoteActorMaterialView,
  label: RemoteActorLabelView,
  disconnected: boolean,
): void {
  const presentation = remoteActorPresentation(disconnected);
  material.color.set(presentation.color);
  material.emissive.set(presentation.emissive);
  material.emissiveIntensity = presentation.emissiveIntensity;
  label.visible = presentation.labelVisible;
}
