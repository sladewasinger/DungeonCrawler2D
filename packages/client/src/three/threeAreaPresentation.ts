/** Shared first-person color language for authoritative area-effect tiles. */
export interface ThreeAreaPresentation {
  color: string;
  emissive: string;
  opacity: number;
}

export const threeAreaPresentation = (effectId: string): ThreeAreaPresentation => {
  if (effectId.includes("fire")) {
    return { color: "#ff7838", emissive: "#ff3d12", opacity: 0.62 };
  }
  if (effectId.includes("poison") || effectId.includes("gas")) {
    return { color: "#7cbd4c", emissive: "#4f8f2f", opacity: 0.5 };
  }
  if (effectId.includes("ice") || effectId.includes("wet")) {
    return { color: "#63b7d8", emissive: "#397f9f", opacity: 0.46 };
  }
  return { color: "#a98bca", emissive: "#725595", opacity: 0.42 };
};
