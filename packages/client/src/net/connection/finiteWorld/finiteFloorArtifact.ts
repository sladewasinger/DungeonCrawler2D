import {
  restoreFiniteFloorArtifact,
  type FiniteFloorArtifact,
  type GeneratedFloor,
} from "@dc2d/engine";

const ARTIFACT_PREFIX = "gzip-base64-v1:";

export async function decodeFiniteFloorArtifact(encoded: string): Promise<GeneratedFloor> {
  if (!encoded.startsWith(ARTIFACT_PREFIX)) throw new Error("Unsupported finite floor artifact encoding");
  const compressed = decodeBase64(encoded.slice(ARTIFACT_PREFIX.length));
  const stream = new Blob([compressed.buffer as ArrayBuffer])
    .stream().pipeThrough(new DecompressionStream("gzip"));
  const json = await new Response(stream).text();
  return restoreFiniteFloorArtifact(JSON.parse(json) as FiniteFloorArtifact, decodeBase64);
}

function decodeBase64(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
