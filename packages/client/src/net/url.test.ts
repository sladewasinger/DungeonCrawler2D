import { describe, expect, it } from "vitest";
import { resolveWsUrl } from "./url.js";

describe("resolveWsUrl", () => {
  it("uses same-origin wss when the page is https (prod, CloudFront -> /ws)", () => {
    const url = resolveWsUrl({ protocol: "https:", host: "dungeoncrawl2d.austinwasinger.com", search: "" });
    expect(url).toBe("wss://dungeoncrawl2d.austinwasinger.com/ws");
  });

  it("uses ws://localhost:8787 when the page is plain http (dev)", () => {
    const url = resolveWsUrl({ protocol: "http:", host: "localhost:5180", search: "" });
    expect(url).toBe("ws://localhost:8787");
  });

  it("lets ?server= override either default, for pointing dev at another server", () => {
    const url = resolveWsUrl({
      protocol: "https:",
      host: "dungeoncrawl2d.austinwasinger.com",
      search: "?server=ws://192.168.1.5:8787",
    });
    expect(url).toBe("ws://192.168.1.5:8787");
  });
});
