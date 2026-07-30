export type DevicePresentationKind = "constrained" | "desktop";

export interface DevicePresentationProfile {
  readonly kind: DevicePresentationKind;
}

export const CONSTRAINED_DEVICE_PRESENTATION_PROFILE: DevicePresentationProfile =
  Object.freeze({ kind: "constrained" });

export const DESKTOP_DEVICE_PRESENTATION_PROFILE: DevicePresentationProfile =
  Object.freeze({ kind: "desktop" });

export function devicePresentationProfileForKind(
  kind: DevicePresentationKind,
): DevicePresentationProfile {
  return kind === "constrained"
    ? CONSTRAINED_DEVICE_PRESENTATION_PROFILE
    : DESKTOP_DEVICE_PRESENTATION_PROFILE;
}
