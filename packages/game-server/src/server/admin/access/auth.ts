import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_KEY = "dc2d-admin-token-v1";

/** Constant-time comparison that does not expose token length. */
export function adminTokenMatches(candidate: string, expected: string | null | undefined): boolean {
  if (!expected) return false;
  const candidateDigest = digest(candidate);
  const expectedDigest = digest(expected);
  return timingSafeEqual(candidateDigest, expectedDigest);
}

function digest(value: string): Buffer {
  return createHmac("sha256", TOKEN_KEY).update(value, "utf8").digest();
}
