/** Verdant Forest visual palettes, light specs, and mobile-first quality presets. */

export type QualityPresetId = "high" | "balanced" | "performance";

export interface QualityPresetSpec {
  readonly id: QualityPresetId;
  readonly label: string;
  readonly maxDpr: number;
  readonly lightmapScale: number;
  readonly waterShader: boolean;
  readonly windShader: boolean;
  readonly godRays: boolean;
  readonly maxParticles: number;
  readonly chunkRadius: number;
}

export const QUALITY_PRESETS: Readonly<Record<QualityPresetId, QualityPresetSpec>> = {
  high: {
    id: "high",
    label: "High",
    maxDpr: 2,
    lightmapScale: 0.5,
    waterShader: true,
    windShader: true,
    godRays: true,
    maxParticles: 64,
    chunkRadius: 2,
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    maxDpr: 1.5,
    lightmapScale: 0.35,
    waterShader: true,
    windShader: true,
    godRays: true,
    maxParticles: 36,
    chunkRadius: 1,
  },
  performance: {
    id: "performance",
    label: "Low",
    maxDpr: 1,
    lightmapScale: 0.25,
    waterShader: false,
    windShader: false,
    godRays: false,
    maxParticles: 16,
    chunkRadius: 1,
  },
};

export const FOREST_LIGHT_STYLE = {
  campfireColor: 0xff9a3c,
  torchColor: 0xffb357,
  playerTorchColor: 0xffbd6b,
  fireflyColor: 0xd9f99d,
  playerTorchRadiusPx: 165,
} as const;
