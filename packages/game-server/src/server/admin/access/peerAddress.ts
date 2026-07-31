export interface PeerAddressInput {
  readonly socketAddress: string | undefined;
  readonly forwardedFor: string | string[] | undefined;
  readonly trustProxy: boolean;
}

const UNKNOWN_PEER = "unknown";

/** Resolve one stable limiter key without accepting client-supplied proxy headers. */
export function normalizedPeerAddress(input: PeerAddressInput): string {
  const address = input.trustProxy
    ? rightmostForwardedAddress(input.forwardedFor) ?? input.socketAddress
    : input.socketAddress;
  return normalizeAddress(address);
}

/** CloudFront preserves supplied values and appends the verified viewer IP. */
function rightmostForwardedAddress(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header.join(",") : header;
  const addresses = value?.split(",").map((address) => address.trim()).filter(Boolean);
  return addresses?.at(-1);
}

function normalizeAddress(address: string | undefined): string {
  const value = address?.trim().toLowerCase();
  if (!value) return UNKNOWN_PEER;
  return value.startsWith("::ffff:") ? value.slice("::ffff:".length) : value;
}
