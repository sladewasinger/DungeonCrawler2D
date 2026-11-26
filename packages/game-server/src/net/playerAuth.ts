/** Cryptographic session resume-token issuance and constant-time SHA-256 verification. */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export interface IssuedPlayerCredentials {
  readonly accountId: string;
  readonly resumeToken: string;
  readonly tokenHash: string;
}

export function hashResumeToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function issuePlayerCredentials(): IssuedPlayerCredentials {
  const accountId = `acc_${randomBytes(12).toString("hex")}`;
  const resumeToken = randomBytes(32).toString("base64url");
  return { accountId, resumeToken, tokenHash: hashResumeToken(resumeToken) };
}

export function verifyResumeToken(candidate: string | undefined, expectedHex: string | undefined): boolean {
  if (!candidate || !expectedHex) return false;
  const a = Buffer.from(hashResumeToken(candidate), "hex");
  const b = Buffer.from(expectedHex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
