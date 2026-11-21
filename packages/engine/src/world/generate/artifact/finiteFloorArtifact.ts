import type { GeneratedFloor } from "../finiteFloorTypes.js";

export const FINITE_FLOOR_ARTIFACT_VERSION = 1 as const;

export const FINITE_FLOOR_ARTIFACT_PLANES = [
  "tiles", "terrain", "features", "featureFaces", "featureHeight", "height",
  "zones", "semantic", "biome", "region", "territory", "protectedCells",
  "roomIds", "roomWallIds", "featureIds",
] as const;

export type FiniteFloorArtifactPlane = typeof FINITE_FLOOR_ARTIFACT_PLANES[number];

export interface FiniteFloorArtifact {
  readonly version: typeof FINITE_FLOOR_ARTIFACT_VERSION;
  readonly metadata: string;
  readonly planes: Readonly<Record<FiniteFloorArtifactPlane, string>>;
}

type PlaneEncoder = (plane: ArrayBufferView) => string;
type PlaneDecoder = (encoded: string) => Uint8Array;

export function createFiniteFloorArtifact(floor: GeneratedFloor, encode: PlaneEncoder): FiniteFloorArtifact {
  return {
    version: FINITE_FLOOR_ARTIFACT_VERSION,
    metadata: JSON.stringify(metadataForFloor(floor)),
    planes: Object.fromEntries(FINITE_FLOOR_ARTIFACT_PLANES.map((plane) => [plane, encodePlane(floor, plane, encode)])) as FiniteFloorArtifact["planes"],
  };
}

export function restoreFiniteFloorArtifact(artifact: FiniteFloorArtifact, decode: PlaneDecoder): GeneratedFloor {
  if (artifact.version !== FINITE_FLOOR_ARTIFACT_VERSION) throw new Error("Unsupported finite floor artifact version");
  const metadata = JSON.parse(artifact.metadata) as Omit<GeneratedFloor, FiniteFloorArtifactPlane>;
  const expectedLength = expectedPlaneLength(metadata);
  const bytes = decodeAndValidatePlanes(artifact, decode, expectedLength);
  return {
    ...metadata,
    ...Object.fromEntries(FINITE_FLOOR_ARTIFACT_PLANES.map((plane) => [plane, restorePlane(plane, bytes[plane])])) as Pick<GeneratedFloor, FiniteFloorArtifactPlane>,
  };
}

function expectedPlaneLength(metadata: Omit<GeneratedFloor, FiniteFloorArtifactPlane>): number {
  const bounds = metadata.bounds;
  const length = bounds.width * bounds.height;
  if (!Number.isSafeInteger(length) || length <= 0) throw new Error("Malformed finite floor artifact bounds");
  return length;
}

function decodeAndValidatePlanes(
  artifact: FiniteFloorArtifact,
  decode: PlaneDecoder,
  expectedLength: number,
): Readonly<Record<FiniteFloorArtifactPlane, Uint8Array>> {
  const planes = artifact.planes as Partial<Record<FiniteFloorArtifactPlane, string>> | undefined;
  const bytes = {} as Record<FiniteFloorArtifactPlane, Uint8Array>;
  for (const plane of FINITE_FLOOR_ARTIFACT_PLANES) {
    const encoded = planes?.[plane];
    if (typeof encoded !== "string" || encoded.length === 0) throw new Error(`Malformed finite floor artifact: missing plane ${plane}`);
    const decoded = decode(encoded);
    validatePlaneBytes(plane, decoded, expectedLength);
    bytes[plane] = decoded;
  }
  return bytes;
}

function validatePlaneBytes(plane: FiniteFloorArtifactPlane, bytes: Uint8Array, expectedLength: number): void {
  const elementBytes = planeElementBytes(plane);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength % elementBytes !== 0) {
    throw new Error(`Malformed finite floor artifact: misaligned plane ${plane}`);
  }
  if (bytes.byteLength !== expectedLength * elementBytes) {
    throw new Error(`Malformed finite floor artifact: invalid length for plane ${plane}`);
  }
}

function planeElementBytes(plane: FiniteFloorArtifactPlane): number {
  if (plane === "featureHeight" || plane === "height") return Float32Array.BYTES_PER_ELEMENT;
  if (plane === "region") return Uint16Array.BYTES_PER_ELEMENT;
  if (plane === "roomIds" || plane === "roomWallIds" || plane === "featureIds") return Int16Array.BYTES_PER_ELEMENT;
  return Uint8Array.BYTES_PER_ELEMENT;
}

function encodePlane(floor: GeneratedFloor, plane: FiniteFloorArtifactPlane, encode: PlaneEncoder): string {
  return encode(floor[plane] as ArrayBufferView);
}

function restorePlane(plane: FiniteFloorArtifactPlane, bytes: Uint8Array): ArrayBufferView {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  if (plane === "featureHeight" || plane === "height") return new Float32Array(buffer);
  if (plane === "region") return new Uint16Array(buffer);
  if (plane === "roomIds" || plane === "roomWallIds" || plane === "featureIds") return new Int16Array(buffer);
  return new Uint8Array(buffer);
}

function metadataForFloor(floor: GeneratedFloor): Omit<GeneratedFloor, FiniteFloorArtifactPlane> {
  const metadata = { ...floor } as Record<string, unknown>;
  for (const plane of FINITE_FLOOR_ARTIFACT_PLANES) delete metadata[plane];
  return metadata as Omit<GeneratedFloor, FiniteFloorArtifactPlane>;
}
