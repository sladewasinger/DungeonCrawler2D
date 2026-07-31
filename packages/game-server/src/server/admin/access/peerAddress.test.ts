import { describe, expect, it } from "vitest";
import { normalizedPeerAddress } from "./peerAddress.js";

describe("normalizedPeerAddress", () => {
  it("uses the socket peer unless a trusted proxy is explicitly configured", () => {
    expect(normalizedPeerAddress({
      socketAddress: "10.0.0.8",
      forwardedFor: "198.51.100.9, 203.0.113.10",
      trustProxy: false,
    })).toBe("10.0.0.8");
  });

  it("uses CloudFront's appended rightmost viewer address", () => {
    expect(normalizedPeerAddress({
      socketAddress: "10.0.0.8",
      forwardedFor: "198.51.100.9, 203.0.113.10",
      trustProxy: true,
    })).toBe("203.0.113.10");
  });

  it("accepts an IPv4-mapped and a single forwarded address", () => {
    expect(normalizedPeerAddress({
      socketAddress: "::ffff:10.0.0.8",
      forwardedFor: "::ffff:203.0.113.10",
      trustProxy: true,
    })).toBe("203.0.113.10");
  });
});
